using PetHotel.Domain.Common;
using PetHotel.Domain.Enums;

namespace PetHotel.Domain.Entities;

/// <summary>
/// Глобальные настройки системы бронирования
/// В системе должна существовать только одна запись.
/// </summary>
public class BookingSettings : BaseEntity
{
    /// <summary>
    /// Gets or sets режим расчета бронирований (по дням или по ночам).
    /// </summary>
    public BookingCalculationMode CalculationMode { get; set; } = BookingCalculationMode.Days;

    /// <summary>
    /// Gets or sets время заезда в режиме "по ночам" (например, 15:00)
    /// В формате TimeSpan (часы:минуты).
    /// </summary>
    public TimeSpan CheckInTime { get; set; } = new TimeSpan(15, 0, 0); // 15:00

    /// <summary>
    /// Gets or sets время выезда в режиме "по ночам" (например, 12:00)
    /// В формате TimeSpan (часы:минуты).
    /// </summary>
    public TimeSpan CheckOutTime { get; set; } = new TimeSpan(12, 0, 0); // 12:00

    /// <summary>
    /// Gets or sets a value indicating whether признак того, что это единственная запись настроек
    /// Всегда должна быть true.
    /// </summary>
    public bool IsSingleton { get; set; } = true;
}
