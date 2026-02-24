using PetHotel.Domain.Common;

namespace PetHotel.Domain.Entities;

public class BookingService : BaseEntity
{
    public Guid BookingId { get; set; }
    public Guid? BookingPetId { get; set; }
    public Guid ServiceId { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }
    public DateTime? Date { get; set; }
    public string Status { get; set; } = "Scheduled"; // Scheduled, Completed, Cancelled

    // Navigation properties
    public Booking Booking { get; set; } = null!;
    public BookingPet? BookingPet { get; set; }
    public AdditionalService Service { get; set; } = null!;
}
