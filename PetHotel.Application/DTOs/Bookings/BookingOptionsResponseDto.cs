namespace PetHotel.Application.DTOs.Bookings;

/// <summary>
/// Ответ API с вариантами бронирования, сгруппированными по типам.
/// </summary>
public class BookingOptionsResponseDto
{
    /// <summary>
    /// Gets or sets варианты с одним номером на весь период (идеальные варианты).
    /// </summary>
    public List<BookingOptionDto> SingleRoomOptions { get; set; } = new();

    /// <summary>
    /// Gets or sets варианты с переездами между номерами одного типа.
    /// </summary>
    public List<BookingOptionDto> SameTypeTransferOptions { get; set; } = new();

    /// <summary>
    /// Gets or sets варианты с переездами между номерами разных типов.
    /// </summary>
    public List<BookingOptionDto> MixedTypeTransferOptions { get; set; } = new();

    /// <summary>
    /// Gets or sets общее количество найденных вариантов.
    /// </summary>
    public int TotalOptions { get; set; }

    /// <summary>
    /// Gets or sets a value indicating whether есть ли идеальные варианты (без переездов).
    /// </summary>
    public bool HasPerfectOptions { get; set; }

    /// <summary>
    /// Gets or sets период бронирования.
    /// </summary>
    public DateTime CheckInDate { get; set; }

    /// <summary>
    /// Gets or sets период бронирования.
    /// </summary>
    public DateTime CheckOutDate { get; set; }

    /// <summary>
    /// Gets or sets количество питомцев.
    /// </summary>
    public int NumberOfPets { get; set; }
}
