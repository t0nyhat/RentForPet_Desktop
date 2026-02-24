namespace PetHotel.Application.DTOs.Bookings;

public class CreateBookingRequest
{
    /// <summary>
    /// Gets or sets тип номера (используется для простых бронирований).
    /// </summary>
    public Guid? RoomTypeId { get; set; }

    /// <summary>
    /// Gets or sets дата заезда (используется для простых бронирований).
    /// </summary>
    public DateTime? CheckInDate { get; set; }

    /// <summary>
    /// Gets or sets дата выезда (используется для простых бронирований).
    /// </summary>
    public DateTime? CheckOutDate { get; set; }

    /// <summary>
    /// Gets or sets конкретный номер (опционально, для ручного бронирования админом).
    /// </summary>
    public Guid? AssignedRoomId { get; set; }

    /// <summary>
    /// Gets or sets список питомцев для бронирования.
    /// </summary>
    public List<Guid> PetIds { get; set; } = new();

    /// <summary>
    /// Gets or sets специальные пожелания.
    /// </summary>
    public string? SpecialRequests { get; set; }

    /// <summary>
    /// Gets or sets сегменты для составного бронирования (с переездами)
    /// Если не пусто, то RoomTypeId, CheckInDate, CheckOutDate игнорируются.
    /// </summary>
    public List<BookingSegmentRequest>? Segments { get; set; }
}

/// <summary>
/// Представляет один сегмент составного бронирования.
/// </summary>
public class BookingSegmentRequest
{
    /// <summary>
    /// Gets or sets тип номера для этого сегмента.
    /// </summary>
    public Guid RoomTypeId { get; set; }

    /// <summary>
    /// Gets or sets дата заезда в этот номер.
    /// </summary>
    public DateTime CheckInDate { get; set; }

    /// <summary>
    /// Gets or sets дата выезда из этого номера.
    /// </summary>
    public DateTime CheckOutDate { get; set; }

    /// <summary>
    /// Gets or sets конкретный номер (опционально, для ручного бронирования админом).
    /// </summary>
    public Guid? AssignedRoomId { get; set; }
}
