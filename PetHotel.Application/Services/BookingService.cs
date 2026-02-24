using System;
using AutoMapper;
using PetHotel.Application.Common.Exceptions;
using PetHotel.Application.Common.Helpers;
using PetHotel.Application.DTOs.Bookings;
using PetHotel.Application.Interfaces;
using PetHotel.Application.DTOs.Payments;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using PetHotel.Domain.Interfaces;

namespace PetHotel.Application.Services;

public class BookingService : IBookingService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly IRoomTypeRepository _roomTypeRepository;
    private readonly IRoomRepository _roomRepository;
    private readonly IPetRepository _petRepository;
    private readonly IBookingPetRepository _bookingPetRepository;
    private readonly IPaymentRepository _paymentRepository;
    private readonly IClientRepository _clientRepository;
    private readonly IBookingSettingsRepository _settingsRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    public BookingService(
    IBookingRepository bookingRepository,
    IRoomTypeRepository roomTypeRepository,
    IRoomRepository roomRepository,
    IPetRepository petRepository,
    IBookingPetRepository bookingPetRepository,
    IPaymentRepository paymentRepository,
    IClientRepository clientRepository,
    IBookingSettingsRepository settingsRepository,
    IUnitOfWork unitOfWork,
    IMapper mapper)
    {
        _bookingRepository = bookingRepository;
        _roomTypeRepository = roomTypeRepository;
        _roomRepository = roomRepository;
        _petRepository = petRepository;
        _bookingPetRepository = bookingPetRepository;
        _paymentRepository = paymentRepository;
        _clientRepository = clientRepository;
        _settingsRepository = settingsRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<IEnumerable<BookingDto>> GetClientBookingsAsync(Guid clientId)
    {
        var bookings = await _bookingRepository.GetByClientIdAsync(clientId);
        var settings = await GetOrCreateSettingsAsync();
        var dtos = _mapper.Map<List<BookingDto>>(bookings);

        // Пересчитываем NumberOfNights с учетом текущего режима расчета
        foreach (var dto in dtos)
        {
            var booking = bookings.First(b => b.Id == dto.Id);
            dto.NumberOfNights = BookingCalculationHelper.CalculateUnits(booking.CheckInDate, booking.CheckOutDate, settings);
        }

        return dtos;
    }

    public async Task<BookingDto> GetBookingByIdAsync(Guid id, Guid clientId)
    {
        var booking = await _bookingRepository.GetByIdAndClientIdAsync(id, clientId);

        if (booking == null)
            throw new NotFoundException("Бронирование", id);

        var dto = _mapper.Map<BookingDto>(booking);

        // Пересчитываем NumberOfNights с учетом текущего режима расчета
        var settings = await GetOrCreateSettingsAsync();
        dto.NumberOfNights = BookingCalculationHelper.CalculateUnits(booking.CheckInDate, booking.CheckOutDate, settings);

        return dto;
    }

    public async Task<BookingDto> CreateBookingAsync(CreateBookingRequest request, Guid clientId)
    {
        // Проверяем, что выбраны питомцы
        if (request.PetIds == null || request.PetIds.Count == 0)
            throw new BadRequestException("Необходимо выбрать хотя бы одного питомца");

        // Если сегментов больше 1 - это составное бронирование
        if (request.Segments != null && request.Segments.Count > 1)
        {
            return await CreateCompositeBookingAsync(request, clientId);
        }

        // Если сегмент 1 - превращаем его в простое бронирование
        if (request.Segments != null && request.Segments.Count == 1)
        {
            var segment = request.Segments[0];
            request.RoomTypeId = segment.RoomTypeId;
            request.CheckInDate = segment.CheckInDate;
            request.CheckOutDate = segment.CheckOutDate;
            request.AssignedRoomId = segment.AssignedRoomId;
            // Очищаем сегменты, чтобы CreateSimpleBookingAsync не запутался (хотя он их игнорирует)
            request.Segments = null;
        }

        return await CreateSimpleBookingAsync(request, clientId);
    }

    private async Task<BookingDto> CreateSimpleBookingAsync(CreateBookingRequest request, Guid clientId)
    {
        // Валидация для простого бронирования
        if (!request.RoomTypeId.HasValue)
            throw new BadRequestException("Не указан тип номера");
        if (!request.CheckInDate.HasValue)
            throw new BadRequestException("Не указана дата заезда");
        if (!request.CheckOutDate.HasValue)
            throw new BadRequestException("Не указана дата выезда");

        // Валидация дат
        if (request.CheckInDate.Value < DateTime.Now.Date)
            throw new BadRequestException("Дата заезда не может быть в прошлом");

        if (request.CheckOutDate.Value <= request.CheckInDate.Value)
            throw new BadRequestException("Дата выезда должна быть позже даты заезда");

        // Получаем настройки системы для расчета периода
        var settings = await GetOrCreateSettingsAsync();
        var bookingUnits = BookingCalculationHelper.CalculateUnits(
        request.CheckInDate.Value,
        request.CheckOutDate.Value,
        settings);
        var minPeriod = BookingCalculationHelper.GetMinimumPeriod(settings.CalculationMode);
        var unitName = BookingCalculationHelper.GetUnitName(settings.CalculationMode, bookingUnits);

        if (bookingUnits < minPeriod)
            throw new BadRequestException($"Минимальное бронирование - {minPeriod} {BookingCalculationHelper.GetUnitName(settings.CalculationMode, minPeriod)}. Выбранный период составляет {bookingUnits} {unitName}");

        // Проверяем существование типа номера
        var roomType = await _roomTypeRepository.GetActiveByIdAsync(request.RoomTypeId.Value);
        if (roomType == null)
            throw new NotFoundException("Тип номера", request.RoomTypeId.Value);

        // Проверяем вместимость
        if (request.PetIds.Count > roomType.MaxCapacity)
            throw new BadRequestException($"Номер вмещает максимум {roomType.MaxCapacity} питомцев");

        // Проверяем доступность
        Room? availableRoom = null;

        // Если указан конкретный номер - проверяем его
        if (request.AssignedRoomId.HasValue)
        {
            var assignedRoom = await _roomRepository.GetByIdAsync(request.AssignedRoomId.Value);
            if (assignedRoom == null)
                throw new NotFoundException("Номер", request.AssignedRoomId.Value);

            if (assignedRoom.RoomTypeId != request.RoomTypeId)
                throw new BadRequestException("Указанный номер не соответствует выбранному типу");

            if (!assignedRoom.IsActive)
                throw new BadRequestException("Указанный номер не активен");

            // Проверяем доступность с учетом режима расчета
            var overlappingBookings = await _bookingRepository.GetOverlappingBookingsAsync(
            request.AssignedRoomId.Value,
            request.CheckInDate.Value,
            request.CheckOutDate.Value
            );

            // Проверяем пересечения с учетом режима расчета
            var hasOverlap = overlappingBookings.Any(b =>
            BookingCalculationHelper.DoPeriodsOverlap(
            request.CheckInDate.Value,
            request.CheckOutDate.Value,
            b.CheckInDate,
            b.CheckOutDate,
            settings.CalculationMode));

            if (hasOverlap)
                throw new BadRequestException($"Номер {assignedRoom.RoomNumber} занят на выбранные даты");

            // Если все ок, используем этот номер
            availableRoom = assignedRoom;
        }
        else
        {
            // Иначе ищем любой свободный - используем проверку с учетом режима расчета
            var availableCount = await _roomTypeRepository.GetAvailableRoomsCountAsync(
            request.RoomTypeId.Value,
            request.CheckInDate.Value,
            request.CheckOutDate.Value
            );

            if (availableCount == 0)
                throw new BadRequestException("Нет свободных номеров выбранного типа на эти даты");

            // Получаем список всех номеров данного типа и проверяем доступность каждого
            var roomsOfType = await _roomRepository.GetByRoomTypeIdAsync(request.RoomTypeId.Value);
            var roomsWithCapacity = roomsOfType.Where(r => r.RoomType.MaxCapacity >= request.PetIds.Count && r.IsActive);

            // Проверяем каждый номер на доступность с учетом режима расчета
            foreach (var room in roomsWithCapacity)
            {
                var overlappingBookings = await _bookingRepository.GetOverlappingBookingsAsync(
                room.Id,
                request.CheckInDate.Value,
                request.CheckOutDate.Value
                );

                var hasOverlap = overlappingBookings.Any(b =>
                BookingCalculationHelper.DoPeriodsOverlap(
                request.CheckInDate.Value,
                request.CheckOutDate.Value,
                b.CheckInDate,
                b.CheckOutDate,
                settings.CalculationMode));

                if (!hasOverlap)
                {
                    availableRoom = room;
                    break;
                }
            }

            if (availableRoom == null)
                throw new BadRequestException("Нет свободных номеров выбранного типа на эти даты");
        }

        // Рассчитываем цену (используем bookingUnits рассчитанный ранее)
        var basePrice = roomType.PricePerNight * bookingUnits;
        var additionalPetsCount = Math.Max(0, request.PetIds.Count - 1);
        var additionalPetsPrice = roomType.PricePerAdditionalPet * additionalPetsCount * bookingUnits;
        var discountPercent = await GetClientDiscountPercentAsync(clientId);
        var totalBeforeDiscount = basePrice + additionalPetsPrice;
        var (totalPrice, discountAmount, appliedDiscount) = ApplyDiscountWithBreakdown(totalBeforeDiscount, discountPercent);

        // Начинаем транзакцию
        await _unitOfWork.BeginTransactionAsync();

        try
        {
            // Создаем бронирование
            var booking = new Booking
            {
                ClientId = clientId,
                RoomTypeId = request.RoomTypeId.Value,
                AssignedRoomId = request.AssignedRoomId,
                CheckInDate = DateTime.SpecifyKind(request.CheckInDate.Value.Date, DateTimeKind.Unspecified),
                CheckOutDate = DateTime.SpecifyKind(request.CheckOutDate.Value.Date, DateTimeKind.Unspecified),
                NumberOfPets = request.PetIds.Count,
                Status = BookingStatus.Pending,
                BasePrice = basePrice,
                AdditionalPetsPrice = additionalPetsPrice,
                ServicesPrice = 0,
                DiscountPercent = appliedDiscount,
                DiscountAmount = discountAmount,
                TotalPrice = totalPrice,
                SpecialRequests = request.SpecialRequests,
                PaymentApproved = false,
                RequiredPrepaymentAmount = 0,
                IsComposite = false
            };

            await _bookingRepository.AddAsync(booking);
            await _unitOfWork.SaveChangesAsync();

            // Добавляем питомцев
            var bookingPets = request.PetIds.Select(petId => new BookingPet
            {
                BookingId = booking.Id,
                PetId = petId
            }).ToList();

            await _bookingPetRepository.AddRangeAsync(bookingPets);
            await _unitOfWork.SaveChangesAsync();

            await _unitOfWork.CommitTransactionAsync();

            // Небольшая задержка для обеспечения синхронизации данных после коммита транзакции
            await Task.Delay(50);

            var createdBooking = await GetBookingByIdAsync(booking.Id, clientId);
            return createdBooking;
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync();
            throw;
        }
    }

    private async Task<BookingDto> CreateCompositeBookingAsync(CreateBookingRequest request, Guid clientId)
    {
        if (request.Segments == null || !request.Segments.Any())
            throw new BadRequestException("Не указаны сегменты бронирования");

        var settings = await GetOrCreateSettingsAsync();
        var discountPercent = await GetClientDiscountPercentAsync(clientId);
        var minPeriod = BookingCalculationHelper.GetMinimumPeriod(settings.CalculationMode);

        // Валидация сегментов
        for (int i = 0; i < request.Segments.Count; i++)
        {
            var segment = request.Segments[i];

            if (segment.CheckInDate < DateTime.Now.Date)
                throw new BadRequestException($"Дата заезда в сегменте {i + 1} не может быть в прошлом");

            if (segment.CheckOutDate <= segment.CheckInDate)
                throw new BadRequestException($"Дата выезда в сегменте {i + 1} должна быть позже даты заезда");

            // Проверяем минимальный период с учетом режима
            var segmentUnits = BookingCalculationHelper.CalculateUnits(segment.CheckInDate, segment.CheckOutDate, settings);
            var unitName = BookingCalculationHelper.GetUnitName(settings.CalculationMode, segmentUnits);
            if (segmentUnits < minPeriod)
                throw new BadRequestException($"Минимальное бронирование - {minPeriod} {BookingCalculationHelper.GetUnitName(settings.CalculationMode, minPeriod)}. Сегмент {i + 1} имеет длину {segmentUnits} {unitName}");

            // Проверяем, что сегменты идут последовательно с учетом режима
            if (i > 0)
            {
                var previousCheckOut = request.Segments[i - 1].CheckOutDate;
                if (!BookingCalculationHelper.AreSegmentsSequential(previousCheckOut, segment.CheckInDate, settings.CalculationMode))
                {
                    var expectedDate = settings.CalculationMode == BookingCalculationMode.Days
                    ? previousCheckOut.AddDays(1)
                    : previousCheckOut; // В режиме ночей может быть тот же день или следующий
                    throw new BadRequestException($"Сегмент {i + 1} должен следовать сразу после сегмента {i} " +
                    $"(ожидается {expectedDate:dd.MM.yyyy} или позже, получено {segment.CheckInDate:dd.MM.yyyy})");
                }
            }
        }

        // Проверяем доступность и вместимость для каждого сегмента
        decimal totalPrice = 0;
        var segmentPrices = new List<(RoomType RoomType, int Nights, decimal BasePrice, decimal AdditionalPrice)>();

        for (int i = 0; i < request.Segments.Count; i++)
        {
            var segment = request.Segments[i];

            var roomType = await _roomTypeRepository.GetActiveByIdAsync(segment.RoomTypeId);
            if (roomType == null)
                throw new NotFoundException("Тип номера", segment.RoomTypeId);

            // Проверяем вместимость
            if (request.PetIds.Count > roomType.MaxCapacity)
                throw new BadRequestException($"Номер вмещает максимум {roomType.MaxCapacity} питомцев (сегмент {i + 1})");

            if (segment.AssignedRoomId.HasValue)
            {
                var assignedRoom = await _roomRepository.GetByIdAsync(segment.AssignedRoomId.Value);
                if (assignedRoom == null)
                    throw new NotFoundException("Номер", segment.AssignedRoomId.Value);

                if (assignedRoom.RoomTypeId != segment.RoomTypeId)
                    throw new BadRequestException($"Указанный номер не соответствует выбранному типу (сегмент {i + 1})");

                if (!assignedRoom.IsActive)
                    throw new BadRequestException($"Указанный номер не активен (сегмент {i + 1})");

                // Проверяем доступность с учетом режима расчета
                var overlappingBookings = await _bookingRepository.GetOverlappingBookingsAsync(
                segment.AssignedRoomId.Value,
                segment.CheckInDate,
                segment.CheckOutDate
                );

                // Проверяем пересечения с учетом режима расчета
                var hasOverlap = overlappingBookings.Any(b =>
                BookingCalculationHelper.DoPeriodsOverlap(
                segment.CheckInDate,
                segment.CheckOutDate,
                b.CheckInDate,
                b.CheckOutDate,
                settings.CalculationMode));

                if (hasOverlap)
                    throw new BadRequestException($"Номер {assignedRoom.RoomNumber} занят на выбранные даты (сегмент {i + 1})");
            }

            var units = BookingCalculationHelper.CalculateUnits(segment.CheckInDate, segment.CheckOutDate, settings);
            var basePrice = roomType.PricePerNight * units;
            var additionalPetsCount = Math.Max(0, request.PetIds.Count - 1);
            var additionalPrice = roomType.PricePerAdditionalPet * additionalPetsCount * units;

            segmentPrices.Add((roomType, units, basePrice, additionalPrice));
            totalPrice += basePrice + additionalPrice;
        }

        // Начинаем транзакцию
        await _unitOfWork.BeginTransactionAsync();

        try
        {
            // Создаем родительское бронирование
            var firstSegment = request.Segments.First();
            var lastSegment = request.Segments.Last();

            var (parentTotal, parentDiscountAmount, appliedDiscount) = ApplyDiscountWithBreakdown(totalPrice, discountPercent);

            var parentBooking = new Booking
            {
                ClientId = clientId,
                RoomTypeId = firstSegment.RoomTypeId, // Используем тип первого сегмента
                AssignedRoomId = null,
                CheckInDate = DateTime.SpecifyKind(firstSegment.CheckInDate.Date, DateTimeKind.Unspecified),
                CheckOutDate = DateTime.SpecifyKind(lastSegment.CheckOutDate.Date, DateTimeKind.Unspecified),
                NumberOfPets = request.PetIds.Count,
                Status = BookingStatus.Pending,
                BasePrice = totalPrice,
                AdditionalPetsPrice = 0, // Уже включено в BasePrice
                ServicesPrice = 0,
                DiscountPercent = appliedDiscount,
                DiscountAmount = parentDiscountAmount,
                TotalPrice = parentTotal,
                SpecialRequests = request.SpecialRequests,
                PaymentApproved = false,
                RequiredPrepaymentAmount = 0,
                IsComposite = true,
                ParentBookingId = null,
                SegmentOrder = null
            };

            await _bookingRepository.AddAsync(parentBooking);
            await _unitOfWork.SaveChangesAsync();

            // Добавляем питомцев к родительскому бронированию
            var parentBookingPets = request.PetIds.Select(petId => new BookingPet
            {
                BookingId = parentBooking.Id,
                PetId = petId
            }).ToList();

            await _bookingPetRepository.AddRangeAsync(parentBookingPets);

            // Создаем дочерние бронирования для каждого сегмента
            for (int i = 0; i < request.Segments.Count; i++)
            {
                var segment = request.Segments[i];
                var (roomType, nights, basePrice, additionalPrice) = segmentPrices[i];

                var childBooking = new Booking
                {
                    ClientId = clientId,
                    RoomTypeId = segment.RoomTypeId,
                    AssignedRoomId = segment.AssignedRoomId,
                    CheckInDate = DateTime.SpecifyKind(segment.CheckInDate.Date, DateTimeKind.Unspecified),
                    CheckOutDate = DateTime.SpecifyKind(segment.CheckOutDate.Date, DateTimeKind.Unspecified),
                    NumberOfPets = request.PetIds.Count,
                    Status = BookingStatus.Pending,
                    BasePrice = basePrice,
                    AdditionalPetsPrice = additionalPrice,
                    ServicesPrice = 0,
                    DiscountPercent = appliedDiscount,
                    DiscountAmount = Math.Round((basePrice + additionalPrice) - ApplyDiscount(basePrice + additionalPrice, appliedDiscount), 2),
                    TotalPrice = ApplyDiscount(basePrice + additionalPrice, appliedDiscount),
                    SpecialRequests = null, // Специальные пожелания только у родительского
                    PaymentApproved = false,
                    RequiredPrepaymentAmount = 0,
                    IsComposite = false,
                    ParentBookingId = parentBooking.Id,
                    SegmentOrder = i + 1
                };

                await _bookingRepository.AddAsync(childBooking);

                // Добавляем питомцев к дочернему бронированию
                var childBookingPets = request.PetIds.Select(petId => new BookingPet
                {
                    BookingId = childBooking.Id,
                    PetId = petId
                }).ToList();

                await _bookingPetRepository.AddRangeAsync(childBookingPets);
            }

            await _unitOfWork.SaveChangesAsync();
            await _unitOfWork.CommitTransactionAsync();

            // Небольшая задержка для обеспечения синхронизации данных после коммита транзакции
            await Task.Delay(50);

            var createdBooking = await GetBookingByIdAsync(parentBooking.Id, clientId);
            return createdBooking;
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync();
            throw;
        }
    }

    public async Task<IEnumerable<RoomAvailabilityDto>> GetAvailableRoomsAsync(RoomAvailabilityRequest request, Guid clientId)
    {
        // Валидация
        if (request.CheckInDate < DateTime.Now.Date)
            throw new BadRequestException("Дата заезда не может быть в прошлом");

        if (request.CheckOutDate <= request.CheckInDate)
            throw new BadRequestException("Дата выезда должна быть позже даты заезда");

        if (request.NumberOfPets <= 0)
            throw new BadRequestException("Количество питомцев должно быть больше 0");

        // Получаем настройки и все типы номеров
        var settings = await GetOrCreateSettingsAsync();
        var roomTypes = await _roomTypeRepository.GetActiveRoomTypesAsync();
        var discountPercent = await GetClientDiscountPercentAsync(clientId);

        var availableRoomTypes = new List<RoomAvailabilityDto>();

        foreach (var roomType in roomTypes)
        {
            // Проверяем вместимость
            if (roomType.MaxCapacity < request.NumberOfPets)
                continue;

            // Проверяем доступность
            var availableCount = await _roomTypeRepository.GetAvailableRoomsCountAsync(
            roomType.Id, request.CheckInDate, request.CheckOutDate);

            if (availableCount == 0)
                continue;

            var bookingUnits = BookingCalculationHelper.CalculateUnits(request.CheckInDate, request.CheckOutDate, settings);
            var basePrice = roomType.PricePerNight * bookingUnits;
            var additionalPetsCount = Math.Max(0, request.NumberOfPets - 1);
            var additionalPetsPrice = roomType.PricePerAdditionalPet * additionalPetsCount * bookingUnits;
            var totalPrice = basePrice + additionalPetsPrice;
            var discountedTotal = ApplyDiscount(totalPrice, discountPercent);

            var roomTypeDto = _mapper.Map<DTOs.RoomTypes.RoomTypeDto>(roomType);
            roomTypeDto.AvailableRoomsCount = availableCount;

            availableRoomTypes.Add(new RoomAvailabilityDto
            {
                RoomType = roomTypeDto,
                TotalPrice = discountedTotal,
                PriceBreakdown = new PriceBreakdownDto
                {
                    BasePrice = basePrice,
                    AdditionalPetsPrice = additionalPetsPrice,
                    DiscountAmount = Math.Round(totalPrice - discountedTotal, 2),
                    LoyaltyDiscountPercent = discountPercent,
                    NumberOfNights = bookingUnits,
                    NumberOfPets = request.NumberOfPets
                }
            });
        }

        return availableRoomTypes.OrderBy(r => r.TotalPrice).ToList();
    }

    public async Task<ReceiptDto> GetReceiptAsync(Guid bookingId, Guid clientId, bool isAdmin)
    {
        var booking = await _bookingRepository.GetByIdAsync(bookingId, includeDetails: true)
        ?? await _bookingRepository.GetByIdWithDetailsAsync(bookingId);

        if (booking == null || (!isAdmin && booking.ClientId != clientId))
            throw new NotFoundException("Бронирование", bookingId);

        var settings = await GetOrCreateSettingsAsync();
        var payments = await _paymentRepository.GetByBookingIdAsync(bookingId);
        var bookingUnits = BookingCalculationHelper.CalculateUnits(booking.CheckInDate, booking.CheckOutDate, settings);
        var paid = payments.Where(p => p.PaymentStatus == PaymentStatus.Completed).Sum(p => p.Amount);
        var subtotal = booking.BasePrice + booking.AdditionalPetsPrice + booking.ServicesPrice;
        var discountPercent = booking.DiscountPercent;
        if (discountPercent <= 0)
        {
            discountPercent = await GetClientDiscountPercentAsync(booking.ClientId);
        }
        var discountAmount = booking.DiscountAmount > 0 ? booking.DiscountAmount : Math.Round(subtotal - ApplyDiscount(subtotal, discountPercent), 2);
        var total = ApplyDiscount(subtotal, discountPercent);
        var remaining = total - paid;

        var unitName = BookingCalculationHelper.GetUnitName(settings.CalculationMode, bookingUnits);
        var lines = new List<ReceiptLineDto>
 {
 new ReceiptLineDto
 {
 Title = "Проживание",
 Details = $"{bookingUnits} {unitName}",
 Amount = booking.BasePrice
 },
 new ReceiptLineDto
 {
 Title = "Дополнительные питомцы",
 Details = booking.NumberOfPets > 1 ? $"{Math.Max(0, booking.NumberOfPets - 1)} питомца" : "Без доп. питомцев",
 Amount = booking.AdditionalPetsPrice
 }
 };

        if (booking.ServicesPrice > 0)
        {
            lines.Add(new ReceiptLineDto
            {
                Title = "Дополнительные услуги",
                Amount = booking.ServicesPrice
            });
        }

        if (discountAmount > 0)
        {
            lines.Add(new ReceiptLineDto
            {
                Title = "Скидка",
                Details = $"{discountPercent}% на бронирование",
                Amount = Math.Round(-discountAmount, 2)
            });
        }

        var receiptPayments = payments
        .OrderByDescending(p => p.CreatedAt)
        .Select(p => new ReceiptPaymentDto
        {
            Id = p.Id,
            Amount = p.Amount,
            PaymentMethod = p.PaymentMethod,
            PaymentStatus = p.PaymentStatus,
            PaymentType = p.PaymentType,
            CreatedAt = p.CreatedAt,
            PaidAt = p.PaidAt,
            TransactionId = p.TransactionId
        })
        .ToList();

        return new ReceiptDto
        {
            BookingId = booking.Id,
            BookingNumber = booking.Id.ToString("N")[..8],
            CheckInDate = booking.CheckInDate,
            CheckOutDate = booking.CheckOutDate,
            NumberOfNights = bookingUnits,
            RoomTypeName = booking.RoomType?.Name ?? string.Empty,
            DiscountPercent = discountPercent,
            DiscountAmount = discountAmount,
            Subtotal = subtotal,
            Total = total,
            Paid = paid,
            Remaining = Math.Max(remaining, 0),
            RefundDue = remaining < 0 ? Math.Abs(remaining) : 0,
            ClientName = booking.Client != null ? $"{booking.Client.FirstName} {booking.Client.LastName}".Trim() : string.Empty,
            ClientEmail = booking.Client?.User?.Email ?? string.Empty,
            ClientPhone = booking.Client?.Phone ?? string.Empty,
            Pets = booking.BookingPets?.Select(bp => new PetSummaryDto
            {
                Id = bp.PetId,
                Name = bp.Pet.Name,
                Species = (int)bp.Pet.Species,
                Gender = (int)bp.Pet.Gender
            }).ToList() ?? new List<PetSummaryDto>(),
            Lines = lines,
            Payments = receiptPayments
        };
    }

    public async Task CancelBookingAsync(Guid id, Guid clientId)
    {
        var booking = await _bookingRepository.GetByIdAndClientIdAsync(id, clientId);

        if (booking == null)
            throw new NotFoundException("Бронирование", id);

        // Проверяем, можно ли отменить
        if (booking.Status == BookingStatus.CheckedOut)
            throw new BadRequestException("Невозможно отменить завершенное бронирование");

        if (booking.Status == BookingStatus.Cancelled)
            throw new BadRequestException("Бронирование уже отменено");

        // Проверяем, не начался ли уже период бронирования
        if (booking.CheckInDate <= DateTime.Now.Date)
            throw new BadRequestException("Невозможно отменить бронирование после даты заезда");

        // Проверяем, не было ли оплаты
        var payments = await _paymentRepository.GetByBookingIdAsync(id);
        var hasCompletedPayments = payments.Any(p => p.PaymentStatus == PaymentStatus.Completed);

        if (hasCompletedPayments)
            throw new BadRequestException("Невозможно отменить бронирование после внесения оплаты. Пожалуйста, свяжитесь с администрацией для возврата средств.");

        // Отменяем бронирование
        booking.Status = BookingStatus.Cancelled;
        await _bookingRepository.UpdateAsync(booking);
        await _unitOfWork.SaveChangesAsync();

        var dto = _mapper.Map<BookingDto>(booking);
    }

    public async Task<IEnumerable<RoomBookingCalendarDto>> GetRoomCalendarAsync(Guid roomId, DateTime from, DateTime to)
    {
        if (from >= to)
            throw new BadRequestException("Дата 'до' должна быть позже даты 'с'");

        var normalizedFrom = from.Date;
        var normalizedTo = to.Date;

        // ограничиваем диапазон, чтобы избежать чрезмерных запросов
        if ((normalizedTo - normalizedFrom).TotalDays > 180)
            throw new BadRequestException("Диапазон не должен превышать 180 дней");

        var bookings = await _bookingRepository.GetRoomBookingsInRangeAsync(roomId, normalizedFrom, normalizedTo);

        return bookings.Select(b => new RoomBookingCalendarDto
        {
            BookingId = b.Id,
            RoomId = b.AssignedRoomId ?? Guid.Empty,
            CheckInDate = b.CheckInDate,
            CheckOutDate = b.CheckOutDate,
            Status = b.Status.ToString()
        });
    }

    private async Task<decimal> GetClientDiscountPercentAsync(Guid clientId)
    {
        var client = await _clientRepository.GetByIdAsync(clientId);
        return NormalizeDiscount(client?.LoyaltyDiscountPercent ?? 0);
    }

    private static decimal ApplyDiscount(decimal amount, decimal discountPercent)
    {
        if (amount <= 0)
            return 0;
        var normalized = NormalizeDiscount(discountPercent);
        if (normalized <= 0)
            return Math.Round(amount, 2);
        var discounted = amount * (1 - normalized / 100m);
        return Math.Round(discounted, 2);
    }

    private static (decimal Total, decimal DiscountAmount, decimal AppliedPercent) ApplyDiscountWithBreakdown(decimal amount, decimal percent)
    {
        var normalized = NormalizeDiscount(percent);
        var total = ApplyDiscount(amount, normalized);
        return (total, Math.Round(amount - total, 2), normalized);
    }

    private static decimal NormalizeDiscount(decimal value)
    {
        if (value < 0)
            return 0;
        if (value > 100)
            return 100;
        return Math.Round(value, 2);
    }

    public async Task<BookingDto> MergeBookingsAsync(List<Guid> bookingIds)
    {
        if (bookingIds == null || bookingIds.Count < 2)
            throw new BadRequestException("Для объединения нужно минимум 2 бронирования");

        // Загружаем все бронирования
        var bookings = new List<Booking>();
        foreach (var id in bookingIds)
        {
            var booking = await _bookingRepository.GetByIdAsync(id);
            if (booking == null)
                throw new NotFoundException("Бронирование", id);
            bookings.Add(booking);
        }

        // Проверки
        var firstBooking = bookings.First();
        var clientId = firstBooking.ClientId;

        if (bookings.Any(b => b.ClientId != clientId))
            throw new BadRequestException("Все бронирования должны принадлежать одному клиенту");

        if (bookings.Any(b => b.IsComposite || b.ParentBookingId.HasValue))
            throw new BadRequestException("Нельзя объединять уже составные бронирования или их части");

        // Получаем настройки для проверки последовательности с учетом режима расчета
        var settings = await GetOrCreateSettingsAsync();

        // Сортируем по дате
        bookings = bookings.OrderBy(b => b.CheckInDate).ToList();

        // Проверяем последовательность с учетом режима расчета
        for (int i = 0; i < bookings.Count - 1; i++)
        {
            if (!BookingCalculationHelper.AreSegmentsSequential(
            bookings[i].CheckOutDate,
            bookings[i + 1].CheckInDate,
            settings.CalculationMode))
            {
                var expectedDate = settings.CalculationMode == BookingCalculationMode.Days
                ? bookings[i].CheckOutDate.AddDays(1)
                : bookings[i].CheckOutDate; // В режиме ночей может быть тот же день или следующий
                throw new BadRequestException($"Бронирования должны идти последовательно без разрывов. Разрыв между {bookings[i].CheckOutDate:dd.MM.yyyy} и {bookings[i + 1].CheckInDate:dd.MM.yyyy}. Ожидается {expectedDate:dd.MM.yyyy} или позже");
            }
        }

        // Создаем родительское бронирование
        var totalBasePrice = bookings.Sum(b => b.BasePrice);
        var totalAdditionalPrice = bookings.Sum(b => b.AdditionalPetsPrice);
        var discountPercent = await GetClientDiscountPercentAsync(clientId);
        var (totalPrice, discountAmount, appliedDiscount) = ApplyDiscountWithBreakdown(totalBasePrice + totalAdditionalPrice, discountPercent);

        // Берем питомцев из всех бронирований и объединяем
        var allPetIds = new HashSet<Guid>();
        foreach (var b in bookings)
        {
            if (b.BookingPets != null)
            {
                foreach (var bp in b.BookingPets)
                {
                    allPetIds.Add(bp.PetId);
                }
            }
        }

        await _unitOfWork.BeginTransactionAsync();

        try
        {
            var parentBooking = new Booking
            {
                ClientId = clientId,
                RoomTypeId = firstBooking.RoomTypeId, // Тип первого номера
                AssignedRoomId = null,
                CheckInDate = bookings.First().CheckInDate,
                CheckOutDate = bookings.Last().CheckOutDate,
                NumberOfPets = allPetIds.Count,
                Status = BookingStatus.Pending,
                BasePrice = totalBasePrice + totalAdditionalPrice,
                AdditionalPetsPrice = 0,
                ServicesPrice = 0,
                DiscountPercent = appliedDiscount,
                DiscountAmount = discountAmount,
                TotalPrice = totalPrice,
                SpecialRequests = string.Join("; ", bookings.Where(b => !string.IsNullOrEmpty(b.SpecialRequests)).Select(b => b.SpecialRequests)),
                PaymentApproved = false,
                RequiredPrepaymentAmount = 0,
                IsComposite = true,
                ParentBookingId = null,
                SegmentOrder = null
            };

            await _bookingRepository.AddAsync(parentBooking);
            await _unitOfWork.SaveChangesAsync();

            // Привязываем питомцев к родителю
            var parentPets = allPetIds.Select(pid => new BookingPet { BookingId = parentBooking.Id, PetId = pid }).ToList();
            await _bookingPetRepository.AddRangeAsync(parentPets);

            // Обновляем дочерние бронирования
            for (int i = 0; i < bookings.Count; i++)
            {
                var b = bookings[i];
                b.ParentBookingId = parentBooking.Id;
                b.IsComposite = false;
                b.SegmentOrder = i + 1;

                // Пересчитываем скидку для дочерних, чтобы она соответствовала родительской
                b.DiscountPercent = appliedDiscount;
                var childTotalRaw = b.BasePrice + b.AdditionalPetsPrice;
                b.TotalPrice = ApplyDiscount(childTotalRaw, appliedDiscount);
                b.DiscountAmount = Math.Round(childTotalRaw - b.TotalPrice, 2);

                await _bookingRepository.UpdateAsync(b);
            }

            await _unitOfWork.SaveChangesAsync();
            await _unitOfWork.CommitTransactionAsync();

            // Небольшая задержка для обеспечения синхронизации данных после коммита транзакции
            await Task.Delay(50);

            var createdBooking = await GetBookingByIdAsync(parentBooking.Id, clientId);
            return createdBooking;
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync();
            throw;
        }
    }

    /// <summary>
    /// Получить или создать настройки системы бронирования.
    /// </summary>
    private async Task<BookingSettings> GetOrCreateSettingsAsync()
    {
        var settings = await _settingsRepository.GetSingletonAsync();

        if (settings == null)
        {
            // Создаем дефолтные настройки с режимом "по дням"
            settings = new BookingSettings
            {
                Id = Guid.Parse("00000000-0000-0000-0000-000000000001"),
                CalculationMode = BookingCalculationMode.Days,
                CheckInTime = new TimeSpan(15, 0, 0),
                CheckOutTime = new TimeSpan(12, 0, 0),
                IsSingleton = true
            };

            await _settingsRepository.AddAsync(settings);
            await _unitOfWork.SaveChangesAsync();
        }

        return settings;
    }
}
