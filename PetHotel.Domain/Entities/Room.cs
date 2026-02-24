using PetHotel.Domain.Common;

namespace PetHotel.Domain.Entities;

public class Room : BaseEntity
{
    public string RoomNumber { get; set; } = string.Empty;
    public Guid RoomTypeId { get; set; }
    public int? Floor { get; set; } // Этаж (опционально)
    public string? SpecialNotes { get; set; } // Особенности конкретного номера
    public bool IsActive { get; set; }

    // Navigation properties
    public RoomType RoomType { get; set; } = null!;
    public ICollection<Booking> AssignedBookings { get; set; } = new List<Booking>();
}
