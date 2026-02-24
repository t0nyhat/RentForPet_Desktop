using PetHotel.Domain.Enums;
using System.ComponentModel.DataAnnotations;

namespace PetHotel.Application.DTOs.Settings;

/// <summary>
/// DTO для обновления настроек бронирования.
/// </summary>
public class UpdateBookingSettingsDto
{
    /// <summary>
    /// Gets or sets режим расчета бронирований (Days или Nights).
    /// </summary>
    [Required]
    public BookingCalculationMode CalculationMode { get; set; }

    /// <summary>
    /// Gets or sets время заезда (в формате HH:mm или HH:mm:ss, например "15:00" или "15:00:00").
    /// </summary>
    [Required]
    [RegularExpression(@"^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$", ErrorMessage = "Время должно быть в формате HH:mm или HH:mm:ss (00:00 - 23:59)")]
    public string CheckInTime { get; set; } = null!;

    /// <summary>
    /// Gets or sets время выезда (в формате HH:mm или HH:mm:ss, например "12:00" или "12:00:00").
    /// </summary>
    [Required]
    [RegularExpression(@"^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$", ErrorMessage = "Время должно быть в формате HH:mm или HH:mm:ss (00:00 - 23:59)")]
    public string CheckOutTime { get; set; } = null!;
}
