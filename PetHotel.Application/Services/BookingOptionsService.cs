using System;
using PetHotel.Application.Common.Exceptions;
using PetHotel.Application.Common.Helpers;
using PetHotel.Application.DTOs.Bookings;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using PetHotel.Domain.Interfaces;

namespace PetHotel.Application.Services;

/// <summary>
/// Сервис для поиска различных вариантов бронирования, включая составные с переездами.
/// </summary>
public class BookingOptionsService
{
    private readonly IRoomTypeRepository _roomTypeRepository;
    private readonly IRoomRepository _roomRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly IBookingSettingsRepository _settingsRepository;
    private readonly IUnitOfWork _unitOfWork;

    private static readonly Guid SettingsSingletonId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    public BookingOptionsService(
    IRoomTypeRepository roomTypeRepository,
    IRoomRepository roomRepository,
    IBookingRepository bookingRepository,
    IBookingSettingsRepository settingsRepository,
    IUnitOfWork unitOfWork)
    {
        _roomTypeRepository = roomTypeRepository;
        _roomRepository = roomRepository;
        _bookingRepository = bookingRepository;
        _settingsRepository = settingsRepository;
        _unitOfWork = unitOfWork;
    }

    /// <summary>
    /// Ищет все возможные варианты бронирования для заданного периода.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    public async Task<BookingOptionsResponseDto> FindBookingOptionsAsync(
    DateTime checkInDate,
    DateTime checkOutDate,
    int numberOfPets,
    decimal clientDiscountPercent = 0)
    {
        // Валидация
        if (checkInDate < DateTime.Now.Date)
            throw new BadRequestException("Дата заезда не может быть в прошлом");

        if (checkOutDate <= checkInDate)
            throw new BadRequestException("Дата выезда должна быть позже даты заезда");

        if (numberOfPets <= 0)
            throw new BadRequestException("Количество питомцев должно быть больше 0");

        var response = new BookingOptionsResponseDto
        {
            CheckInDate = checkInDate,
            CheckOutDate = checkOutDate,
            NumberOfPets = numberOfPets
        };
        var discountPercent = NormalizeDiscount(clientDiscountPercent);

        // Получаем все активные типы номеров, подходящие по вместимости
        var allRoomTypes = await _roomTypeRepository.GetActiveRoomTypesAsync();
        var suitableRoomTypes = allRoomTypes
        .Where(rt => rt.MaxCapacity >= numberOfPets)
        .OrderBy(rt => rt.PricePerNight)
        .ToList();

        if (!suitableRoomTypes.Any())
            return response;

        // 1. Ищем варианты с одним номером на весь период (идеальные)
        var singleRoomOptions = await FindSingleRoomOptionsAsync(
        checkInDate, checkOutDate, numberOfPets, suitableRoomTypes);
        response.SingleRoomOptions = ApplyDiscountToOptions(singleRoomOptions, discountPercent);

        // Если есть идеальные варианты, помечаем это
        response.HasPerfectOptions = singleRoomOptions.Any();

        // 2. Если нет идеальных вариантов или их мало, ищем варианты с переездами в пределах одного типа
        if (singleRoomOptions.Count < 3)
        {
            var sameTypeOptions = await FindSameTypeTransferOptionsAsync(
            checkInDate, checkOutDate, numberOfPets, suitableRoomTypes);
            response.SameTypeTransferOptions = ApplyDiscountToOptions(sameTypeOptions, discountPercent);
        }

        // 3. Если всё ещё мало вариантов, ищем смешанные варианты (переезды между разными типами)
        if (singleRoomOptions.Count + response.SameTypeTransferOptions.Count < 5)
        {
            var mixedOptions = await FindMixedTypeTransferOptionsAsync(
            checkInDate, checkOutDate, numberOfPets, suitableRoomTypes);
            response.MixedTypeTransferOptions = ApplyDiscountToOptions(mixedOptions, discountPercent);
        }

        // Сортируем прямые варианты по цене (от дешевых к дорогим)
        // Возвращаем ВСЕ прямые варианты без ограничений
        response.SingleRoomOptions = response.SingleRoomOptions
        .OrderBy(o => o.TotalPrice)
        .ToList();

        // Для составных вариантов применяем ограничение
        // Объединяем составные варианты и берем топ-5 по цене
        var compositeOptions = new List<BookingOptionDto>();
        compositeOptions.AddRange(response.SameTypeTransferOptions);
        compositeOptions.AddRange(response.MixedTypeTransferOptions);

        var sortedCompositeOptions = compositeOptions
        .OrderBy(o => o.TotalPrice)
        .ThenBy(o => o.TransferCount) // При одинаковой цене - меньше переездов лучше
        .Take(5) // Берём максимум 5 составных вариантов
        .ToList();

        // Перераспределяем отсортированные составные варианты по категориям
        response.SameTypeTransferOptions.Clear();
        response.MixedTypeTransferOptions.Clear();

        foreach (var option in sortedCompositeOptions)
        {
            if (option.OptionType == "SameType")
                response.SameTypeTransferOptions.Add(option);
            else if (option.OptionType == "Mixed")
                response.MixedTypeTransferOptions.Add(option);
        }

        response.TotalOptions = response.SingleRoomOptions.Count + sortedCompositeOptions.Count;

        return response;
    }

    /// <summary>
    /// Ищет варианты с одним номером на весь период.
    /// </summary>
    private async Task<List<BookingOptionDto>> FindSingleRoomOptionsAsync(
    DateTime checkInDate,
    DateTime checkOutDate,
    int numberOfPets,
    List<RoomType> roomTypes)
    {
        var options = new List<BookingOptionDto>();
        var settings = await GetOrCreateSettingsAsync();

        foreach (var roomType in roomTypes)
        {
            // Проверяем доступность хотя бы одного номера данного типа на весь период
            var availableCount = await GetAvailableRoomsCountForPeriodAsync(
            roomType.Id, checkInDate, checkOutDate);

            if (availableCount > 0)
            {
                // Используем централизованный расчет единиц (дней/ночей)
                var units = BookingCalculationHelper.CalculateUnits(checkInDate, checkOutDate, settings);
                var basePrice = roomType.PricePerNight * units;
                var additionalPetsCount = Math.Max(0, numberOfPets - 1);
                var additionalPetsPrice = roomType.PricePerAdditionalPet * additionalPetsCount * units;
                var totalPrice = basePrice + additionalPetsPrice;

                var segment = new BookingSegmentDto
                {
                    CheckInDate = checkInDate,
                    CheckOutDate = checkOutDate,
                    RoomTypeId = roomType.Id,
                    RoomTypeName = roomType.Name,
                    SquareMeters = roomType.SquareMeters ?? 0,
                    MaxCapacity = roomType.MaxCapacity,
                    Nights = units,
                    Price = totalPrice,
                    MainPhotoUrl = GetMainPhotoUrl(roomType)
                };

                var option = new BookingOptionDto
                {
                    OptionType = "Single",
                    Segments = new List<BookingSegmentDto> { segment },
                    TotalPrice = totalPrice,
                    TotalNights = units,
                    TransferCount = 0,
                    Priority = 0,
                    PriceBreakdown = new PriceBreakdownDto
                    {
                        BasePrice = basePrice,
                        AdditionalPetsPrice = additionalPetsPrice,
                        NumberOfNights = units,
                        NumberOfPets = numberOfPets
                    }
                };

                options.Add(option);
            }
        }

        return options.OrderBy(o => o.TotalPrice).ToList();
    }

    /// <summary>
    /// Ищет варианты с переездами между номерами одного типа.
    /// </summary>
    private async Task<List<BookingOptionDto>> FindSameTypeTransferOptionsAsync(
    DateTime checkInDate,
    DateTime checkOutDate,
    int numberOfPets,
    List<RoomType> roomTypes)
    {
        var options = new List<BookingOptionDto>();
        var settings = await GetOrCreateSettingsAsync();

        foreach (var roomType in roomTypes)
        {
            // Ищем сегменты для этого типа номера
            var segments = await FindAvailableSegmentsForRoomTypeAsync(
            roomType, checkInDate, checkOutDate, numberOfPets);

            if (segments != null && segments.Count > 1)
            {
                // Проверяем, что сегменты покрывают весь период
                if (CoversPeriod(segments, checkInDate, checkOutDate, settings.CalculationMode))
                {
                    var totalPrice = segments.Sum(s => s.Price);
                    var totalNights = segments.Sum(s => s.Nights);
                    var transferCount = segments.Count - 1;

                    var option = new BookingOptionDto
                    {
                        OptionType = "SameType",
                        Segments = segments,
                        TotalPrice = totalPrice,
                        TotalNights = totalNights,
                        TransferCount = transferCount,
                        Priority = 1,
                        WarningMessage = $"Потребуется {transferCount} {GetTransferWord(transferCount)} между номерами одного типа. Цена остается неизменной."
                    };

                    options.Add(option);
                }
            }
        }

        return options.OrderBy(o => o.TransferCount).ThenBy(o => o.TotalPrice).ToList();
    }

    /// <summary>
    /// Ищет варианты с переездами между номерами разных типов.
    /// </summary>
    private async Task<List<BookingOptionDto>> FindMixedTypeTransferOptionsAsync(
    DateTime checkInDate,
    DateTime checkOutDate,
    int numberOfPets,
    List<RoomType> roomTypes)
    {
        var options = new List<BookingOptionDto>();

        // Используем динамическое программирование для поиска оптимальных комбинаций
        var combinations = await FindOptimalCombinationsAsync(
        checkInDate, checkOutDate, numberOfPets, roomTypes);

        foreach (var combination in combinations.Take(5)) // Ограничиваем 5 лучшими вариантами
        {
            if (combination.Segments.Count > 1)
            {
                var totalPrice = combination.Segments.Sum(s => s.Price);
                var totalNights = combination.Segments.Sum(s => s.Nights);
                var transferCount = combination.Segments.Count - 1;

                // Проверяем, что это действительно смешанный вариант (разные типы)
                var uniqueTypes = combination.Segments.Select(s => s.RoomTypeId).Distinct().Count();
                if (uniqueTypes > 1)
                {
                    var option = new BookingOptionDto
                    {
                        OptionType = "Mixed",
                        Segments = combination.Segments,
                        TotalPrice = totalPrice,
                        TotalNights = totalNights,
                        TransferCount = transferCount,
                        Priority = 2,
                        WarningMessage = $"Потребуется {transferCount} {GetTransferWord(transferCount)} между номерами разных типов. Цена может отличаться в зависимости от типа номера."
                    };

                    options.Add(option);
                }
            }
        }

        return options.OrderBy(o => o.TotalPrice).ThenBy(o => o.TransferCount).ToList();
    }

    /// <summary>
    /// Находит доступные сегменты для конкретного типа номера.
    /// </summary>
    private async Task<List<BookingSegmentDto>?> FindAvailableSegmentsForRoomTypeAsync(
    RoomType roomType,
    DateTime checkInDate,
    DateTime checkOutDate,
    int numberOfPets)
    {
        var settings = await GetOrCreateSettingsAsync();
        var totalRooms = await _roomRepository.GetCountByRoomTypeAsync(roomType.Id);
        if (totalRooms == 0)
            return null;

        // Получаем все бронирования для этого типа номера в период
        var bookings = await GetBookingsForRoomTypeInPeriodAsync(roomType.Id, checkInDate, checkOutDate);

        Console.WriteLine($"[SEGMENTS] Searching segments for {roomType.Name} from {checkInDate:dd.MM.yyyy} to {checkOutDate:dd.MM.yyyy}");
        Console.WriteLine($"[SEGMENTS] Found {bookings.Count()} existing bookings:");
        foreach (var b in bookings)
        {
            Console.WriteLine($" - Booking: {b.CheckInDate:dd.MM.yyyy} - {b.CheckOutDate:dd.MM.yyyy}, IsComposite={b.IsComposite}");
        }

        // Создаем карту доступности по дням
        var availabilityMap = new Dictionary<DateTime, bool>();
        var currentDate = checkInDate.Date;

        // ВАЖНО: Логика доступности зависит от режима расчета:
        // Days: День НЕДОСТУПЕН если все номера заняты ИЛИ это день CheckIn/CheckOut существующего бронирования
        // Nights: День выезда доступен для новых бронирований, день заезда частично доступен
        while (currentDate <= checkOutDate.Date)
        {
            // Считаем, сколько номеров занято в этот день
            // В режиме Nights день выезда не считается занятым
            var occupiedRooms = bookings.Count(b =>
            {
                if (settings.CalculationMode == BookingCalculationMode.Nights)
                {
                    // В режиме ночей: день занят только если это день заезда или день между заездом и выездом
                    // День выезда НЕ считается занятым
                    return b.CheckInDate.Date <= currentDate && b.CheckOutDate.Date > currentDate;
                }
                else
                {
                    // В режиме дней: день занят если он между заездом и выездом включительно
                    return b.CheckInDate.Date <= currentDate && b.CheckOutDate.Date >= currentDate;
                }
            });

            // Проверяем, является ли этот день днём заезда или выезда существующих бронирований
            var isCheckInDay = bookings.Any(b => b.CheckInDate.Date == currentDate);
            var isCheckOutDay = bookings.Any(b => b.CheckOutDate.Date == currentDate);

            // Определяем доступность в зависимости от режима
            bool isAvailable;
            if (settings.CalculationMode == BookingCalculationMode.Nights)
            {
                // В режиме ночей:
                // - День выезда доступен (можно начинать новое бронирование в этот день)
                // - День заезда доступен если не все номера заняты (можно заканчивать новое бронирование)
                // - Если день является и заездом, и выездом - доступен если есть свободные номера
                // - Обычный день доступен если не все номера заняты
                if (isCheckOutDay && !isCheckInDay)
                {
                    // День выезда (но не заезда) всегда доступен для начала нового бронирования
                    isAvailable = true;
                }
                else if (isCheckInDay && !isCheckOutDay)
                {
                    // День заезда (но не выезда) доступен если есть свободные номера (можно заканчивать бронирование)
                    isAvailable = occupiedRooms < totalRooms;
                }
                else if (isCheckInDay && isCheckOutDay)
                {
                    // День является и заездом, и выездом - доступен если есть свободные номера
                    isAvailable = occupiedRooms < totalRooms;
                }
                else
                {
                    // Обычный день доступен если есть свободные номера
                    isAvailable = occupiedRooms < totalRooms;
                }
            }
            else
            {
                // В режиме дней: день недоступен если все номера заняты ИЛИ это день заезда/выезда
                isAvailable = occupiedRooms < totalRooms && !isCheckInDay && !isCheckOutDay;
            }

            availabilityMap[currentDate] = isAvailable;

            Console.WriteLine($"[AVAIL] {currentDate:dd.MM} - mode:{settings.CalculationMode}, occupied:{occupiedRooms}/{totalRooms}, CheckIn:{isCheckInDay}, CheckOut:{isCheckOutDay} => {isAvailable}");

            currentDate = currentDate.AddDays(1);
        }

        // Находим непрерывные сегменты, где есть хотя бы один свободный номер
        var segments = new List<BookingSegmentDto>();
        DateTime? segmentStart = null;

        currentDate = checkInDate.Date;
        // ВАЖНО: Проверяем до CheckOutDate включительно
        while (currentDate <= checkOutDate.Date)
        {
            var available = availabilityMap.GetValueOrDefault(currentDate, false);

            if (available)
            {
                if (segmentStart == null)
                {
                    segmentStart = currentDate;
                }
            }
            else
            {
                if (segmentStart != null)
                {
                    // Заканчиваем текущий сегмент
                    // ВАЖНО: currentDate - это ПЕРВЫЙ ЗАНЯТЫЙ день, CheckOutDate должен быть на день раньше (последний свободный)
                    var segmentEnd = currentDate.AddDays(-1);
                    var units = BookingCalculationHelper.CalculateUnits(segmentStart.Value, segmentEnd, settings);
                    var minPeriod = BookingCalculationHelper.GetMinimumPeriod(settings.CalculationMode);

                    // Проверяем минимальное бронирование
                    if (units >= minPeriod)
                    {
                        var basePrice = roomType.PricePerNight * units;
                        var additionalPetsCount = Math.Max(0, numberOfPets - 1);
                        var additionalPetsPrice = roomType.PricePerAdditionalPet * additionalPetsCount * units;

                        segments.Add(new BookingSegmentDto
                        {
                            CheckInDate = segmentStart.Value,
                            CheckOutDate = segmentEnd,
                            RoomTypeId = roomType.Id,
                            RoomTypeName = roomType.Name,
                            SquareMeters = roomType.SquareMeters ?? 0,
                            MaxCapacity = roomType.MaxCapacity,
                            Nights = units,
                            Price = basePrice + additionalPetsPrice,
                            MainPhotoUrl = GetMainPhotoUrl(roomType)
                        });
                    }

                    segmentStart = null;
                }
            }

            currentDate = currentDate.AddDays(1);
        }

        // Закрываем последний сегмент, если он открыт (достигли конца периода)
        if (segmentStart != null)
        {
            // Используем централизованный расчет единиц
            var units = BookingCalculationHelper.CalculateUnits(segmentStart.Value, checkOutDate.Date, settings);
            var minPeriod = BookingCalculationHelper.GetMinimumPeriod(settings.CalculationMode);

            // Проверяем минимальное бронирование
            if (units >= minPeriod)
            {
                var basePrice = roomType.PricePerNight * units;
                var additionalPetsCount = Math.Max(0, numberOfPets - 1);
                var additionalPetsPrice = roomType.PricePerAdditionalPet * additionalPetsCount * units;

                segments.Add(new BookingSegmentDto
                {
                    CheckInDate = segmentStart.Value,
                    CheckOutDate = checkOutDate.Date,
                    RoomTypeId = roomType.Id,
                    RoomTypeName = roomType.Name,
                    SquareMeters = roomType.SquareMeters ?? 0,
                    MaxCapacity = roomType.MaxCapacity,
                    Nights = units,
                    Price = basePrice + additionalPetsPrice,
                    MainPhotoUrl = GetMainPhotoUrl(roomType)
                });
            }
        }

        // Возвращаем найденные сегменты (даже если они не покрывают весь период)
        // RecursiveFindCombinations будет комбинировать их с другими типами номеров
        if (!segments.Any())
        {
            Console.WriteLine($"[SEGMENTS] No segments found for {roomType.Name}");
            return null;
        }

        Console.WriteLine($"[SEGMENTS] Found {segments.Count} segment(s) for {roomType.Name}:");
        foreach (var seg in segments)
        {
            Console.WriteLine($" - Segment: {seg.CheckInDate:dd.MM.yyyy} - {seg.CheckOutDate:dd.MM.yyyy} ({seg.Nights} nights)");
        }

        return segments;
    }

    /// <summary>
    /// Находит оптимальные комбинации номеров разных типов.
    /// </summary>
    private async Task<List<BookingOptionDto>> FindOptimalCombinationsAsync(
    DateTime checkInDate,
    DateTime checkOutDate,
    int numberOfPets,
    List<RoomType> roomTypes)
    {
        var results = new List<BookingOptionDto>();
        var cache = new Dictionary<string, DateTime>(); // Кэш для maxEndDate

        // Используем рекурсивный поиск с ограничением глубины
        await RecursiveFindCombinations(
        checkInDate, checkOutDate, numberOfPets, roomTypes,
        new List<BookingSegmentDto>(), results, cache, maxDepth: 4);

        return results;
    }

    /// <summary>
    /// Рекурсивно ищет комбинации сегментов.
    /// </summary>
    private async Task RecursiveFindCombinations(
    DateTime currentDate,
    DateTime endDate,
    int numberOfPets,
    List<RoomType> roomTypes,
    List<BookingSegmentDto> currentSegments,
    List<BookingOptionDto> results,
    Dictionary<string, DateTime> cache,
    int maxDepth)
    {
        // Если достигли конца периода, сохраняем комбинацию
        if (currentDate >= endDate)
        {
            if (currentSegments.Any())
            {
                results.Add(new BookingOptionDto
                {
                    Segments = new List<BookingSegmentDto>(currentSegments)
                });
            }
            return;
        }

        // Ограничение глубины рекурсии
        if (currentSegments.Count >= maxDepth)
            return;

        // Ограничение количества результатов
        if (results.Count >= 20)
            return;

        var settings = await GetOrCreateSettingsAsync();

        // Пробуем каждый тип номера
        foreach (var roomType in roomTypes)
        {
            // Используем кэш для maxEndDate
            var cacheKey = $"{roomType.Id}_{currentDate:yyyyMMdd}_{endDate:yyyyMMdd}";
            if (!cache.TryGetValue(cacheKey, out var maxEnd))
            {
                maxEnd = await FindMaxAvailableEndDateAsync(
                roomType.Id, currentDate, endDate);
                cache[cacheKey] = maxEnd;
            }

            if (maxEnd > currentDate)
            {
                // Используем централизованный расчет единиц
                var units = BookingCalculationHelper.CalculateUnits(currentDate, maxEnd, settings);
                var minPeriod = BookingCalculationHelper.GetMinimumPeriod(settings.CalculationMode);

                // Проверяем минимальное бронирование
                if (units < minPeriod)
                    continue;

                var basePrice = roomType.PricePerNight * units;
                var additionalPetsCount = Math.Max(0, numberOfPets - 1);
                var additionalPetsPrice = roomType.PricePerAdditionalPet * additionalPetsCount * units;

                var segment = new BookingSegmentDto
                {
                    CheckInDate = currentDate,
                    CheckOutDate = maxEnd,
                    RoomTypeId = roomType.Id,
                    RoomTypeName = roomType.Name,
                    SquareMeters = roomType.SquareMeters ?? 0,
                    MaxCapacity = roomType.MaxCapacity,
                    Nights = units,
                    Price = basePrice + additionalPetsPrice,
                    MainPhotoUrl = GetMainPhotoUrl(roomType)
                };

                currentSegments.Add(segment);

                // Рекурсивно ищем дальше
                // В режиме Days: CheckOutDate занят, следующий сегмент начинается на следующий день
                // В режиме Nights: CheckOutDate свободен с 12:00, следующий сегмент может начаться в этот день
                var nextStartDate = settings.CalculationMode == BookingCalculationMode.Days
                ? maxEnd.AddDays(1)
                : maxEnd;

                await RecursiveFindCombinations(
                nextStartDate, endDate, numberOfPets, roomTypes,
                currentSegments, results, cache, maxDepth);

                currentSegments.RemoveAt(currentSegments.Count - 1);
            }
        }
    }

    /// <summary>
    /// Находит максимальную дату окончания, на которую доступен номер.
    /// </summary>
    private async Task<DateTime> FindMaxAvailableEndDateAsync(
    Guid roomTypeId,
    DateTime startDate,
    DateTime maxEndDate)
    {
        var settings = await GetOrCreateSettingsAsync();
        var totalRooms = await _roomRepository.GetCountByRoomTypeAsync(roomTypeId);
        if (totalRooms == 0)
            return startDate;

        var bookings = await GetBookingsForRoomTypeInPeriodAsync(roomTypeId, startDate, maxEndDate);

        // Проходим по дням от startDate и ищем первый НЕДОСТУПНЫЙ день
        // Логика зависит от режима расчета
        var currentDate = startDate.Date;
        while (currentDate < maxEndDate.Date)
        {
            // Считаем занятые номера с учетом режима
            var occupiedRooms = bookings.Count(b =>
            {
                if (settings.CalculationMode == BookingCalculationMode.Nights)
                {
                    // В режиме ночей: день занят только если это день заезда или день между заездом и выездом
                    // День выезда НЕ считается занятым
                    return b.CheckInDate.Date <= currentDate && b.CheckOutDate.Date > currentDate;
                }
                else
                {
                    // В режиме дней: день занят если он между заездом и выездом включительно
                    return b.CheckInDate.Date <= currentDate && b.CheckOutDate.Date >= currentDate;
                }
            });

            var isCheckInDay = bookings.Any(b => b.CheckInDate.Date == currentDate);
            var isCheckOutDay = bookings.Any(b => b.CheckOutDate.Date == currentDate);

            // Определяем доступность в зависимости от режима
            bool isUnavailable;
            if (settings.CalculationMode == BookingCalculationMode.Nights)
            {
                // В режиме ночей:
                // - День выезда (но не заезда) всегда доступен (можно начинать новое бронирование)
                // - День заезда недоступен только если все номера заняты
                // - Если день является и заездом, и выездом - недоступен только если все номера заняты
                // - Обычный день недоступен только если все номера заняты
                if (isCheckOutDay && !isCheckInDay)
                {
                    // День выезда (но не заезда) всегда доступен
                    isUnavailable = false;
                }
                else
                {
                    // День заезда, обычный день или день заезда+выезда недоступен только если все номера заняты
                    isUnavailable = occupiedRooms >= totalRooms;
                }
            }
            else
            {
                // В режиме дней: день недоступен если все номера заняты ИЛИ это день заезда/выезда
                isUnavailable = occupiedRooms >= totalRooms || isCheckInDay || isCheckOutDay;
            }

            if (isUnavailable)
            {
                // Нашли недоступный день - возвращаем ПРЕДЫДУЩИЙ день как максимальную дату окончания
                // currentDate - первый НЕДОСТУПНЫЙ, поэтому CheckOutDate = currentDate - 1 (последний ДОСТУПНЫЙ)
                var lastAvailableDay = currentDate.AddDays(-1);

                // Проверяем минимальное бронирование
                var minPeriod = BookingCalculationHelper.GetMinimumPeriod(settings.CalculationMode);
                var units = BookingCalculationHelper.CalculateUnits(startDate, lastAvailableDay, settings);
                return units >= minPeriod ? lastAvailableDay : startDate;
            }

            currentDate = currentDate.AddDays(1);
        }

        // Проверяем минимальное бронирование для всего доступного периода
        var minPeriodFull = BookingCalculationHelper.GetMinimumPeriod(settings.CalculationMode);
        var unitsFull = BookingCalculationHelper.CalculateUnits(startDate, maxEndDate, settings);
        return unitsFull >= minPeriodFull ? maxEndDate : startDate;
    }

    /// <summary>
    /// Проверяет, покрывают ли сегменты весь период.
    /// </summary>
    private bool CoversPeriod(
    List<BookingSegmentDto> segments,
    DateTime start,
    DateTime end,
    BookingCalculationMode calculationMode)
    {
        if (!segments.Any())
            return false;

        var sorted = segments.OrderBy(s => s.CheckInDate).ToList();

        if (sorted.First().CheckInDate != start)
            return false;

        for (int i = 0; i < sorted.Count - 1; i++)
        {
            // В режиме Days следующий сегмент начинается на следующий день после выезда.
            // В режиме Nights следующий сегмент может начаться в день выезда предыдущего.
            var expectedNextStart = calculationMode == BookingCalculationMode.Days
                ? sorted[i].CheckOutDate.AddDays(1)
                : sorted[i].CheckOutDate;
            if (sorted[i + 1].CheckInDate != expectedNextStart)
                return false;
        }

        return sorted.Last().CheckOutDate == end;
    }

    /// <summary>
    /// Получает количество доступных номеров на период.
    /// </summary>
    private async Task<int> GetAvailableRoomsCountForPeriodAsync(
    Guid roomTypeId,
    DateTime checkIn,
    DateTime checkOut)
    {
        return await _roomTypeRepository.GetAvailableRoomsCountAsync(roomTypeId, checkIn, checkOut);
    }

    /// <summary>
    /// Получает все бронирования для типа номера в период.
    /// </summary>
    private async Task<List<Booking>> GetBookingsForRoomTypeInPeriodAsync(
    Guid roomTypeId,
    DateTime start,
    DateTime end)
    {
        var bookings = await _bookingRepository.GetBookingsForRoomTypeInPeriodAsync(roomTypeId, start, end);
        return bookings.ToList();
    }

    /// <summary>
    /// Извлекает URL главного фото типа номера.
    /// </summary>
    private string? GetMainPhotoUrl(RoomType roomType)
    {
        return null;
    }

    /// <summary>
    /// Возвращает правильное склонение слова "переезд".
    /// </summary>
    private string GetTransferWord(int count)
    {
        if (count == 1)
            return "переезд";
        if (count >= 2 && count <= 4)
            return "переезда";
        return "переездов";
    }

    private static List<BookingOptionDto> ApplyDiscountToOptions(IEnumerable<BookingOptionDto> options, decimal discountPercent)
    {
        var normalized = NormalizeDiscount(discountPercent);
        var updated = new List<BookingOptionDto>();

        foreach (var option in options)
        {
            if (normalized > 0)
            {
                var originalTotal = option.Segments.Sum(s => s.Price);
                var discountedSegments = option.Segments.Select(segment =>
                {
                    var discounted = ApplyDiscount(segment.Price, normalized);
                    segment.Price = discounted;
                    return discounted;
                }).ToList();

                var discountedTotal = discountedSegments.Sum();
                option.TotalPrice = discountedTotal;
                option.PriceBreakdown ??= new PriceBreakdownDto();
                option.PriceBreakdown.DiscountAmount = Math.Round(originalTotal - discountedTotal, 2);
                option.PriceBreakdown.LoyaltyDiscountPercent = normalized;

                // Если ранее не было разбивки, заполняем базовыми значениями для отображения
                if (option.PriceBreakdown.BasePrice <= 0 && option.PriceBreakdown.AdditionalPetsPrice <= 0)
                {
                    option.PriceBreakdown.BasePrice = originalTotal;
                }
            }

            updated.Add(option);
        }

        return updated.OrderBy(o => o.TotalPrice).ThenBy(o => o.TransferCount).ToList();
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

    private static decimal NormalizeDiscount(decimal discountPercent)
    {
        if (discountPercent < 0)
            return 0;
        if (discountPercent > 100)
            return 100;
        return Math.Round(discountPercent, 2);
    }

    /// <summary>
    /// Получить настройки бронирования или создать дефолтные.
    /// </summary>
    private async Task<BookingSettings> GetOrCreateSettingsAsync()
    {
        var settings = await _settingsRepository.GetSingletonAsync();

        if (settings == null)
        {
            settings = new BookingSettings
            {
                Id = SettingsSingletonId,
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
