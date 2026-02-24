using PetHotel.Domain.Common;

namespace PetHotel.Domain.Entities;

public class RoomType : BaseEntity
{
    public string Name { get; set; } = string.Empty; // Standard, Comfort, VIP, Family
    public string? Description { get; set; }
    public int MaxCapacity { get; set; }
    public decimal PricePerNight { get; set; }
    public decimal PricePerAdditionalPet { get; set; }
    public decimal? SquareMeters { get; set; }
    public string? Features { get; set; } // JSON string
    public bool IsActive { get; set; }

    // Navigation properties
    public ICollection<Room> Rooms { get; set; } = new List<Room>();
    public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}
