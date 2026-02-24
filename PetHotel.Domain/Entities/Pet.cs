using PetHotel.Domain.Common;
using PetHotel.Domain.Enums;

namespace PetHotel.Domain.Entities;

public class Pet : BaseEntity
{
    public Guid ClientId { get; set; }
    public string Name { get; set; } = string.Empty;
    public Species Species { get; set; }
    public string? Breed { get; set; }
    public DateTime? BirthDate { get; set; }
    public Gender Gender { get; set; }
    public decimal? Weight { get; set; }
    public string? Color { get; set; }
    public string? Microchip { get; set; }
    public string? SpecialNeeds { get; set; }
    public bool IsActive { get; set; }
    public string? InternalNotes { get; set; }

    // Navigation properties
    public Client Client { get; set; } = null!;
    public ICollection<BookingPet> BookingPets { get; set; } = new List<BookingPet>();
}
