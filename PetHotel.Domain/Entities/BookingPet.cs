using PetHotel.Domain.Common;

namespace PetHotel.Domain.Entities;

public class BookingPet : BaseEntity
{
    public Guid BookingId { get; set; }
    public Guid PetId { get; set; }
    public string? SpecialRequests { get; set; }

    // Navigation properties
    public Booking Booking { get; set; } = null!;
    public Pet Pet { get; set; } = null!;
    public ICollection<BookingService> BookingServices { get; set; } = new List<BookingService>();
}
