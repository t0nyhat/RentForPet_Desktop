using AutoMapper;
using PetHotel.Application.Common.Exceptions;
using PetHotel.Application.DTOs.Bookings;
using PetHotel.Application.DTOs.Payments;
using PetHotel.Application.Interfaces;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using PetHotel.Domain.Interfaces;

namespace PetHotel.Application.Services;

public class AdminPaymentService : IAdminPaymentService
{
    private readonly IPaymentRepository _paymentRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    public AdminPaymentService(
    IPaymentRepository paymentRepository,
    IBookingRepository bookingRepository,
    IUnitOfWork unitOfWork,
    IMapper mapper)
    {
        _paymentRepository = paymentRepository;
        _bookingRepository = bookingRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<IEnumerable<PaymentDto>> GetAllPaymentsAsync()
    {
        var payments = await _paymentRepository.GetAllWithBookingsAsync();
        return _mapper.Map<IEnumerable<PaymentDto>>(payments);
    }

    public async Task<IEnumerable<PaymentDto>> GetPendingPaymentsAsync()
    {
        var payments = await _paymentRepository.GetPendingPaymentsAsync();
        return _mapper.Map<IEnumerable<PaymentDto>>(payments);
    }

    public async Task<PaymentDto> ConfirmPaymentAsync(Guid paymentId, Guid adminId)
    {
        var payment = await _paymentRepository.GetByIdWithBookingAsync(paymentId);

        if (payment == null)
            throw new NotFoundException("Платеж", paymentId);

        if (payment.PaymentStatus != PaymentStatus.Pending)
            throw new BadRequestException("Платеж уже обработан");

        // Подтверждаем платеж (используется в исключительных случаях, когда платеж по какой-то причине в статусе Pending)
        payment.PaymentStatus = PaymentStatus.Completed;
        payment.ConfirmedAt = DateTime.Now;
        payment.ConfirmedByAdminId = adminId;

        await _paymentRepository.UpdateAsync(payment);

        // Обновляем статус бронирования на "Подтверждено" только если оно в статусе AwaitingPayment
        // Если уже Confirmed или CheckedIn - оставляем текущий статус (это доплата)
        // Загружаем бронирование с отслеживанием для обновления (без навигационных свойств)
        var bookingForRead = payment.Booking;
        if (bookingForRead.Status == BookingStatus.AwaitingPayment)
        {
            var booking = await _bookingRepository.GetByIdAsync(bookingForRead.Id);

            if (booking != null)
            {
                booking.Status = BookingStatus.Confirmed;
                booking.UpdatedAt = DateTime.Now;
                await _bookingRepository.UpdateAsync(booking);
            }
        }

        await _unitOfWork.SaveChangesAsync();

        var dto = _mapper.Map<PaymentDto>(payment);

        // Перезагружаем бронирование для уведомления
        var updatedBooking = await _bookingRepository.GetByIdWithDetailsAsync(bookingForRead.Id);
        if (updatedBooking != null && updatedBooking.Status == BookingStatus.Confirmed)
        {
            var bookingDto = _mapper.Map<BookingDto>(updatedBooking);
        }

        return dto;
    }

    public async Task<PaymentDto> RejectPaymentAsync(Guid paymentId, Guid adminId)
    {
        var payment = await _paymentRepository.GetByIdWithBookingAsync(paymentId);

        if (payment == null)
            throw new NotFoundException("Платеж", paymentId);

        if (payment.PaymentStatus != PaymentStatus.Pending)
            throw new BadRequestException("Платеж уже обработан");

        // Отклоняем платеж (используется в исключительных случаях для отмены платежа)
        payment.PaymentStatus = PaymentStatus.Failed;
        payment.ConfirmedAt = DateTime.Now;
        payment.ConfirmedByAdminId = adminId;

        await _paymentRepository.UpdateAsync(payment);

        // Примечание: в новой логике платежи сразу создаются в статусе Completed,
        // поэтому отклонение платежа не меняет статус бронирования автоматически
        // Администратору нужно будет вручную скорректировать статус бронирования при необходимости

        await _unitOfWork.SaveChangesAsync();

        return _mapper.Map<PaymentDto>(payment);
    }

    public async Task<PaymentDto> CreateManualPaymentAsync(CreateManualPaymentRequest request, Guid adminId)
    {
        // Загружаем бронирование для чтения (с деталями) для получения данных
        var bookingForRead = await _bookingRepository.GetByIdWithDetailsAsync(request.BookingId);

        if (bookingForRead == null)
            throw new NotFoundException("Бронирование", request.BookingId);

        if (bookingForRead.Status == BookingStatus.Cancelled || bookingForRead.Status == BookingStatus.CheckedOut)
            throw new BadRequestException("Оплата недоступна для отмененных или завершенных бронирований");

        // Рассчитываем уже оплаченную сумму
        var paidAmount = bookingForRead.Payments
        .Where(p => p.PaymentStatus == PaymentStatus.Completed)
        .Sum(p => p.Amount);

        var remainingAmount = bookingForRead.TotalPrice - paidAmount;

        // Валидация суммы
        if (request.Amount <= 0)
            throw new BadRequestException("Сумма платежа должна быть положительной");

        if (request.Amount > remainingAmount)
            throw new BadRequestException(
            $"Сумма платежа ({request.Amount:F2} ₽) превышает остаток к оплате ({remainingAmount:F2} ₽). " +
            $"Уже оплачено: {paidAmount:F2} ₽ из {bookingForRead.TotalPrice:F2} ₽");

        // Создаем платеж вручную - он сразу считается подтвержденным,
        // так как администратор создает его вручную и подтверждает факт оплаты
        var payment = new Payment
        {
            BookingId = request.BookingId,
            Amount = request.Amount,
            PaymentMethod = request.PaymentMethod,
            PaymentType = request.PaymentType,
            PaymentStatus = PaymentStatus.Completed,
            TransactionId = $"MANUAL-{DateTimeOffset.Now.ToUnixTimeMilliseconds()}-ADMIN",
            PaidAt = DateTime.Now,
            AdminComment = request.AdminComment,
            ConfirmedAt = DateTime.Now,
            ConfirmedByAdminId = adminId,
            PrepaymentPercentage = request.PaymentType == PaymentType.Prepayment
        ? Math.Round((request.Amount / bookingForRead.TotalPrice) * 100, 2)
        : null
        };

        await _paymentRepository.AddAsync(payment);

        // Обновляем статус бронирования только если это первый платеж
        // Если уже Confirmed или CheckedIn - оставляем текущий статус
        // Загружаем бронирование с отслеживанием для обновления (без навигационных свойств)
        if (bookingForRead.Status == BookingStatus.AwaitingPayment || bookingForRead.Status == BookingStatus.Pending)
        {
            var booking = await _bookingRepository.GetByIdAsync(request.BookingId);

            if (booking != null)
            {
                // Платеж создан и подтвержден администратором, переводим бронирование в Confirmed
                booking.Status = BookingStatus.Confirmed;
                booking.UpdatedAt = DateTime.Now;
                await _bookingRepository.UpdateAsync(booking);
            }
        }

        await _unitOfWork.SaveChangesAsync();

        var dto = _mapper.Map<PaymentDto>(payment);

        // Перезагружаем бронирование для уведомления
        var updatedBooking = await _bookingRepository.GetByIdWithDetailsAsync(request.BookingId);
        if (updatedBooking != null && updatedBooking.Status == BookingStatus.Confirmed)
        {
            var bookingDto = _mapper.Map<BookingDto>(updatedBooking);
        }

        return dto;
    }
}
