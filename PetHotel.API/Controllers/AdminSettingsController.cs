using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PetHotel.Application.DTOs.Settings;
using PetHotel.Application.Interfaces;
using PetHotel.API.Services;

namespace PetHotel.API.Controllers;

[Route("api/admin/settings")]
public class AdminSettingsController : BaseApiController
{
    private readonly IBookingSettingsService _bookingSettingsService;
    private readonly AuditService _audit;

    public AdminSettingsController(IBookingSettingsService bookingSettingsService, AuditService audit)
    {
        _bookingSettingsService = bookingSettingsService;
        _audit = audit;
    }

    [HttpGet("booking")]
    public async Task<ActionResult<BookingSettingsDto>> GetBookingSettings()
    {
        var settings = await _bookingSettingsService.GetSettingsAsync();
        return Ok(settings);
    }

    [HttpPut("booking")]
    public async Task<ActionResult<BookingSettingsDto>> UpdateBookingSettings([FromBody] UpdateBookingSettingsDto dto)
    {
        var settings = await _bookingSettingsService.UpdateSettingsAsync(dto);
        await _audit.LogAsync("ОБНОВЛЕНИЕ НАСТРОЕК",
            "Настройки бронирования обновлены",
            $"Режим расчёта: {settings.CalculationMode}\nВремя заезда: {settings.CheckInTime}\nВремя выезда: {settings.CheckOutTime}");
        return Ok(settings);
    }

    [HttpGet("booking/can-change")]
    public async Task<ActionResult<bool>> CanChangeBookingSettings()
    {
        var canChange = await _bookingSettingsService.CanChangeSettingsAsync();
        return Ok(new { canChange });
    }

    [HttpGet("booking/has-active-bookings")]
    public async Task<ActionResult> HasActiveBookings()
    {
        var canChange = await _bookingSettingsService.CanChangeSettingsAsync();
        var hasActiveBookings = !canChange;
        return Ok(new { hasActiveBookings });
    }
}
