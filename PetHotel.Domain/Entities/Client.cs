using PetHotel.Domain.Common;

namespace PetHotel.Domain.Entities;

public class Client : BaseEntity
{
    public Guid UserId { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? EmergencyContact { get; set; }
    public string? EspoCrmId { get; set; }
    public string? InternalNotes { get; set; }
    public decimal LoyaltyDiscountPercent { get; set; }

    // Navigation properties
    public User User { get; set; } = null!;
    public ICollection<Pet> Pets { get; set; } = new List<Pet>();
    public ICollection<Booking> Bookings { get; set; } = new List<Booking>();
}
