namespace PetHotel.Application.DTOs.Bookings;

/// <summary>
/// Представляет один сегмент составного бронирования - период в одном номере.
/// </summary>
public class BookingSegmentDto
{
    /// <summary>
    /// Gets or sets дата заезда в этот номер.
    /// </summary>
    public DateTime CheckInDate { get; set; }

    /// <summary>
    /// Gets or sets дата выезда из этого номера.
    /// </summary>
    public DateTime CheckOutDate { get; set; }

    /// <summary>
    /// Gets or sets iD типа номера.
    /// </summary>
    public Guid RoomTypeId { get; set; }

    /// <summary>
    /// Gets or sets название типа номера.
    /// </summary>
    public string RoomTypeName { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets площадь номера.
    /// </summary>
    public decimal SquareMeters { get; set; }

    /// <summary>
    /// Gets or sets максимальная вместимость.
    /// </summary>
    public int MaxCapacity { get; set; }

    /// <summary>
    /// Gets or sets количество ночей в этом сегменте.
    /// </summary>
    public int Nights { get; set; }

    /// <summary>
    /// Gets or sets стоимость этого сегмента (базовая цена + доп. питомцы).
    /// </summary>
    public decimal Price { get; set; }

    /// <summary>
    /// Gets or sets uRL главного фото номера.
    /// </summary>
    public string? MainPhotoUrl { get; set; }
}
