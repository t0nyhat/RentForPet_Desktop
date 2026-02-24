using PetHotel.Domain.Enums;

namespace PetHotel.Application.DTOs.Settings;

/// <summary>
/// DTO для отображения настроек бронирования.
/// </summary>
public class BookingSettingsDto
{
    public Guid Id { get; set; }

    /// <summary>
    /// Gets or sets режим расчета бронирований (Days или Nights).
    /// </summary>
    public BookingCalculationMode CalculationMode { get; set; }

    /// <summary>
    /// Gets or sets время заезда (в формате HH:mm, например "15:00").
    /// </summary>
    public string CheckInTime { get; set; } = null!;

    /// <summary>
    /// Gets or sets время выезда (в формате HH:mm, например "12:00").
    /// </summary>
    public string CheckOutTime { get; set; } = null!;
}
