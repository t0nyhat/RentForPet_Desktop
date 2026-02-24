using PetHotel.Domain.Enums;

namespace PetHotel.Application.DTOs.Pets;

public class UpdatePetRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Breed { get; set; }
    public DateTime? BirthDate { get; set; }
    public Gender Gender { get; set; }
    public decimal? Weight { get; set; }
    public string? Color { get; set; }
    public string? SpecialNeeds { get; set; }
    public bool IsActive { get; set; }
}
