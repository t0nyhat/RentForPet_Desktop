namespace PetHotel.Application.DTOs.Bookings;

public class AdminCreateBookingRequest
{
    public Guid ClientId { get; set; }

    // Для простого бронирования:
    public Guid? RoomTypeId { get; set; }
    public Guid? AssignedRoomId { get; set; } // Опциональное назначение номера при создании админом
    public DateTime? CheckInDate { get; set; }
    public DateTime? CheckOutDate { get; set; }

    // Общее для обоих типов:
    public List<Guid> PetIds { get; set; } = new();
    public string? SpecialRequests { get; set; }

    // Для составного бронирования:

    /// <summary>
    /// Gets or sets сегменты для составного бронирования (с переездами)
    /// Если не пусто, то RoomTypeId, CheckInDate, CheckOutDate игнорируются.
    /// </summary>
    public List<BookingSegmentRequest>? Segments { get; set; }
}
