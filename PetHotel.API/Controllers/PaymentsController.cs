using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PetHotel.Application.DTOs.Payments;
using PetHotel.Application.Interfaces;

namespace PetHotel.API.Controllers;

public class PaymentsController : BaseApiController
{
    private readonly IPaymentService _paymentService;
    private readonly ILogger<PaymentsController> _logger;

    public PaymentsController(IPaymentService paymentService, ILogger<PaymentsController> logger)
    {
        _paymentService = paymentService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<ActionResult<PaymentDto>> CreatePayment([FromBody] CreatePaymentRequest request)
    {
        _logger.LogInformation("CreatePayment called for BookingId: {BookingId}", request.BookingId);

        var clientId = GetClientId();
        _logger.LogInformation("Creating payment for ClientId: {ClientId}, BookingId: {BookingId}",
        clientId, request.BookingId);

        var payment = await _paymentService.CreatePaymentAsync(request, clientId);

        _logger.LogInformation("Payment created successfully: {PaymentId}", payment.Id);
        return CreatedAtAction(nameof(GetBookingPayments), new { bookingId = payment.BookingId }, payment);
    }

    [HttpGet("booking/{bookingId}")]
    public async Task<ActionResult<IEnumerable<PaymentDto>>> GetBookingPayments(Guid bookingId)
    {
        IEnumerable<PaymentDto> payments;

        if (IsAdmin())
        {
            // Администратор может видеть платежи для любого бронирования
            payments = await _paymentService.GetBookingPaymentsByAdminAsync(bookingId);
        }
        else
        {
            // Клиент видит платежи только для своих бронирований
            var clientId = GetClientId();
            payments = await _paymentService.GetBookingPaymentsAsync(bookingId, clientId);
        }

        return Ok(payments);
    }
}
