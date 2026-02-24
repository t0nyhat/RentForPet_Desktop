using Microsoft.AspNetCore.Mvc;
using PetHotel.Application.DTOs.Payments;
using PetHotel.Application.Interfaces;
using PetHotel.API.Services;

namespace PetHotel.API.Controllers;

// [Authorize(Roles = "Admin")] - Authorization disabled
[Route("api/admin/payments")]
public class AdminPaymentsController : BaseApiController
{
    private readonly IAdminPaymentService _adminPaymentService;
    private readonly AuditService _audit;

    public AdminPaymentsController(IAdminPaymentService adminPaymentService, AuditService audit)
    {
        _adminPaymentService = adminPaymentService;
        _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<PaymentDto>>> GetAllPayments()
    {
        var payments = await _adminPaymentService.GetAllPaymentsAsync();
        return Ok(payments);
    }

    [HttpGet("pending")]
    public async Task<ActionResult<IEnumerable<PaymentDto>>> GetPendingPayments()
    {
        var payments = await _adminPaymentService.GetPendingPaymentsAsync();
        return Ok(payments);
    }

    [HttpPost("{id:guid}/confirm")]
    public async Task<ActionResult<PaymentDto>> ConfirmPayment(Guid id)
    {
        var adminId = GetUserId();
        var payment = await _adminPaymentService.ConfirmPaymentAsync(id, adminId);
        await _audit.LogAsync("ПОДТВЕРЖДЕНИЕ ОПЛАТЫ",
            $"Платёж подтверждён",
            FormatPaymentDetails(payment));
        return Ok(payment);
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<ActionResult<PaymentDto>> RejectPayment(Guid id)
    {
        var adminId = GetUserId();
        var payment = await _adminPaymentService.RejectPaymentAsync(id, adminId);
        await _audit.LogAsync("ОТКЛОНЕНИЕ ОПЛАТЫ",
            $"Платёж отклонён",
            FormatPaymentDetails(payment));
        return Ok(payment);
    }

    [HttpPost("manual")]
    public async Task<ActionResult<PaymentDto>> CreateManualPayment([FromBody] CreateManualPaymentRequest request)
    {
        var adminId = GetUserId();
        var payment = await _adminPaymentService.CreateManualPaymentAsync(request, adminId);
        await _audit.LogAsync("СОЗДАНИЕ ПЛАТЕЖА",
            $"Платёж создан вручную: {request.Amount:N2}₽ ({request.PaymentMethod})",
            FormatPaymentDetails(payment));
        return CreatedAtAction(nameof(GetPendingPayments), new { id = payment.Id }, payment);
    }

    // ── Форматирование подробностей платежа ──────────────

    private static string FormatPaymentDetails(PaymentDto p)
    {
        var lines = new List<string>
        {
            $"ID платежа: {p.Id}",
            $"ID бронирования: {p.BookingId}",
            $"Сумма: {p.Amount:N2}₽",
            $"Способ оплаты: {p.PaymentMethod}",
            $"Статус: {p.PaymentStatus}",
            $"Тип: {p.PaymentType}",
        };

        if (p.PrepaymentPercentage.HasValue)
            lines.Add($"Процент предоплаты: {p.PrepaymentPercentage}%");

        if (!string.IsNullOrWhiteSpace(p.TransactionId))
            lines.Add($"Транзакция: {p.TransactionId}");

        if (p.PaidAt.HasValue)
            lines.Add($"Дата оплаты: {p.PaidAt:dd.MM.yyyy HH:mm}");

        if (!string.IsNullOrWhiteSpace(p.AdminComment))
            lines.Add($"Комментарий: {p.AdminComment}");

        lines.Add($"Создан: {p.CreatedAt:dd.MM.yyyy HH:mm}");

        return string.Join("\n", lines);
    }
}
