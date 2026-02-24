using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PetHotel.Application.DTOs.Admin;
using PetHotel.Application.DTOs.Bookings;
using PetHotel.Application.Interfaces;
using PetHotel.Domain.Enums;
using PetHotel.API.Services;

namespace PetHotel.API.Controllers;

[Route("api/admin/bookings")]
public class AdminBookingsController : BaseApiController
{
    private readonly IAdminBookingService _adminBookingService;
    private readonly AuditService _audit;

    public AdminBookingsController(IAdminBookingService adminBookingService, AuditService audit)
    {
        _adminBookingService = adminBookingService;
        _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<BookingDto>>> GetBookings(
    [FromQuery] DateTime? from,
    [FromQuery] DateTime? to,
    [FromQuery] BookingStatus? status,
    [FromQuery] Guid? clientId)
    {
        var bookings = await _adminBookingService.GetBookingsAsync(from, to, status, clientId);
        return Ok(bookings);
    }

    [HttpGet("requiring-payment")]
    public async Task<ActionResult<IEnumerable<BookingDto>>> GetBookingsRequiringPayment()
    {
        var bookings = await _adminBookingService.GetBookingsRequiringPaymentAsync();
        return Ok(bookings);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<BookingDto>> GetBooking(Guid id)
    {
        var booking = await _adminBookingService.GetBookingByIdAsync(id);
        return Ok(booking);
    }

    [HttpPost("{id:guid}/confirm")]
    public async Task<ActionResult<BookingDto>> ConfirmBooking(Guid id)
    {
        var booking = await _adminBookingService.ConfirmBookingAsync(id);
        BusinessMetrics.BookingsConfirmed.Inc();
        await _audit.LogAsync("ПОДТВЕРЖДЕНИЕ БРОНИРОВАНИЯ",
            $"Бронирование подтверждено",
            FormatBookingDetails(booking));
        return Ok(booking);
    }

    [HttpPost("{id:guid}/check-in")]
    public async Task<ActionResult<BookingDto>> CheckIn(Guid id)
    {
        var booking = await _adminBookingService.CheckInAsync(id);
        BusinessMetrics.BookingsCheckedIn.Inc();
        await _audit.LogAsync("ЗАСЕЛЕНИЕ",
            $"Заселение выполнено",
            FormatBookingDetails(booking));
        return Ok(booking);
    }

    [HttpPost("{id:guid}/check-out")]
    public async Task<ActionResult<BookingDto>> CheckOut(Guid id)
    {
        var booking = await _adminBookingService.CheckOutAsync(id);
        BusinessMetrics.BookingsCheckedOut.Inc();
        await _audit.LogAsync("ВЫСЕЛЕНИЕ",
            $"Выселение выполнено" + (booking.IsEarlyCheckout ? " (РАННИЙ ВЫЕЗД)" : ""),
            FormatBookingDetails(booking));
        return Ok(booking);
    }

    [HttpPost("{id:guid}/cancel")]
    public async Task<ActionResult<BookingDto>> CancelBooking(Guid id)
    {
        var booking = await _adminBookingService.CancelBookingAsync(id);
        BusinessMetrics.BookingsCancelled.WithLabels("admin").Inc();
        await _audit.LogAsync("ОТМЕНА БРОНИРОВАНИЯ",
            $"Бронирование отменено",
            FormatBookingDetails(booking));
        return Ok(booking);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> Delete(Guid id)
    {
        // Load booking before deletion for the log
        BookingDto? booking = null;
        try { booking = await _adminBookingService.GetBookingByIdAsync(id); } catch { /* best effort */ }

        await _adminBookingService.DeleteAsync(id);

        await _audit.LogAsync("УДАЛЕНИЕ БРОНИРОВАНИЯ",
            $"Бронирование удалено",
            booking != null ? FormatBookingDetails(booking) : $"ID: {id}");
        return NoContent();
    }

    [HttpPut("{id:guid}/dates")]
    public async Task<ActionResult<BookingDto>> UpdateDates(Guid id, [FromBody] UpdateBookingDatesRequest request)
    {
        var booking = await _adminBookingService.UpdateDatesAsync(id, request.CheckInDate, request.CheckOutDate);
        await _audit.LogAsync("ИЗМЕНЕНИЕ ДАТ БРОНИРОВАНИЯ",
            $"Даты изменены → {request.CheckInDate:dd.MM.yyyy} — {request.CheckOutDate:dd.MM.yyyy}",
            FormatBookingDetails(booking));
        return Ok(booking);
    }

    [HttpPost("manual")]
    public async Task<ActionResult<BookingDto>> CreateManualBooking([FromBody] AdminCreateBookingRequest request)
    {
        try
        {
            var booking = await _adminBookingService.CreateManualBookingAsync(request);
            await _audit.LogAsync("СОЗДАНИЕ БРОНИРОВАНИЯ",
                $"Бронирование создано вручную",
                FormatBookingDetails(booking));
            return CreatedAtAction(nameof(GetBooking), new { id = booking.Id }, booking);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Ошибка при создании бронирования", message = ex.Message, stackTrace = ex.StackTrace, innerException = ex.InnerException?.Message });
        }
    }

    [HttpPut("{id:guid}/prepayment-amount")]
    public async Task<ActionResult<BookingDto>> UpdatePrepaymentAmount(Guid id, [FromBody] UpdatePrepaymentAmountRequest request)
    {
        var booking = await _adminBookingService.UpdatePrepaymentAmountAsync(id, request.Amount);
        await _audit.LogAsync("ИЗМЕНЕНИЕ ПРЕДОПЛАТЫ",
            $"Сумма предоплаты изменена → {request.Amount:N2}₽",
            FormatBookingDetails(booking));
        return Ok(booking);
    }

    [HttpPost("{id:guid}/cancel-prepayment")]
    public async Task<ActionResult<BookingDto>> CancelPrepayment(Guid id)
    {
        var booking = await _adminBookingService.CancelPrepaymentAsync(id);
        await _audit.LogAsync("ОТМЕНА ПРЕДОПЛАТЫ",
            $"Предоплата отменена",
            FormatBookingDetails(booking));
        return Ok(booking);
    }

    [HttpPut("{id:guid}/assign-room")]
    public async Task<ActionResult<BookingDto>> AssignRoom(Guid id, [FromBody] AssignRoomRequest request)
    {
        var booking = await _adminBookingService.AssignRoomAsync(id, request.RoomId);
        await _audit.LogAsync("НАЗНАЧЕНИЕ НОМЕРА",
            $"Назначен номер: {booking.AssignedRoom?.RoomNumber ?? request.RoomId.ToString()}",
            FormatBookingDetails(booking));
        return Ok(booking);
    }

    [HttpPut("{id:guid}/room-and-dates")]
    public async Task<ActionResult<BookingDto>> UpdateRoomAndDates(Guid id, [FromBody] UpdateRoomAndDatesRequest request)
    {
        var booking = await _adminBookingService.UpdateBookingRoomAndDatesAsync(id, request.RoomId, request.CheckInDate, request.CheckOutDate);
        await _audit.LogAsync("ИЗМЕНЕНИЕ НОМЕРА И ДАТ",
            $"Номер и даты изменены → {request.CheckInDate:dd.MM.yyyy} — {request.CheckOutDate:dd.MM.yyyy}",
            FormatBookingDetails(booking));
        return Ok(booking);
    }

    [HttpPost("merge")]
    public async Task<ActionResult<BookingDto>> MergeBookings([FromBody] MergeBookingsRequest request)
    {
        var booking = await _adminBookingService.MergeBookingsAsync(request.BookingIds);
        await _audit.LogAsync("ОБЪЕДИНЕНИЕ БРОНИРОВАНИЙ",
            $"Объединены бронирования ({request.BookingIds.Count} шт.)",
            FormatBookingDetails(booking));
        return Ok(booking);
    }

    [HttpGet("requiring-refund")]
    public async Task<ActionResult<IEnumerable<BookingDto>>> GetBookingsRequiringRefund()
    {
        var bookings = await _adminBookingService.GetBookingsRequiringRefundAsync();
        return Ok(bookings);
    }

    [HttpPost("{id:guid}/process-refund")]
    public async Task<ActionResult<BookingDto>> ProcessRefund(Guid id, [FromBody] ProcessRefundRequest? request = null)
    {
        var booking = await _adminBookingService.ProcessRefundAsync(id, request?.Amount);
        await _audit.LogAsync("ВОЗВРАТ СРЕДСТВ",
            request?.Amount != null ? $"Возврат: {request.Amount:N2}₽" : "Возврат выполнен",
            FormatBookingDetails(booking));
        return Ok(booking);
    }

    [HttpPost("{id:guid}/convert-overpayment")]
    public async Task<ActionResult<BookingDto>> ConvertOverpaymentToRevenue(Guid id)
    {
        var booking = await _adminBookingService.ConvertOverpaymentToRevenueAsync(id);
        await _audit.LogAsync("КОНВЕРТАЦИЯ ПЕРЕПЛАТЫ",
            $"Переплата конвертирована в доход" + (booking.RevenueConversionAmount.HasValue ? $": {booking.RevenueConversionAmount:N2}₽" : ""),
            FormatBookingDetails(booking));
        return Ok(booking);
    }

    [HttpPost("{id:guid}/transfer-payment")]
    public async Task<ActionResult<BookingDto>> TransferPayment(Guid id, [FromBody] TransferPaymentRequest request)
    {
        var booking = await _adminBookingService.TransferPaymentAsync(id, request.TargetBookingId, request.Amount);
        await _audit.LogAsync("ПЕРЕНОС ПЛАТЕЖА",
            $"Платёж перенесён на бронирование {request.TargetBookingId}" + (request.Amount != null ? $", сумма: {request.Amount:N2}₽" : ""),
            FormatBookingDetails(booking));
        return Ok(booking);
    }

    [HttpGet("{id:guid}/calculate-early-checkout")]
    public async Task<ActionResult<EarlyCheckoutCalculation>> CalculateEarlyCheckout(Guid id)
    {
        var calculation = await _adminBookingService.CalculateEarlyCheckoutAsync(id);
        return Ok(calculation);
    }

    // ── Форматирование подробностей бронирования ─────────

    private static string FormatBookingDetails(BookingDto b)
    {
        var lines = new List<string>
        {
            $"ID бронирования: {b.Id}",
            $"Статус: {b.Status}",
        };

        if (b.Client != null)
            lines.Add($"Клиент: {b.Client.LastName} {b.Client.FirstName} ({b.Client.Phone}, {b.Client.Email})");

        lines.Add($"Тип номера: {b.RoomTypeName ?? b.RoomType?.Name ?? "—"}");

        if (b.AssignedRoom != null)
            lines.Add($"Номер комнаты: {b.AssignedRoom.RoomNumber}");

        lines.Add($"Даты: {b.CheckInDate:dd.MM.yyyy} — {b.CheckOutDate:dd.MM.yyyy} ({b.NumberOfNights} ноч.)");
        lines.Add($"Кол-во питомцев: {b.NumberOfPets}");

        if (b.Pets.Count > 0)
            lines.Add($"Питомцы: {string.Join(", ", b.Pets.Select(p => $"{p.Name} ({p.Species}{(string.IsNullOrEmpty(p.Breed) ? "" : ", " + p.Breed)})") )}");

        lines.Add($"Цена: {b.TotalPrice:N2}₽ (базовая: {b.BasePrice:N2}₽, доп.питомцы: {b.AdditionalPetsPrice:N2}₽, услуги: {b.ServicesPrice:N2}₽)");

        if (b.DiscountPercent > 0 || b.LoyaltyDiscountPercent > 0)
            lines.Add($"Скидка: {b.DiscountPercent + b.LoyaltyDiscountPercent}% (−{b.DiscountAmount:N2}₽)");

        lines.Add($"Оплачено: {b.PaidAmount:N2}₽, Остаток: {b.RemainingAmount:N2}₽");

        if (b.Services.Count > 0)
            lines.Add($"Услуги: {string.Join(", ", b.Services.Select(s => s.Service?.Name ?? s.ServiceId.ToString()))}");

        if (b.IsEarlyCheckout && b.OriginalCheckOutDate.HasValue)
            lines.Add($"Ранний выезд: план. выезд {b.OriginalCheckOutDate:dd.MM.yyyy}");

        if (b.OverpaymentConvertedToRevenue && b.RevenueConversionAmount.HasValue)
            lines.Add($"В доход: {b.RevenueConversionAmount:N2}₽ ({b.RevenueConversionComment})");

        if (!string.IsNullOrWhiteSpace(b.SpecialRequests))
            lines.Add($"Особые пожелания: {b.SpecialRequests}");

        if (b.IsComposite)
            lines.Add($"Составное бронирование, сегментов: {b.ChildBookings.Count}");

        return string.Join("\n", lines);
    }
}

public class UpdatePrepaymentAmountRequest
{
    public decimal Amount { get; set; }
}

public class AssignRoomRequest
{
    public Guid RoomId { get; set; }
}

public class UpdateRoomAndDatesRequest
{
    public Guid RoomId { get; set; }
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
}

public class ProcessRefundRequest
{
    public decimal? Amount { get; set; }
}

public class TransferPaymentRequest
{
    public Guid TargetBookingId { get; set; }
    public decimal? Amount { get; set; }
}
