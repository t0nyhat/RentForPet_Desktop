using AutoMapper;
using PetHotel.Application.Common.Exceptions;
using PetHotel.Application.Common.Helpers;
using PetHotel.Application.DTOs.Rooms;
using PetHotel.Application.Interfaces;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Interfaces;

namespace PetHotel.Application.Services;

public class RoomService : IRoomService
{
    private readonly IRoomRepository _roomRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly IBookingSettingsRepository _settingsRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    private static readonly Guid SettingsSingletonId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    public RoomService(
    IRoomRepository roomRepository,
    IBookingRepository bookingRepository,
    IBookingSettingsRepository settingsRepository,
    IUnitOfWork unitOfWork,
    IMapper mapper)
    {
        _roomRepository = roomRepository;
        _bookingRepository = bookingRepository;
        _settingsRepository = settingsRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<IEnumerable<RoomDto>> GetAllRoomsAsync()
    {
        var rooms = await _roomRepository.GetActiveRoomsAsync();
        return _mapper.Map<IEnumerable<RoomDto>>(rooms);
    }

    public async Task<RoomDto> GetRoomByIdAsync(Guid id)
    {
        var room = await _roomRepository.GetActiveByIdAsync(id);

        if (room == null)
            throw new NotFoundException("Номер", id);

        return _mapper.Map<RoomDto>(room);
    }

    public async Task<IEnumerable<RoomDto>> GetAvailableRoomsAsync(Guid roomTypeId, DateTime checkIn, DateTime checkOut)
    {
        // Получаем настройки для проверки доступности с учетом режима расчета
        var settings = await GetOrCreateSettingsAsync();

        // Получаем все активные номера данного типа
        var allRooms = await _roomRepository.GetByRoomTypeIdAsync(roomTypeId);
        var activeRooms = allRooms.Where(r => r.IsActive).ToList();

        // Находим занятые номера на указанные даты с учетом режима расчета
        var overlappingBookings = await _bookingRepository.GetOverlappingBookingsAsync(checkIn, checkOut);
        var occupiedRoomIds = overlappingBookings
        .Where(b => b.AssignedRoomId.HasValue)
        .Where(b => BookingCalculationHelper.DoPeriodsOverlap(
        checkIn,
        checkOut,
        b.CheckInDate,
        b.CheckOutDate,
        settings.CalculationMode))
        .Select(b => b.AssignedRoomId!.Value)
        .Distinct()
        .ToHashSet();

        // Возвращаем только свободные номера
        var availableRooms = activeRooms.Where(r => !occupiedRoomIds.Contains(r.Id)).ToList();
        return _mapper.Map<IEnumerable<RoomDto>>(availableRooms);
    }

    private async Task<BookingSettings> GetOrCreateSettingsAsync()
    {
        var settings = await _settingsRepository.GetByIdAsync(SettingsSingletonId);
        if (settings != null)
            return settings;

        // Создаем настройки по умолчанию, если их нет
        settings = new BookingSettings
        {
            Id = SettingsSingletonId,
            CalculationMode = Domain.Enums.BookingCalculationMode.Days,
            CheckInTime = new TimeSpan(15, 0, 0),
            CheckOutTime = new TimeSpan(12, 0, 0),
            IsSingleton = true
        };

        await _settingsRepository.AddAsync(settings);
        await _unitOfWork.SaveChangesAsync();
        return settings;
    }

    public async Task<IEnumerable<RoomDto>> GetAvailableRoomsAsync(DateTime checkIn, DateTime checkOut, int? numberOfPets = null)
    {
        if (checkOut.Date < checkIn.Date)
            throw new BadRequestException("Дата выезда не может быть раньше даты заезда");

        // Получаем настройки для проверки доступности с учетом режима расчета
        var settings = await GetOrCreateSettingsAsync();

        var pets = Math.Max(1, numberOfPets ?? 1);

        // Получаем все активные номера с достаточной вместимостью
        var allRooms = await _roomRepository.GetActiveRoomsAsync();
        var roomsWithCapacity = allRooms
        .Where(r => r.RoomType.MaxCapacity >= pets)
        .ToList();

        // Находим занятые номера на указанные даты с учетом режима расчета
        var overlappingBookings = await _bookingRepository.GetOverlappingBookingsAsync(checkIn, checkOut);
        var occupiedRoomIds = overlappingBookings
        .Where(b => b.AssignedRoomId.HasValue)
        .Where(b => BookingCalculationHelper.DoPeriodsOverlap(
        checkIn,
        checkOut,
        b.CheckInDate,
        b.CheckOutDate,
        settings.CalculationMode))
        .Select(b => b.AssignedRoomId!.Value)
        .Distinct()
        .ToHashSet();

        // Возвращаем только свободные номера
        var availableRooms = roomsWithCapacity.Where(r => !occupiedRoomIds.Contains(r.Id)).ToList();
        return _mapper.Map<IEnumerable<RoomDto>>(availableRooms);
    }

    public async Task<RoomDto> CreateRoomAsync(CreateRoomRequest request)
    {
        // Проверяем уникальность номера
        var exists = await _roomRepository.RoomNumberExistsAsync(request.RoomNumber);

        if (exists)
            throw new BadRequestException($"Номер '{request.RoomNumber}' уже существует");

        var room = _mapper.Map<Room>(request);

        await _roomRepository.AddAsync(room);
        await _unitOfWork.SaveChangesAsync();

        return _mapper.Map<RoomDto>(room);
    }

    public async Task<RoomDto> UpdateRoomAsync(Guid id, CreateRoomRequest request)
    {
        var room = await _roomRepository.GetByIdAsync(id);

        if (room == null)
            throw new NotFoundException("Номер", id);

        // Проверяем уникальность номера (если меняется)
        if (room.RoomNumber != request.RoomNumber)
        {
            var exists = await _roomRepository.RoomNumberExistsAsync(request.RoomNumber, id);

            if (exists)
                throw new BadRequestException($"Номер '{request.RoomNumber}' уже существует");
        }

        _mapper.Map(request, room);

        await _roomRepository.UpdateAsync(room);
        await _unitOfWork.SaveChangesAsync();

        return _mapper.Map<RoomDto>(room);
    }

    public async Task DeleteRoomAsync(Guid id)
    {
        var room = await _roomRepository.GetByIdAsync(id);

        if (room == null)
            throw new NotFoundException("Номер", id);

        // Проверяем, нет ли активных бронирований
        var hasActiveBookings = await _bookingRepository.HasActiveBookingsForRoomAsync(id);

        if (hasActiveBookings)
            throw new BadRequestException("Невозможно удалить номер с активными бронированиями");

        // Мягкое удаление
        room.IsActive = false;
        await _roomRepository.UpdateAsync(room);
        await _unitOfWork.SaveChangesAsync();
    }
}
