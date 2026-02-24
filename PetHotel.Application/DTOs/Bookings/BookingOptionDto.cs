namespace PetHotel.Application.DTOs.Bookings;

/// <summary>
/// Представляет один вариант бронирования (может быть простым или составным).
/// </summary>
public class BookingOptionDto
{
    /// <summary>
    /// Gets or sets тип опции: "Single" (один номер), "SameType" (переезды в пределах типа), "Mixed" (разные типы).
    /// </summary>
    public string OptionType { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets сегменты бронирования (для простого варианта - один сегмент, для составного - несколько).
    /// </summary>
    public List<BookingSegmentDto> Segments { get; set; } = new();

    /// <summary>
    /// Gets or sets общая стоимость за весь период.
    /// </summary>
    public decimal TotalPrice { get; set; }

    /// <summary>
    /// Gets or sets общее количество ночей.
    /// </summary>
    public int TotalNights { get; set; }

    /// <summary>
    /// Gets or sets предупреждающее сообщение (например, о необходимости переезда).
    /// </summary>
    public string? WarningMessage { get; set; }

    /// <summary>
    /// Gets or sets количество переездов (0 для простого варианта).
    /// </summary>
    public int TransferCount { get; set; }

    /// <summary>
    /// Gets or sets уровень приоритета (меньше = лучше): 0 - Single, 1 - SameType, 2 - Mixed.
    /// </summary>
    public int Priority { get; set; }

    /// <summary>
    /// Gets or sets детали разбивки цены.
    /// </summary>
    public PriceBreakdownDto? PriceBreakdown { get; set; }
}
