using PetHotel.Domain.Enums;

namespace PetHotel.Application.DTOs.Pets;

public class CreatePetRequest
{
    public string Name { get; set; } = string.Empty;
    public Species Species { get; set; }
    public string? Breed { get; set; }
    public DateTime? BirthDate { get; set; }
    public Gender Gender { get; set; }
    public decimal? Weight { get; set; }
    public string? Color { get; set; }
    public string? Microchip { get; set; }
    public string? SpecialNeeds { get; set; }
}
