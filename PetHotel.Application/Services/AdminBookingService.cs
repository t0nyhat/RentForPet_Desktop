using System;
using AutoMapper;
using PetHotel.Application.Common.Exceptions;
using PetHotel.Application.Common.Helpers;
using PetHotel.Application.DTOs.Admin;
using PetHotel.Application.DTOs.Bookings;
using PetHotel.Application.DTOs.Payments;
using PetHotel.Application.Interfaces;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using PetHotel.Domain.Interfaces;

namespace PetHotel.Application.Services;

public class AdminBookingService : IAdminBookingService
{
    private readonly IBookingRepository _bookingRepository;
    private readonly IClientRepository _clientRepository;
    private readonly IRoomTypeRepository _roomTypeRepository;
    private readonly IRoomRepository _roomRepository;
    private readonly IPaymentRepository _paymentRepository;
    private readonly IBookingSettingsRepository _settingsRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly IBookingService _bookingService;

    private static readonly Guid SettingsSingletonId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    public AdminBookingService(
    IBookingRepository bookingRepository,
    IClientRepository clientRepository,
    IRoomTypeRepository roomTypeRepository,
    IRoomRepository roomRepository,
    IPaymentRepository paymentRepository,
    IBookingSettingsRepository settingsRepository,
    IUnitOfWork unitOfWork,
    IMapper mapper,
    IBookingService bookingService)
    {
        _bookingRepository = bookingRepository;
        _clientRepository = clientRepository;
        _roomTypeRepository = roomTypeRepository;
        _roomRepository = roomRepository;
        _paymentRepository = paymentRepository;
        _settingsRepository = settingsRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _bookingService = bookingService;
    }

    public async Task<IEnumerable<BookingDto>> GetBookingsAsync(DateTime? from, DateTime? to, BookingStatus? status, Guid? clientId = null)
    {
        var bookings = await _bookingRepository.GetAllWithDetailsAsync(from, to, status);

        // Исключаем дочерние бронирования (сегменты составных бронирований) - показываем только родительские
        // Это предотвращает удвоение в подсчетах и бейджах
        bookings = bookings.Where(b => !b.ParentBookingId.HasValue).ToList();

        // Фильтруем по clientId если указан
        if (clientId.HasValue)
        {
            bookings = bookings.Where(b => b.ClientId == clientId.Value).ToList();
        }

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

    public async Task<IEnumerable<BookingDto>> GetBookingsRequiringPaymentAsync()
    {
        // Используем оптимизированный метод репозитория
        var bookings = await _bookingRepository.GetBookingsRequiringPaymentAsync();

        // Исключаем дочерние бронирования (сегменты составных бронирований) - показываем только родительские
        bookings = bookings.Where(b => !b.ParentBookingId.HasValue).ToList();

        // Маппим в DTO (здесь рассчитывается remainingAmount)
        var settings = await GetOrCreateSettingsAsync();
        var bookingDtos = _mapper.Map<List<BookingDto>>(bookings);

        // Пересчитываем NumberOfNights с учетом текущего режима расчета
        foreach (var dto in bookingDtos)
        {
            var booking = bookings.First(b => b.Id == dto.Id);
            dto.NumberOfNights = BookingCalculationHelper.CalculateUnits(booking.CheckInDate, booking.CheckOutDate, settings);
        }

        // Возвращаем только те, у которых есть остаток к оплате
        return bookingDtos.Where(dto =>
        dto.Status == BookingStatus.AwaitingPayment || // Всегда показываем AwaitingPayment
        dto.RemainingAmount > 0.01m // Показываем Confirmed/CheckedIn если есть остаток
        ).ToList();
    }

    public async Task<BookingDto> GetBookingByIdAsync(Guid id)
    {
        var booking = await _bookingRepository.GetByIdWithDetailsAsync(id);

        if (booking == null)
            throw new NotFoundException("Бронирование", id);

        try
        {
            var dto = _mapper.Map<BookingDto>(booking);

            // Пересчитываем NumberOfNights с учетом текущего режима расчета
            var settings = await GetOrCreateSettingsAsync();
            dto.NumberOfNights = BookingCalculationHelper.CalculateUnits(booking.CheckInDate, booking.CheckOutDate, settings);

            return dto;
        }
        catch (Exception ex)
        {
            // Логируем ошибку маппинга для диагностики
            throw new InvalidOperationException($"Ошибка при маппинге бронирования {id}: {ex.Message}", ex);
        }
    }

    public async Task<BookingDto> ConfirmBookingAsync(Guid bookingId)
    {
        // Теперь подтверждение означает разрешение клиенту оплатить
        // Загружаем для чтения, чтобы получить TotalPrice
        var bookingForRead = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);

        if (bookingForRead == null)
            throw new NotFoundException("Бронирование", bookingId);

        if (bookingForRead.Status != BookingStatus.Pending)
            throw new BadRequestException("Для подтверждения бронирование должно быть в статусе Pending");

        // Загружаем бронирование с отслеживанием для обновления (без навигационных свойств)
        var booking = await _bookingRepository.GetByIdAsync(bookingId);

        if (booking == null)
            throw new NotFoundException("Бронирование", bookingId);

        // Рассчитываем требуемую предоплату (30% от общей суммы)
        booking.RequiredPrepaymentAmount = Math.Round(bookingForRead.TotalPrice * 0.3m, 2);

        // Разрешаем оплату и переводим в статус ожидания оплаты
        booking.PaymentApproved = true;
        booking.Status = BookingStatus.AwaitingPayment;
        booking.UpdatedAt = DateTime.Now;

        await _bookingRepository.UpdateAsync(booking);
        await _unitOfWork.SaveChangesAsync();

        // Перезагружаем для маппинга в DTO
        var updatedBooking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);
        var dto = _mapper.Map<BookingDto>(updatedBooking);
        return dto;
    }

    public async Task<BookingDto> CheckInAsync(Guid bookingId)
    {
        var booking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);

        if (booking == null)
            throw new NotFoundException("Бронирование", bookingId);

        // Разрешаем заселение из статусов Confirmed и AwaitingPayment
        if (booking.Status != BookingStatus.Confirmed && booking.Status != BookingStatus.AwaitingPayment)
            throw new BadRequestException($"Заселение возможно только из статусов Confirmed или AwaitingPayment. Текущий статус: {booking.Status}");

        // Заселение возможно только если дата заезда совпадает с текущей датой
        if (booking.CheckInDate.Date != DateTime.Now.Date)
            throw new BadRequestException($"Заселение возможно только в день заезда. Дата заезда: {booking.CheckInDate.Date:dd.MM.yyyy}, текущая дата: {DateTime.Now.Date:dd.MM.yyyy}");

        booking.Status = BookingStatus.CheckedIn;
        booking.UpdatedAt = DateTime.Now;

        await _bookingRepository.UpdateAsync(booking);
        await _unitOfWork.SaveChangesAsync();

        var dto = _mapper.Map<BookingDto>(booking);
        return dto;
    }

    public async Task<BookingDto> CheckOutAsync(Guid bookingId)
    {
        var booking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);

        if (booking == null)
            throw new NotFoundException("Бронирование", bookingId);

        if (booking.Status != BookingStatus.CheckedIn)
            throw new BadRequestException("Выселить можно только бронирования в статусе CheckedIn");

        // Получаем настройки для правильного расчета
        var settings = await GetOrCreateSettingsAsync();

        // Рассчитываем стоимость фактически прожитых единиц (дней/ночей)
        var today = DateTime.Now.Date;
        var checkOutDate = booking.CheckOutDate.Date;
        var checkInDate = booking.CheckInDate.Date;
        var isEarlyCheckout = today < checkOutDate;

        var totalUnits = BookingCalculationHelper.CalculateUnits(checkInDate, checkOutDate, settings);
        var unitsStayed = BookingCalculationHelper.CalculateUnits(checkInDate, today, settings);
        var pricePerUnit = totalUnits > 0 ? booking.TotalPrice / totalUnits : 0;
        var amountForStayedDays = pricePerUnit * unitsStayed;

        // Проверяем оплату (учитываем возвраты)
        var paidAmount = booking.Payments
        .Where(p => p.PaymentStatus == PaymentStatus.Completed || p.PaymentStatus == PaymentStatus.Refunded)
        .Sum(p => p.Amount);

        // Проверяем, что оплачено достаточно для покрытия прожитых единиц
        var remainingAmount = amountForStayedDays - paidAmount;

        if (remainingAmount > 0.01m) // Допускаем погрешность в 1 копейку
        {
            var unitName = BookingCalculationHelper.GetUnitName(settings.CalculationMode, unitsStayed);
            throw new BadRequestException(
            $"Невозможно выселить: недостаточно оплаты за прожитые {unitName}. " +
            $"Требуется: {amountForStayedDays:F2} ₽ (за {unitsStayed} {unitName}), " +
            $"оплачено: {paidAmount:F2} ₽, " +
            $"не хватает: {remainingAmount:F2} ₽");
        }

        // Корректируем TotalPrice на основе фактически прожитых дней
        // Это создаст переплату, если клиент оплатил полную стоимость
        booking.TotalPrice = amountForStayedDays;

        // При раннем выселении обновляем CheckOutDate на текущую дату
        // Это освобождает номер для новых бронирований
        if (isEarlyCheckout)
        {
            // Сохраняем изначальную дату выезда для истории
            booking.OriginalCheckOutDate = booking.CheckOutDate;
            booking.IsEarlyCheckout = true;
            booking.CheckOutDate = today;
        }

        booking.Status = BookingStatus.CheckedOut;
        booking.UpdatedAt = DateTime.Now;

        await _bookingRepository.UpdateAsync(booking);

        // Для составных бронирований обрабатываем дочерние сегменты
        if (booking.IsComposite && booking.ChildBookings != null && booking.ChildBookings.Any())
        {
            foreach (var childBooking in booking.ChildBookings)
            {
                // Пропускаем уже выселенные или отмененные сегменты
                if (childBooking.Status == BookingStatus.CheckedOut || childBooking.Status == BookingStatus.Cancelled)
                    continue;

                var childCheckOutDate = childBooking.CheckOutDate.Date;
                var isChildEarlyCheckout = today < childCheckOutDate;

                // Если сегмент начинается после текущей даты - отменяем его
                if (childBooking.CheckInDate.Date > today)
                {
                    childBooking.Status = BookingStatus.Cancelled;
                    childBooking.UpdatedAt = DateTime.Now;
                }
                // Если сегмент уже начался - выселяем его
                else
                {
                    // При раннем выселении сокращаем дату окончания сегмента
                    if (isChildEarlyCheckout)
                    {
                        // Сохраняем изначальную дату выезда сегмента
                        childBooking.OriginalCheckOutDate = childBooking.CheckOutDate;
                        childBooking.IsEarlyCheckout = true;
                        childBooking.CheckOutDate = today;
                    }

                    childBooking.Status = BookingStatus.CheckedOut;
                    childBooking.UpdatedAt = DateTime.Now;
                }

                await _bookingRepository.UpdateAsync(childBooking);
            }
        }

        await _unitOfWork.SaveChangesAsync();

        var dto = _mapper.Map<BookingDto>(booking);
        return dto;
    }

    public async Task<EarlyCheckoutCalculation> CalculateEarlyCheckoutAsync(Guid bookingId)
    {
        var booking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);

        if (booking == null)
            throw new NotFoundException("Бронирование", bookingId);

        if (booking.Status != BookingStatus.CheckedIn)
            throw new BadRequestException("Расчет досрочного выселения доступен только для заселенных бронирований");

        // Получаем настройки для правильного расчета
        var settings = await GetOrCreateSettingsAsync();

        var today = DateTime.Now.Date;
        var checkOutDate = booking.CheckOutDate.Date;
        var checkInDate = booking.CheckInDate.Date;

        // Рассчитываем общее количество единиц (дней/ночей) в зависимости от режима
        var totalUnits = BookingCalculationHelper.CalculateUnits(checkInDate, checkOutDate, settings);

        // Рассчитываем количество прожитых единиц
        var unitsStayed = BookingCalculationHelper.CalculateUnits(checkInDate, today, settings);

        // Количество неиспользованных единиц
        var unitsUnused = Math.Max(0, totalUnits - unitsStayed);

        // Проверяем, является ли это досрочным выселением
        var isEarlyCheckout = today < checkOutDate;

        // Рассчитываем стоимость за единицу
        var pricePerUnit = totalUnits > 0 ? booking.TotalPrice / totalUnits : 0;

        // Стоимость за прожитые единицы
        var amountForStayedUnits = pricePerUnit * unitsStayed;

        // Сумма возврата (за неиспользованные единицы)
        var refundAmount = isEarlyCheckout ? pricePerUnit * unitsUnused : 0;

        // Получаем фактическую оплаченную сумму
        var paidAmount = booking.Payments
        .Where(p => p.PaymentStatus == PaymentStatus.Completed || p.PaymentStatus == PaymentStatus.Refunded)
        .Sum(p => p.Amount);

        var unitName = BookingCalculationHelper.GetUnitName(settings.CalculationMode, totalUnits);
        var unitNameStayed = BookingCalculationHelper.GetUnitName(settings.CalculationMode, unitsStayed);
        var unitNameUnused = BookingCalculationHelper.GetUnitName(settings.CalculationMode, unitsUnused);

        var message = isEarlyCheckout
        ? $"Досрочное выселение: питомец проживет {unitsStayed} из {totalUnits} {unitName}. " +
        $"За прожитые {unitNameStayed}: {amountForStayedUnits:F2} ₽. Возврат за {unitsUnused} неиспользованных {unitNameUnused}: {refundAmount:F2} ₽."
        : "Выселение в срок, возврат не требуется.";

        return new EarlyCheckoutCalculation
        {
            BookingId = bookingId,
            OriginalCheckOutDate = checkOutDate,
            ActualCheckOutDate = today,
            TotalNights = totalUnits,
            NightsStayed = unitsStayed,
            NightsUnused = unitsUnused,
            TotalPrice = booking.TotalPrice,
            PaidAmount = paidAmount,
            PricePerNight = pricePerUnit,
            AmountForStayedNights = amountForStayedUnits,
            RefundAmount = Math.Min(refundAmount, Math.Max(0, paidAmount - amountForStayedUnits)),
            IsEarlyCheckout = isEarlyCheckout,
            Message = message
        };
    }

    public async Task<BookingDto> CancelBookingAsync(Guid bookingId)
    {
        // Загружаем для чтения, чтобы проверить статус и получить информацию о дочерних бронированиях
        var bookingForRead = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);

        if (bookingForRead == null)
            throw new NotFoundException("Бронирование", bookingId);

        if (bookingForRead.Status == BookingStatus.Cancelled)
            throw new BadRequestException("Бронирование уже отменено");

        if (bookingForRead.Status == BookingStatus.CheckedOut)
            throw new BadRequestException("Невозможно отменить завершенное бронирование");

        // Загружаем бронирование с отслеживанием для обновления (без навигационных свойств)
        var booking = await _bookingRepository.GetByIdAsync(bookingId);

        if (booking == null)
            throw new NotFoundException("Бронирование", bookingId);

        // Админ может отменить бронирование в любом статусе (кроме завершённого)
        booking.Status = BookingStatus.Cancelled;
        booking.UpdatedAt = DateTime.Now;

        await _bookingRepository.UpdateAsync(booking);

        // Если это составное бронирование (родитель), отменяем все дочерние сегменты
        if (bookingForRead.IsComposite && bookingForRead.ChildBookings != null && bookingForRead.ChildBookings.Any())
        {
            foreach (var childBookingForRead in bookingForRead.ChildBookings)
            {
                if (childBookingForRead.Status != BookingStatus.Cancelled && childBookingForRead.Status != BookingStatus.CheckedOut)
                {
                    // Загружаем дочернее бронирование с отслеживанием для обновления
                    var childBooking = await _bookingRepository.GetByIdAsync(childBookingForRead.Id);

                    if (childBooking != null)
                    {
                        childBooking.Status = BookingStatus.Cancelled;
                        childBooking.UpdatedAt = DateTime.Now;
                        await _bookingRepository.UpdateAsync(childBooking);
                    }
                }
            }
        }

        await _unitOfWork.SaveChangesAsync();

        // Перезагружаем для маппинга в DTO
        var updatedBooking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);
        var dto = _mapper.Map<BookingDto>(updatedBooking);
        return dto;
    }

    public async Task DeleteAsync(Guid bookingId)
    {
        var booking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);

        if (booking == null)
            throw new NotFoundException("Бронирование", bookingId);

        if (booking.Status != BookingStatus.Pending)
            throw new BadRequestException("Можно удалить только неподтвержденные бронирования");

        await _bookingRepository.DeleteAsync(bookingId);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task<BookingDto> UpdateDatesAsync(Guid bookingId, DateTime checkIn, DateTime checkOut)
    {
        if (checkIn.Date < DateTime.Now.Date)
            throw new BadRequestException("Дата заезда не может быть в прошлом");

        if (checkOut <= checkIn)
            throw new BadRequestException("Дата выезда должна быть позже даты заезда");

        // Загружаем для чтения, чтобы получить все детали (RoomType, Client и т.д.)
        var bookingForRead = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);

        if (bookingForRead == null)
            throw new NotFoundException("Бронирование", bookingId);

        if (bookingForRead.Status == BookingStatus.CheckedOut)
            throw new BadRequestException("Нельзя изменять завершенные бронирования");

        // Получаем настройки для проверки доступности с учетом режима расчета
        var settings = await GetOrCreateSettingsAsync();

        // Проверяем доступность - если номер назначен, проверяем его; если нет - проверяем тип
        if (bookingForRead.AssignedRoomId.HasValue)
        {
            // Проверяем доступность с учетом режима расчета
            var overlappingBookings = await _bookingRepository.GetOverlappingBookingsAsync(
            bookingForRead.AssignedRoomId.Value,
            checkIn,
            checkOut,
            bookingId);

            // Проверяем пересечения с учетом режима расчета
            var hasOverlap = overlappingBookings.Any(b =>
            BookingCalculationHelper.DoPeriodsOverlap(
            checkIn,
            checkOut,
            b.CheckInDate,
            b.CheckOutDate,
            settings.CalculationMode));

            if (hasOverlap)
                throw new BadRequestException("Назначенный номер недоступен на выбранные даты");
        }
        else
        {
            // Проверяем, что для типа номера есть свободные номера
            var availableCount = await _roomTypeRepository.GetAvailableRoomsCountAsync(
            bookingForRead.RoomTypeId, checkIn, checkOut);

            if (availableCount == 0)
                throw new BadRequestException("Номера данного типа недоступны на выбранные даты");
        }

        // Загружаем для обновления (отслеживаемая сущность)
        var booking = await _bookingRepository.GetByIdAsync(bookingId);

        if (booking == null)
            throw new NotFoundException("Бронирование", bookingId);

        // Нормализуем к дате без часового пояса (Unspecified), чтобы избежать смещений
        booking.CheckInDate = DateTime.SpecifyKind(checkIn.Date, DateTimeKind.Unspecified);
        booking.CheckOutDate = DateTime.SpecifyKind(checkOut.Date, DateTimeKind.Unspecified);
        booking.UpdatedAt = DateTime.Now;

        // Пересчитываем стоимость на новые даты (settings уже получены выше)
        var units = BookingCalculationHelper.CalculateUnits(booking.CheckInDate, booking.CheckOutDate, settings);
        var additionalPetsCount = Math.Max(0, bookingForRead.NumberOfPets - 1);

        // Используем данные из bookingForRead, так как там загружен RoomType
        var pricePerNight = bookingForRead.RoomType?.PricePerNight ?? 0;
        var pricePerAdditionalPet = bookingForRead.RoomType?.PricePerAdditionalPet ?? 0;

        if (pricePerNight == 0)
            throw new BadRequestException("Не удалось определить стоимость номера. Тип номера не найден или не настроен.");

        var basePrice = pricePerNight * units;
        var additionalPetsPrice = pricePerAdditionalPet * additionalPetsCount * units;
        booking.BasePrice = basePrice;
        booking.AdditionalPetsPrice = additionalPetsPrice;
        var discountPercent = await GetClientDiscountPercentAsync(bookingForRead.ClientId);
        var subtotal = basePrice + additionalPetsPrice + bookingForRead.ServicesPrice;
        var discounted = ApplyDiscount(subtotal, discountPercent);
        booking.DiscountPercent = discountPercent;
        booking.DiscountAmount = Math.Round(subtotal - discounted, 2);
        booking.TotalPrice = discounted;

        await _bookingRepository.UpdateAsync(booking);
        await _unitOfWork.SaveChangesAsync();

        // Перезагружаем для маппинга в DTO
        var updatedBooking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);
        var dto = _mapper.Map<BookingDto>(updatedBooking);
        return dto;
    }

    public async Task<BookingDto> CreateManualBookingAsync(AdminCreateBookingRequest request)
    {
        var client = await _clientRepository.GetByIdAsync(request.ClientId);

        if (client == null)
            throw new NotFoundException("Клиент", request.ClientId);

        var createRequest = new CreateBookingRequest
        {
            RoomTypeId = request.RoomTypeId,
            CheckInDate = request.CheckInDate,
            CheckOutDate = request.CheckOutDate,
            PetIds = request.PetIds,
            SpecialRequests = request.SpecialRequests,
            Segments = request.Segments // Передаем сегменты для составного бронирования
        };

        var booking = await _bookingService.CreateBookingAsync(createRequest, request.ClientId);

        // Получаем ID созданного бронирования
        var bookingId = booking.Id;

        // Небольшая задержка для обеспечения синхронизации данных после создания бронирования
        await Task.Delay(100);

        // Получаем созданное бронирование для обновления
        // Используем базовый метод репозитория для получения отслеживаемой сущности
        var bookingEntity = await _bookingRepository.GetByIdAsync(bookingId, includeDetails: false);

        if (bookingEntity == null)
        {
            // Если не удалось получить бронирование сразу после создания,
            // это может быть проблема с синхронизацией. Попробуем еще раз с большей задержкой
            await Task.Delay(200);
            bookingEntity = await _bookingRepository.GetByIdAsync(bookingId, includeDetails: false);

            if (bookingEntity == null)
            {
                // Если все еще не найдено, возвращаем созданное бронирование как есть
                // Это может произойти при проблемах с транзакциями или синхронизацией
                return booking;
            }
        }

        // Если админ сразу указал конкретный номер - назначаем его (только для простых бронирований)
        if (request.AssignedRoomId.HasValue && (request.Segments == null || !request.Segments.Any()))
        {
            bookingEntity.AssignedRoomId = request.AssignedRoomId.Value;
        }

        // Автоматически подтверждаем бронирование, созданное оператором
        // Бронирования, созданные оператором, не требуют дополнительного подтверждения
        if (bookingEntity.Status == BookingStatus.Pending)
        {
            // Рассчитываем требуемую предоплату (30% от общей суммы)
            bookingEntity.RequiredPrepaymentAmount = Math.Round(bookingEntity.TotalPrice * 0.3m, 2);

            // Разрешаем оплату и переводим в статус ожидания оплаты
            bookingEntity.PaymentApproved = true;
            bookingEntity.Status = BookingStatus.AwaitingPayment;
            bookingEntity.UpdatedAt = DateTime.Now;
        }

        // Сохраняем все изменения одним вызовом
        await _bookingRepository.UpdateAsync(bookingEntity);
        await _unitOfWork.SaveChangesAsync();

        // Небольшая задержка для обеспечения синхронизации данных после сохранения
        await Task.Delay(100);

        // Перезагружаем обновленное бронирование
        try
        {
            booking = await GetBookingByIdAsync(bookingId);
        }
        catch (Exception)
        {
            // Если не удалось загрузить обновленное бронирование, возвращаем исходное
            // Это может произойти при проблемах с синхронизацией или маппингом
            // В этом случае бронирование все равно было создано и обновлено в базе
            return booking;
        }

        return booking;
    }

    public async Task<BookingDto> UpdatePrepaymentAmountAsync(Guid bookingId, decimal amount)
    {
        var booking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);

        if (booking == null)
            throw new NotFoundException("Бронирование", bookingId);

        if (booking.Status != BookingStatus.AwaitingPayment)
            throw new BadRequestException("Изменить сумму предоплаты можно только для бронирований, ожидающих оплату");

        // Проверяем, что предоплата не отменена
        if (booking.PrepaymentCancelled)
            throw new BadRequestException("Нельзя изменить сумму предоплаты, так как она была отменена администратором");

        // Проверяем, что предоплата не внесена
        var paidAmount = booking.Payments
        .Where(p => p.PaymentStatus == PaymentStatus.Completed)
        .Sum(p => p.Amount);

        if (paidAmount > 0)
            throw new BadRequestException("Нельзя изменить сумму предоплаты после внесения оплаты");

        // Валидация суммы (минимум 30%, максимум 100%)
        var minAmount = booking.TotalPrice * 0.3m;
        var maxAmount = booking.TotalPrice;

        if (amount < minAmount)
            throw new BadRequestException($"Минимальная сумма предоплаты: {minAmount:F2} ₽ (30%)");

        if (amount > maxAmount)
            throw new BadRequestException($"Сумма предоплаты не может превышать общую стоимость: {maxAmount:F2} ₽");

        booking.RequiredPrepaymentAmount = Math.Round(amount, 2);
        booking.UpdatedAt = DateTime.Now;

        await _bookingRepository.UpdateAsync(booking);
        await _unitOfWork.SaveChangesAsync();

        var dto = _mapper.Map<BookingDto>(booking);
        return dto;
    }

    public async Task<BookingDto> CancelPrepaymentAsync(Guid bookingId)
    {
        var booking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);

        if (booking == null)
            throw new NotFoundException("Бронирование", bookingId);

        if (booking.Status != BookingStatus.AwaitingPayment && booking.Status != BookingStatus.Confirmed)
            throw new BadRequestException("Отменить предоплату можно только для бронирований в статусах AwaitingPayment или Confirmed");

        // Проверяем, что предоплата еще не внесена
        var paidAmount = booking.Payments
        .Where(p => p.PaymentStatus == PaymentStatus.Completed && p.PaymentType == PaymentType.Prepayment)
        .Sum(p => p.Amount);

        if (paidAmount > 0)
            throw new BadRequestException("Нельзя отменить предоплату, так как она уже была внесена");

        booking.PrepaymentCancelled = true;
        booking.UpdatedAt = DateTime.Now;

        await _bookingRepository.UpdateAsync(booking);
        await _unitOfWork.SaveChangesAsync();

        var dto = _mapper.Map<BookingDto>(booking);
        return dto;
    }

    public async Task<BookingDto> AssignRoomAsync(Guid bookingId, Guid roomId)
    {
        var booking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);

        if (booking == null)
            throw new NotFoundException("Бронирование", bookingId);

        // Проверяем, что комната существует и соответствует типу номера
        var room = await _roomRepository.GetByIdAsync(roomId);
        if (room == null)
            throw new NotFoundException("Номер", roomId);

        if (!room.IsActive)
            throw new BadRequestException("Этот номер недоступен для назначения");

        if (room.RoomTypeId != booking.RoomTypeId)
            throw new BadRequestException($"Номер {room.RoomNumber} не соответствует типу бронирования");

        // Получаем настройки для проверки доступности с учетом режима расчета
        var settings = await GetOrCreateSettingsAsync();

        // Проверяем, что номер свободен в указанные даты с учетом режима расчета
        var overlappingBookings = await _bookingRepository.GetOverlappingBookingsAsync(
        roomId, booking.CheckInDate, booking.CheckOutDate, booking.Id);

        // Проверяем пересечения с учетом режима расчета
        var hasOverlap = overlappingBookings.Any(b =>
        BookingCalculationHelper.DoPeriodsOverlap(
        booking.CheckInDate,
        booking.CheckOutDate,
        b.CheckInDate,
        b.CheckOutDate,
        settings.CalculationMode));

        if (hasOverlap)
            throw new BadRequestException($"Номер {room.RoomNumber} занят на эти даты");

        // Загружаем отслеживаемую сущность для обновления
        var bookingToUpdate = await _bookingRepository.GetByIdAsync(bookingId);
        if (bookingToUpdate == null)
            throw new NotFoundException("Бронирование", bookingId);

        bookingToUpdate.AssignedRoomId = roomId;
        bookingToUpdate.UpdatedAt = DateTime.Now;

        await _bookingRepository.UpdateAsync(bookingToUpdate);
        await _unitOfWork.SaveChangesAsync();

        // Перезагружаем бронирование с обновленными данными (включая AssignedRoom)
        var updatedBooking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);
        if (updatedBooking == null)
            throw new NotFoundException("Бронирование", bookingId);

        var dto = _mapper.Map<BookingDto>(updatedBooking);
        return dto;
    }

    public async Task<BookingDto> UpdateBookingRoomAndDatesAsync(Guid bookingId, Guid roomId, DateTime checkIn, DateTime checkOut)
    {
        // Валидация дат
        if (checkIn.Date < DateTime.Now.Date)
            throw new BadRequestException("Дата заезда не может быть в прошлом");

        if (checkOut <= checkIn)
            throw new BadRequestException("Дата выезда должна быть позже даты заезда");

        // Загружаем для чтения, чтобы получить все детали (RoomType, Client и т.д.)
        var bookingForRead = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);

        if (bookingForRead == null)
            throw new NotFoundException("Бронирование", bookingId);

        if (bookingForRead.Status == BookingStatus.CheckedOut)
            throw new BadRequestException("Нельзя изменять завершенные бронирования");

        // Проверяем, что комната существует и соответствует типу номера
        var room = await _roomRepository.GetByIdAsync(roomId);
        if (room == null)
            throw new NotFoundException("Номер", roomId);

        if (!room.IsActive)
            throw new BadRequestException("Этот номер недоступен для назначения");

        if (room.RoomTypeId != bookingForRead.RoomTypeId)
            throw new BadRequestException($"Номер {room.RoomNumber} не соответствует типу бронирования");

        // Получаем настройки для проверки доступности с учетом режима расчета
        var settings = await GetOrCreateSettingsAsync();

        // ВАЖНО: Одновременная проверка доступности нового номера на новые даты с учетом режима расчета
        var overlappingBookings = await _bookingRepository.GetOverlappingBookingsAsync(
        roomId,
        checkIn,
        checkOut,
        bookingId);

        // Проверяем пересечения с учетом режима расчета
        var hasOverlap = overlappingBookings.Any(b =>
        BookingCalculationHelper.DoPeriodsOverlap(
        checkIn,
        checkOut,
        b.CheckInDate,
        b.CheckOutDate,
        settings.CalculationMode));

        if (hasOverlap)
            throw new BadRequestException($"Номер {room.RoomNumber} недоступен на выбранные даты");

        // Загружаем для обновления (отслеживаемая сущность)
        var booking = await _bookingRepository.GetByIdAsync(bookingId);

        if (booking == null)
            throw new NotFoundException("Бронирование", bookingId);

        // Обновляем и номер, и даты атомарно
        booking.AssignedRoomId = roomId;
        // Нормализуем к дате без часового пояса (Unspecified), чтобы избежать смещений
        booking.CheckInDate = DateTime.SpecifyKind(checkIn.Date, DateTimeKind.Unspecified);
        booking.CheckOutDate = DateTime.SpecifyKind(checkOut.Date, DateTimeKind.Unspecified);
        booking.UpdatedAt = DateTime.Now;

        // Пересчитываем стоимость на новые даты (settings уже получены выше)
        var units = BookingCalculationHelper.CalculateUnits(booking.CheckInDate, booking.CheckOutDate, settings);
        var additionalPetsCount = Math.Max(0, bookingForRead.NumberOfPets - 1);

        // Используем данные из bookingForRead, так как там загружен RoomType
        var pricePerNight = bookingForRead.RoomType?.PricePerNight ?? 0;
        var pricePerAdditionalPet = bookingForRead.RoomType?.PricePerAdditionalPet ?? 0;

        if (pricePerNight == 0)
            throw new BadRequestException("Не удалось определить стоимость номера. Тип номера не найден или не настроен.");

        var basePrice = pricePerNight * units;
        var additionalPetsPrice = pricePerAdditionalPet * additionalPetsCount * units;
        booking.BasePrice = basePrice;
        booking.AdditionalPetsPrice = additionalPetsPrice;
        var discountPercent = await GetClientDiscountPercentAsync(bookingForRead.ClientId);
        var subtotal = basePrice + additionalPetsPrice + bookingForRead.ServicesPrice;
        var discounted = ApplyDiscount(subtotal, discountPercent);
        booking.DiscountPercent = discountPercent;
        booking.DiscountAmount = Math.Round(subtotal - discounted, 2);
        booking.TotalPrice = discounted;

        await _bookingRepository.UpdateAsync(booking);
        await _unitOfWork.SaveChangesAsync();

        // Перезагружаем для маппинга в DTO
        var updatedBooking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);
        var dto = _mapper.Map<BookingDto>(updatedBooking);
        return dto;
    }

    private async Task<BookingDto> UpdateStatusAsync(Guid bookingId, BookingStatus expected, BookingStatus next)
    {
        var booking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);

        if (booking == null)
            throw new NotFoundException("Бронирование", bookingId);

        if (booking.Status != expected)
            throw new BadRequestException($"Для этого действия бронирование должно быть в статусе {expected}");

        booking.Status = next;
        booking.UpdatedAt = DateTime.Now;

        await _bookingRepository.UpdateAsync(booking);
        await _unitOfWork.SaveChangesAsync();

        return _mapper.Map<BookingDto>(booking);
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

    private static decimal NormalizeDiscount(decimal value)
    {
        if (value < 0)
            return 0;
        if (value > 100)
            return 100;
        return Math.Round(value, 2);
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

    public async Task<BookingDto> MergeBookingsAsync(List<Guid> bookingIds)
    {
        var mergedBooking = await _bookingService.MergeBookingsAsync(bookingIds);

        // Автоматически подтверждаем объединенное бронирование, созданное администратором
        var bookingId = Guid.Parse(mergedBooking.Id.ToString());
        var bookingEntity = await _bookingRepository.GetByIdAsync(bookingId);

        if (bookingEntity != null && bookingEntity.Status == BookingStatus.Pending)
        {
            // Рассчитываем требуемую предоплату (30% от общей суммы)
            // Используем TotalPrice из DTO, так как он только что создан и актуален
            bookingEntity.RequiredPrepaymentAmount = Math.Round(mergedBooking.TotalPrice * 0.3m, 2);

            // Разрешаем оплату и переводим в статус ожидания оплаты
            bookingEntity.PaymentApproved = true;
            bookingEntity.Status = BookingStatus.AwaitingPayment;
            bookingEntity.UpdatedAt = DateTime.Now;

            await _bookingRepository.UpdateAsync(bookingEntity);
            await _unitOfWork.SaveChangesAsync();

            // Перезагружаем для маппинга в DTO
            mergedBooking = await GetBookingByIdAsync(bookingId);
        }

        return mergedBooking;
    }

    public async Task<IEnumerable<BookingDto>> GetBookingsRequiringRefundAsync()
    {
        // Используем оптимизированный метод репозитория
        var bookings = await _bookingRepository.GetBookingsRequiringRefundAsync();

        // Исключаем дочерние бронирования (сегменты составных бронирований) - показываем только родительские
        bookings = bookings.Where(b => !b.ParentBookingId.HasValue).ToList();

        var bookingsWithAvailableAmount = bookings
        .Where(b => CalculateAvailableAmountForRefund(b) > 0.01m)
        .ToList();

        return _mapper.Map<List<BookingDto>>(bookingsWithAvailableAmount);
    }

    private static decimal CalculateAvailableAmountForRefund(Booking booking)
    {
        // Если остаток уже зачислен в доход, возврат невозможен
        if (booking.OverpaymentConvertedToRevenue)
            return 0;

        var netPaidAmount = booking.Payments
        .Where(p => p.PaymentStatus == PaymentStatus.Completed || p.PaymentStatus == PaymentStatus.Refunded)
        .Sum(p => p.Amount);

        var expectedTotal = booking.BasePrice + booking.AdditionalPetsPrice + booking.ServicesPrice - booking.DiscountAmount;
        if (expectedTotal < 0)
        {
            expectedTotal = 0;
        }

        if (booking.Status == BookingStatus.Cancelled)
        {
            var convertedToRevenue = Math.Max(0, booking.TotalPrice - expectedTotal);
            return Math.Max(0, netPaidAmount - convertedToRevenue);
        }

        return Math.Max(0, netPaidAmount - booking.TotalPrice);
    }

    public async Task<BookingDto> ProcessRefundAsync(Guid bookingId, decimal? customAmount = null)
    {
        var booking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);

        if (booking == null)
            throw new NotFoundException("Бронирование", bookingId);

        // Проверяем статус
        if (booking.Status != BookingStatus.CheckedOut && booking.Status != BookingStatus.Cancelled)
            throw new BadRequestException("Возврат возможен только для завершенных или отмененных бронирований");

        // Проверяем, что остаток не был зачислен в доход
        if (booking.OverpaymentConvertedToRevenue)
            throw new BadRequestException("Невозможно выполнить возврат: остаток по бронированию уже зачислен в доход");

        // Рассчитываем чистую оплаченную сумму (учитываем возвраты с отрицательными суммами)
        var netPaidAmount = booking.Payments
        .Where(p => p.PaymentStatus == PaymentStatus.Completed || p.PaymentStatus == PaymentStatus.Refunded)
        .Sum(p => p.Amount);

        var overpayment = netPaidAmount - booking.TotalPrice;

        // Для отмененных бронирований возвращаем всю оплату, для CheckedOut - только переплату
        var availableForRefund = booking.Status == BookingStatus.Cancelled ? netPaidAmount : overpayment;

        if (availableForRefund <= 0.01m)
            throw new BadRequestException(booking.Status == BookingStatus.Cancelled
            ? "Нет оплаты для возврата"
            : "Нет переплаты для возврата");

        // Используем кастомную сумму, если указана, иначе всю доступную сумму
        var refundAmount = customAmount ?? availableForRefund;

        // Проверяем, что кастомная сумма не превышает доступную
        if (refundAmount > availableForRefund)
            throw new BadRequestException($"Сумма возврата ({refundAmount:F2} ₽) не может превышать доступную сумму ({availableForRefund:F2} ₽)");

        if (refundAmount <= 0)
            throw new BadRequestException("Сумма возврата должна быть больше нуля");

        // Создаем запись о возврате как новый платеж с отрицательной суммой
        var refundComment = booking.Status == BookingStatus.Cancelled
        ? (customAmount.HasValue
        ? $"Частичный возврат {refundAmount:F2} ₽ из {availableForRefund:F2} ₽ по отмененному бронированию"
        : $"Возврат {refundAmount:F2} ₽ по отмененному бронированию")
        : (customAmount.HasValue
        ? $"Частичный возврат переплаты {refundAmount:F2} ₽ из {availableForRefund:F2} ₽"
        : $"Возврат переплаты {refundAmount:F2} ₽");

        var refundPayment = new Domain.Entities.Payment
        {
            Id = Guid.NewGuid(),
            BookingId = bookingId,
            Amount = -refundAmount, // Отрицательная сумма для возврата
            PaymentMethod = PaymentMethod.Card, // По умолчанию возврат на карту
            PaymentStatus = PaymentStatus.Refunded,
            PaymentType = PaymentType.FullPayment,
            AdminComment = refundComment,
            PaidAt = DateTime.Now,
            ConfirmedAt = DateTime.Now,
            ConfirmedByAdminId = Guid.Empty, // TODO: получить ID админа из контекста
            CreatedAt = DateTime.Now
        };

        await _paymentRepository.AddAsync(refundPayment);
        await _unitOfWork.SaveChangesAsync();

        // Перезагружаем бронирование с обновленными платежами
        var updatedBooking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);
        var dto = _mapper.Map<BookingDto>(updatedBooking);
        return dto;
    }

    public async Task<BookingDto> ConvertOverpaymentToRevenueAsync(Guid bookingId)
    {
        var booking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);

        if (booking == null)
            throw new NotFoundException("Бронирование", bookingId);

        // Проверяем статус
        if (booking.Status != BookingStatus.CheckedOut && booking.Status != BookingStatus.Cancelled)
            throw new BadRequestException("Зачисление в доход возможно только для завершенных или отмененных бронирований");

        // Проверяем, что зачисление еще не было выполнено
        if (booking.OverpaymentConvertedToRevenue)
            throw new BadRequestException("Остаток уже был зачислен в доход");

        // Рассчитываем чистую оплаченную сумму с учетом возвратов
        // Completed платежи - положительные суммы, Refunded - отрицательные суммы
        // Если был возврат, он уже учтен как отрицательный платеж
        // Для составных бронирований учитываем платежи дочерних сегментов
        decimal netPaidAmount;
        if (booking.IsComposite && booking.ChildBookings != null && booking.ChildBookings.Any())
        {
            var parentPayments = booking.Payments != null
            ? booking.Payments
            .Where(p => p.PaymentStatus == PaymentStatus.Completed || p.PaymentStatus == PaymentStatus.Refunded)
            .Sum(p => p.Amount)
            : 0;

            var childPayments = booking.ChildBookings
            .Where(cb => cb.Payments != null)
            .SelectMany(cb => cb.Payments)
            .Where(p => p.PaymentStatus == PaymentStatus.Completed || p.PaymentStatus == PaymentStatus.Refunded)
            .Sum(p => p.Amount);

            netPaidAmount = parentPayments + childPayments;
        }
        else
        {
            netPaidAmount = booking.Payments != null
            ? booking.Payments
            .Where(p => p.PaymentStatus == PaymentStatus.Completed || p.PaymentStatus == PaymentStatus.Refunded)
            .Sum(p => p.Amount)
            : 0;
        }

        var overpayment = netPaidAmount - booking.TotalPrice;

        // Для отмененных бронирований зачисляем остаток после возвратов (если были возвраты)
        // Для CheckedOut - только переплату после возвратов
        var amountToConvert = booking.Status == BookingStatus.Cancelled
        ? Math.Max(0, netPaidAmount) // Для отмененных - остаток после возвратов, но не меньше 0
        : Math.Max(0, overpayment); // Для CheckedOut - переплата после возвратов

        if (amountToConvert <= 0.01m)
            throw new BadRequestException(booking.Status == BookingStatus.Cancelled
            ? "Нет оплаты для зачисления в доход"
            : "Нет переплаты для зачисления");

        // Помечаем бронирование как зачисленное в доход БЕЗ создания отрицательного платежа
        // Деньги уже поступили и учтены в платежах (с учетом возвратов), мы просто фиксируем, что остаток остается в доходе
        // Для составных бронирований учитываем возвраты дочерних сегментов
        decimal refundedAmount;
        if (booking.IsComposite && booking.ChildBookings != null && booking.ChildBookings.Any())
        {
            var parentRefunds = booking.Payments != null
            ? booking.Payments
            .Where(p => p.PaymentStatus == PaymentStatus.Refunded)
            .Sum(p => Math.Abs(p.Amount))
            : 0;

            var childRefunds = booking.ChildBookings
            .Where(cb => cb.Payments != null)
            .SelectMany(cb => cb.Payments)
            .Where(p => p.PaymentStatus == PaymentStatus.Refunded)
            .Sum(p => Math.Abs(p.Amount));

            refundedAmount = parentRefunds + childRefunds;
        }
        else
        {
            refundedAmount = booking.Payments != null
            ? booking.Payments
            .Where(p => p.PaymentStatus == PaymentStatus.Refunded)
            .Sum(p => Math.Abs(p.Amount))
            : 0;
        }

        var comment = booking.Status == BookingStatus.Cancelled
        ? (refundedAmount > 0
        ? $"Остаток {amountToConvert:F2} ₽ (после возврата {refundedAmount:F2} ₽) по отмененному бронированию зачислен в доход (платеж за непредоставленные услуги в связи с отменой)"
        : $"Оплата {amountToConvert:F2} ₽ по отмененному бронированию зачислена в доход (платеж за непредоставленные услуги в связи с отменой)")
        : (refundedAmount > 0
        ? $"Остаток переплаты {amountToConvert:F2} ₽ (после возврата {refundedAmount:F2} ₽) зачислен в доход (платеж за непредоставленные услуги в связи с ранним выездом)"
        : $"Переплата {amountToConvert:F2} ₽ зачислена в доход (платеж за непредоставленные услуги в связи с ранним выездом)");

        // Получаем trackable entity для обновления
        var bookingToUpdate = await _bookingRepository.GetByIdAsync(bookingId);
        if (bookingToUpdate == null)
            throw new NotFoundException("Бронирование", bookingId);

        bookingToUpdate.OverpaymentConvertedToRevenue = true;
        bookingToUpdate.RevenueConversionAmount = amountToConvert;
        bookingToUpdate.RevenueConversionComment = comment;
        bookingToUpdate.UpdatedAt = DateTime.Now;

        await _bookingRepository.UpdateAsync(bookingToUpdate);
        await _unitOfWork.SaveChangesAsync();

        // Перезагружаем бронирование с обновленными данными
        var updatedBooking = await _bookingRepository.GetByIdWithDetailsAsync(bookingId);
        var dto = _mapper.Map<BookingDto>(updatedBooking);
        return dto;
    }

    public async Task<BookingDto> TransferPaymentAsync(Guid sourceBookingId, Guid targetBookingId, decimal? customAmount = null)
    {
        var sourceBooking = await _bookingRepository.GetByIdWithDetailsAsync(sourceBookingId);
        if (sourceBooking == null)
            throw new NotFoundException("Исходное бронирование", sourceBookingId);

        var targetBooking = await _bookingRepository.GetByIdWithDetailsAsync(targetBookingId);
        if (targetBooking == null)
            throw new NotFoundException("Целевое бронирование", targetBookingId);

        // Проверяем, что бронирования принадлежат одному клиенту
        if (sourceBooking.ClientId != targetBooking.ClientId)
            throw new BadRequestException("Перенос оплаты возможен только между бронированиями одного клиента");

        // Проверяем статус исходного бронирования
        if (sourceBooking.Status != BookingStatus.CheckedOut && sourceBooking.Status != BookingStatus.Cancelled)
            throw new BadRequestException("Перенос оплаты возможен только из завершенных или отмененных бронирований");

        // Проверяем статус целевого бронирования
        if (targetBooking.Status == BookingStatus.CheckedOut || targetBooking.Status == BookingStatus.Cancelled)
            throw new BadRequestException("Нельзя переносить оплату в завершенное или отмененное бронирование");

        // Рассчитываем доступную для переноса сумму в исходном бронировании (учитываем возвраты)
        var sourceNetPaidAmount = sourceBooking.Payments
        .Where(p => p.PaymentStatus == PaymentStatus.Completed || p.PaymentStatus == PaymentStatus.Refunded)
        .Sum(p => p.Amount);

        var sourceOverpayment = sourceNetPaidAmount - sourceBooking.TotalPrice;

        // Для отмененных бронирований переносим всю оплату, для CheckedOut - только переплату
        var availableForTransfer = sourceBooking.Status == BookingStatus.Cancelled ? sourceNetPaidAmount : sourceOverpayment;

        if (availableForTransfer <= 0.01m)
            throw new BadRequestException(sourceBooking.Status == BookingStatus.Cancelled
            ? "Нет оплаты для переноса в исходном бронировании"
            : "Нет переплаты для переноса в исходном бронировании");

        // Определяем сумму для переноса
        var transferAmount = customAmount ?? availableForTransfer;

        // Проверяем, что сумма переноса не превышает доступную
        if (transferAmount > availableForTransfer)
            throw new BadRequestException($"Сумма переноса ({transferAmount:F2} ₽) не может превышать доступную сумму ({availableForTransfer:F2} ₽)");

        if (transferAmount <= 0)
            throw new BadRequestException("Сумма переноса должна быть больше нуля");

        // Создаем запись о "возврате" из исходного бронирования (отрицательный платеж)
        var refundPayment = new Domain.Entities.Payment
        {
            Id = Guid.NewGuid(),
            BookingId = sourceBookingId,
            Amount = -transferAmount,
            PaymentMethod = PaymentMethod.Card,
            PaymentStatus = PaymentStatus.Refunded,
            PaymentType = PaymentType.FullPayment,
            AdminComment = $"Перенос {transferAmount:F2} ₽ в бронирование #{targetBookingId}",
            PaidAt = DateTime.Now,
            ConfirmedAt = DateTime.Now,
            ConfirmedByAdminId = Guid.Empty, // TODO: получить ID админа из контекста
            CreatedAt = DateTime.Now
        };

        // Создаем запись о платеже в целевом бронировании
        var targetPayment = new Domain.Entities.Payment
        {
            Id = Guid.NewGuid(),
            BookingId = targetBookingId,
            Amount = transferAmount,
            PaymentMethod = PaymentMethod.Card,
            PaymentStatus = PaymentStatus.Completed,
            PaymentType = PaymentType.FullPayment,
            AdminComment = $"Перенос {transferAmount:F2} ₽ из бронирования #{sourceBookingId}",
            PaidAt = DateTime.Now,
            ConfirmedAt = DateTime.Now,
            ConfirmedByAdminId = Guid.Empty, // TODO: получить ID админа из контекста
            CreatedAt = DateTime.Now
        };

        // Сохраняем оба платежа
        await _paymentRepository.AddAsync(refundPayment);
        await _paymentRepository.AddAsync(targetPayment);

        // Обновляем статус целевого бронирования, если нужно
        var targetPaidAmount = targetBooking.Payments
        .Where(p => p.PaymentStatus == PaymentStatus.Completed)
        .Sum(p => p.Amount);

        var newTotalPaid = targetPaidAmount + transferAmount;

        // Если оплата покрывает требуемую предоплату, переводим в Confirmed
        if (targetBooking.Status == BookingStatus.AwaitingPayment &&
        newTotalPaid >= targetBooking.RequiredPrepaymentAmount)
        {
            targetBooking.Status = BookingStatus.Confirmed;
            targetBooking.UpdatedAt = DateTime.Now;
            await _bookingRepository.UpdateAsync(targetBooking);
        }

        await _unitOfWork.SaveChangesAsync();

        // Возвращаем обновленное исходное бронирование
        var updatedSourceBooking = await _bookingRepository.GetByIdWithDetailsAsync(sourceBookingId);

        return _mapper.Map<BookingDto>(updatedSourceBooking);
    }
}
