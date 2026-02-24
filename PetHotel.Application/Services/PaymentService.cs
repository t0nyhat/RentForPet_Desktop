using AutoMapper;
using PetHotel.Application.Common.Exceptions;
using PetHotel.Application.DTOs.Bookings;
using PetHotel.Application.DTOs.Payments;
using PetHotel.Application.Interfaces;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using PetHotel.Domain.Interfaces;

namespace PetHotel.Application.Services;

public class PaymentService : IPaymentService
{
    private readonly IPaymentRepository _paymentRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public PaymentService(
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

    public async Task<PaymentDto> CreatePaymentAsync(CreatePaymentRequest request, Guid clientId)
    {
        // Проверяем существование бронирования
        var booking = await _bookingRepository.GetByIdAndClientIdAsync(request.BookingId, clientId);

        if (booking == null)
            throw new NotFoundException(
            $"Бронирование с ID '{request.BookingId}' не найдено или не принадлежит текущему клиенту (ClientId: {clientId})");

        if (booking.Status == BookingStatus.Cancelled || booking.Status == BookingStatus.CheckedOut)
            throw new BadRequestException("Оплата недоступна для отмененных или завершенных бронирований");

        // Проверяем, что оплата разрешена администратором
        if (!booking.PaymentApproved)
            throw new BadRequestException(
            $"Оплата еще не разрешена администратором. " +
            $"Текущий статус бронирования: {booking.Status}. " +
            $"PaymentApproved: {booking.PaymentApproved}");

        // Проверяем, что бронирование в статусе ожидания оплаты или подтверждено (для доплаты)
        if (booking.Status != BookingStatus.AwaitingPayment &&
        booking.Status != BookingStatus.Confirmed &&
        booking.Status != BookingStatus.CheckedIn)
            throw new BadRequestException(
            $"Оплата доступна только для бронирований в статусах AwaitingPayment, Confirmed или CheckedIn. " +
            $"Текущий статус: {booking.Status}");

        // Рассчитываем уже оплаченную сумму
        var paidAmount = booking.Payments
        .Where(p => p.PaymentStatus == PaymentStatus.Completed)
        .Sum(p => p.Amount);

        var remainingAmount = booking.TotalPrice - paidAmount;

        // Валидация суммы
        if (request.Amount <= 0)
            throw new BadRequestException("Сумма платежа должна быть больше нуля");

        if (request.Amount > remainingAmount)
            throw new BadRequestException(
            $"Сумма платежа ({request.Amount:F2} ₽) превышает остаток к оплате ({remainingAmount:F2} ₽). " +
            $"Уже оплачено: {paidAmount:F2} ₽ из {booking.TotalPrice:F2} ₽");

        if (request.PaymentType == PaymentType.Prepayment)
        {
            // Для первого платежа проверяем минимальную предоплату
            if (paidAmount == 0)
            {
                var requiredPrepayment = booking.RequiredPrepaymentAmount > 0
                ? booking.RequiredPrepaymentAmount
                : Math.Round(booking.TotalPrice * 0.3m, 2);

                if (request.Amount < requiredPrepayment)
                    throw new BadRequestException($"Минимальная предоплата составляет {requiredPrepayment:F2} ₽");
            }

            // Вычисляем процент предоплаты от общей суммы
            var percentage = (request.Amount / booking.TotalPrice) * 100;
            request.PrepaymentPercentage = Math.Round(percentage, 2);
        }
        else
        {
            // Для полной оплаты сумма должна покрыть весь остаток
            if (Math.Abs(request.Amount - remainingAmount) > 0.01m)
                throw new BadRequestException(
                $"Для полной оплаты необходимо оплатить весь остаток: {remainingAmount:F2} ₽");
        }

        // Создаем платеж
        var payment = _mapper.Map<Payment>(request);
        payment.PaidAt = DateTime.Now;

        // Платеж сразу переходит в статус Completed, так как был успешно проведен
        payment.PaymentStatus = PaymentStatus.Completed;
        payment.ConfirmedAt = DateTime.Now;

        // Генерируем мок TransactionId для имитации реальной платежной системы
        payment.TransactionId = GenerateMockTransactionId(request.PaymentMethod);

        await _paymentRepository.AddAsync(payment);
        await _unitOfWork.SaveChangesAsync();

        // Обновляем статус бронирования только если это первый платеж (AwaitingPayment)
        // Если уже Confirmed или CheckedIn - оставляем текущий статус
        if (booking.Status == BookingStatus.AwaitingPayment)
        {
            // Платеж успешно проведен, сразу переводим бронирование в Confirmed
            booking.Status = BookingStatus.Confirmed;
            await _bookingRepository.UpdateAsync(booking);
            await _unitOfWork.SaveChangesAsync();
        }

        var dto = _mapper.Map<PaymentDto>(payment);

        // Отправляем уведомление о смене статуса бронирования
        if (booking.Status == BookingStatus.Confirmed)
        {
            var bookingDto = _mapper.Map<BookingDto>(booking);
        }

        return dto;
    }

    public async Task<IEnumerable<PaymentDto>> GetBookingPaymentsAsync(Guid bookingId, Guid clientId)
    {
        // Проверяем, что бронирование принадлежит клиенту
        var booking = await _bookingRepository.GetByIdAndClientIdAsync(bookingId, clientId);

        if (booking == null)
            throw new NotFoundException("Бронирование", bookingId);

        var payments = await _paymentRepository.GetByBookingIdAsync(bookingId);
        return _mapper.Map<IEnumerable<PaymentDto>>(payments);
    }

    public async Task<IEnumerable<PaymentDto>> GetBookingPaymentsByAdminAsync(Guid bookingId)
    {
        // Для администратора не проверяем принадлежность бронирования
        var booking = await _bookingRepository.GetByIdAsync(bookingId);

        if (booking == null)
            throw new NotFoundException("Бронирование", bookingId);

        var payments = await _paymentRepository.GetByBookingIdAsync(bookingId);
        return _mapper.Map<IEnumerable<PaymentDto>>(payments);
    }

    /// <summary>
    /// Генерирует мок-идентификатор транзакции для имитации платежной системы.
    /// </summary>
    private string GenerateMockTransactionId(PaymentMethod method)
    {
        var timestamp = DateTimeOffset.Now.ToUnixTimeMilliseconds();
        var random = new Random().Next(1000, 9999);

        return method switch
        {
            PaymentMethod.Online => $"ONLINE-{timestamp}-{random}",
            PaymentMethod.QrCode => $"QR-{timestamp}-{random}",
            PaymentMethod.PhoneTransfer => $"PHONE-{timestamp}-{random}",
            PaymentMethod.Card => $"CARD-{timestamp}-{random}",
            PaymentMethod.Cash => $"CASH-{timestamp}-{random}",
            _ => $"MOCK-{timestamp}-{random}"
        };
    }
}
