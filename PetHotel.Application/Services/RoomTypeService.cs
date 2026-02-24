using AutoMapper;
using PetHotel.Application.Common.Exceptions;
using PetHotel.Application.DTOs.RoomTypes;
using PetHotel.Application.Interfaces;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Interfaces;

namespace PetHotel.Application.Services;

public class RoomTypeService : IRoomTypeService
{
    private readonly IRoomTypeRepository _roomTypeRepository;
    private readonly IRoomRepository _roomRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly ICachingService _cachingService;
    private const string CacheKeyPrefix = "RoomTypes";
    private static readonly TimeSpan CacheExpiration = TimeSpan.FromMinutes(15);

    public RoomTypeService(
    IRoomTypeRepository roomTypeRepository,
    IRoomRepository roomRepository,
    IBookingRepository bookingRepository,
    IUnitOfWork unitOfWork,
    IMapper mapper,
    ICachingService cachingService)
    {
        _roomTypeRepository = roomTypeRepository;
        _roomRepository = roomRepository;
        _bookingRepository = bookingRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _cachingService = cachingService;
    }

    private string GetCacheKey(string suffix)
    {
        return $"{CacheKeyPrefix}:{suffix}";
    }

    private async Task InvalidateCacheAsync()
    {
        await _cachingService.RemoveByPrefixAsync($"{CacheKeyPrefix}");
    }

    public async Task<IEnumerable<RoomTypeDto>> GetAllRoomTypesAsync()
    {
        var cacheKey = GetCacheKey("All");

        // Пытаемся получить из кэша
        var cached = await _cachingService.GetAsync<List<RoomTypeDto>>(cacheKey);
        if (cached != null)
            return cached;

        var roomTypes = await _roomTypeRepository.GetActiveRoomTypesAsync();

        var roomTypeDtos = _mapper.Map<List<RoomTypeDto>>(roomTypes);

        // Оптимизация: загружаем все комнаты одним запросом
        var allRooms = await _roomRepository.GetAllAsync();
        var roomCountsByType = allRooms
        .Where(r => r.IsActive)
        .GroupBy(r => r.RoomTypeId)
        .ToDictionary(g => g.Key, g => g.Count());

        // Устанавливаем количество доступных номеров как общее количество номеров данного типа
        foreach (var roomTypeDto in roomTypeDtos)
        {
            roomTypeDto.AvailableRoomsCount = roomCountsByType.TryGetValue(roomTypeDto.Id, out var count) ? count : 0;
        }

        // Сохраняем в кэш
        await _cachingService.SetAsync(cacheKey, roomTypeDtos, CacheExpiration);

        return roomTypeDtos;
    }

    public async Task<IEnumerable<RoomTypeDto>> GetAllRoomTypesWithInactiveAsync()
    {
        var cacheKey = GetCacheKey("AllWithInactive");

        // Пытаемся получить из кэша
        var cached = await _cachingService.GetAsync<List<RoomTypeDto>>(cacheKey);
        if (cached != null)
            return cached;

        var roomTypes = await _roomTypeRepository.GetAllAsync();

        var roomTypeDtos = _mapper.Map<List<RoomTypeDto>>(roomTypes);

        // Оптимизация: загружаем все комнаты одним запросом
        var allRooms = await _roomRepository.GetAllAsync();
        var roomCountsByType = allRooms
        .Where(r => r.IsActive)
        .GroupBy(r => r.RoomTypeId)
        .ToDictionary(g => g.Key, g => g.Count());

        foreach (var roomTypeDto in roomTypeDtos)
        {
            roomTypeDto.AvailableRoomsCount = roomCountsByType.TryGetValue(roomTypeDto.Id, out var count) ? count : 0;
        }

        // Сохраняем в кэш
        await _cachingService.SetAsync(cacheKey, roomTypeDtos, CacheExpiration);

        return roomTypeDtos;
    }

    public async Task<IEnumerable<RoomTypeDto>> GetAvailableRoomTypesAsync(DateTime checkIn, DateTime checkOut)
    {
        var roomTypes = await _roomTypeRepository.GetActiveRoomTypesAsync();

        var roomTypeDtos = _mapper.Map<List<RoomTypeDto>>(roomTypes);

        // Для каждого типа номера вычисляем количество доступных номеров на указанные даты
        foreach (var roomTypeDto in roomTypeDtos)
        {
            roomTypeDto.AvailableRoomsCount = await _roomTypeRepository.GetAvailableRoomsCountAsync(
            roomTypeDto.Id, checkIn, checkOut);
        }

        // Возвращаем только типы номеров, у которых есть доступные номера
        return roomTypeDtos.Where(rt => rt.AvailableRoomsCount > 0);
    }

    public async Task<RoomTypeDto> GetRoomTypeByIdAsync(Guid id)
    {
        var cacheKey = GetCacheKey($"ById:{id}");

        // Пытаемся получить из кэша
        var cached = await _cachingService.GetAsync<RoomTypeDto>(cacheKey);
        if (cached != null)
            return cached;

        var roomType = await _roomTypeRepository.GetActiveByIdAsync(id);

        if (roomType == null)
            throw new NotFoundException("Тип номера", id);

        var roomTypeDto = _mapper.Map<RoomTypeDto>(roomType);

        // Оптимизация: подсчитываем только номера нужного типа
        var allRooms = await _roomRepository.GetAllAsync();
        roomTypeDto.AvailableRoomsCount = allRooms.Count(r => r.RoomTypeId == id && r.IsActive);

        // Сохраняем в кэш
        await _cachingService.SetAsync(cacheKey, roomTypeDto, CacheExpiration);

        return roomTypeDto;
    }

    public async Task<IEnumerable<string>> GetBusyDatesAsync(Guid roomTypeId)
    {
        var cacheKey = GetCacheKey($"BusyDates:{roomTypeId}");

        // Пытаемся получить из кэша (кэш на 1 час, т.к. данные меняются нечасто)
        var cached = await _cachingService.GetAsync<List<string>>(cacheKey);
        if (cached != null)
            return cached;

        // Получаем все номера данного типа
        var rooms = await _roomRepository.GetByRoomTypeIdAsync(roomTypeId);
        var activeRooms = rooms.Where(r => r.IsActive).ToList();

        if (activeRooms.Count == 0)
        {
            return new List<string>();
        }

        // Оптимизация: получаем только бронирования для конкретных номеров
        var startDate = DateTime.Today;
        var endDate = DateTime.Today.AddMonths(6);
        var activeRoomIds = activeRooms.Select(r => r.Id).ToList();

        var allBookings = await _bookingRepository.GetAllWithDetailsAsync(startDate, endDate, null);
        var typeBookings = allBookings
        .Where(b => b.AssignedRoomId.HasValue && activeRoomIds.Contains(b.AssignedRoomId.Value))
        .ToList();

        // Оптимизация: используем словарь для подсчета занятых номеров по датам
        var occupiedRoomsByDate = new Dictionary<DateTime, HashSet<Guid>>();
        var totalRooms = activeRooms.Count;

        // Строим словарь занятых номеров по датам
        foreach (var booking in typeBookings)
        {
            if (!booking.AssignedRoomId.HasValue)
                continue;

            var checkIn = booking.CheckInDate.Date;
            var checkOut = booking.CheckOutDate.Date;

            for (var date = checkIn; date <= checkOut; date = date.AddDays(1))
            {
                if (date < startDate || date > endDate)
                    continue;

                if (!occupiedRoomsByDate.ContainsKey(date))
                {
                    occupiedRoomsByDate[date] = new HashSet<Guid>();
                }
                occupiedRoomsByDate[date].Add(booking.AssignedRoomId.Value);
            }
        }

        // Находим даты, когда все номера заняты
        var busyDatesList = occupiedRoomsByDate
        .Where(kvp => kvp.Value.Count >= totalRooms)
        .Select(kvp => kvp.Key.ToString("yyyy-MM-dd"))
        .OrderBy(d => d)
        .ToList();

        // Сохраняем в кэш на 1 час
        await _cachingService.SetAsync(cacheKey, busyDatesList, TimeSpan.FromHours(1));

        return busyDatesList;
    }

    public async Task<RoomTypeDto> CreateRoomTypeAsync(CreateRoomTypeRequest request)
    {
        // Проверяем уникальность названия типа
        var exists = await _roomTypeRepository.RoomTypeNameExistsAsync(request.Name);

        if (exists)
            throw new BadRequestException($"Тип номера '{request.Name}' уже существует");

        var roomType = _mapper.Map<RoomType>(request);

        await _roomTypeRepository.AddAsync(roomType);
        await _unitOfWork.SaveChangesAsync();

        var roomTypeDto = _mapper.Map<RoomTypeDto>(roomType);
        roomTypeDto.AvailableRoomsCount = 0; // Новый тип, номеров еще нет

        // Инвалидируем кэш для текущего тенанта
        await InvalidateCacheAsync();

        return roomTypeDto;
    }

    public async Task<RoomTypeDto> UpdateRoomTypeAsync(Guid id, UpdateRoomTypeRequest request)
    {
        var roomType = await _roomTypeRepository.GetByIdAsync(id);

        if (roomType == null)
            throw new NotFoundException("Тип номера", id);

        // Проверяем уникальность названия типа (если меняется)
        if (roomType.Name != request.Name)
        {
            var exists = await _roomTypeRepository.RoomTypeNameExistsAsync(request.Name, id);

            if (exists)
                throw new BadRequestException($"Тип номера '{request.Name}' уже существует");
        }

        _mapper.Map(request, roomType);

        await _roomTypeRepository.UpdateAsync(roomType);
        await _unitOfWork.SaveChangesAsync();

        var roomTypeDto = _mapper.Map<RoomTypeDto>(roomType);

        // Оптимизация: подсчитываем только номера нужного типа
        var allRooms = await _roomRepository.GetAllAsync();
        roomTypeDto.AvailableRoomsCount = allRooms.Count(r => r.RoomTypeId == id && r.IsActive);

        // Инвалидируем кэш
        await InvalidateCacheAsync();

        return roomTypeDto;
    }

    public async Task DeleteRoomTypeAsync(Guid id)
    {
        var roomType = await _roomTypeRepository.GetByIdAsync(id);

        if (roomType == null)
            throw new NotFoundException("Тип номера", id);

        // Оптимизация: проверяем наличие связанных номеров и бронирований более эффективно
        var allRooms = await _roomRepository.GetAllAsync();
        var hasRooms = allRooms.Any(r => r.RoomTypeId == id);

        if (hasRooms)
            throw new BadRequestException("Невозможно удалить тип номера, к которому привязаны номера");

        var allBookings = await _bookingRepository.GetAllAsync();
        var hasBookings = allBookings.Any(b => b.RoomTypeId == id);

        if (hasBookings)
            throw new BadRequestException("Невозможно удалить тип номера с бронированиями");

        // Мягкое удаление
        roomType.IsActive = false;
        await _roomTypeRepository.UpdateAsync(roomType);
        await _unitOfWork.SaveChangesAsync();

        // Инвалидируем кэш
        await InvalidateCacheAsync();
    }
}
