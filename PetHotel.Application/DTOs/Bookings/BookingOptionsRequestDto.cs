namespace PetHotel.Application.DTOs.Bookings;

/// <summary>
/// Запрос на получение вариантов бронирования.
/// </summary>
public class BookingOptionsRequestDto
{
    /// <summary>
    /// Gets or sets дата заезда.
    /// </summary>
    public DateTime CheckInDate { get; set; }

    /// <summary>
    /// Gets or sets дата выезда.
    /// </summary>
    public DateTime CheckOutDate { get; set; }

    /// <summary>
    /// Gets or sets количество питомцев.
    /// </summary>
    public int NumberOfPets { get; set; }

    /// <summary>
    /// Gets or sets опционально: ID клиента (используется администраторами для расчёта персональной скидки).
    /// </summary>
    public Guid? ClientId { get; set; }
}
