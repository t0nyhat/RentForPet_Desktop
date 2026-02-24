using PetHotel.Domain.Enums;

namespace PetHotel.Application.DTOs.Pets;

public class PetDto
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public string Name { get; set; } = string.Empty;
    public Species Species { get; set; }
    public string? Breed { get; set; }
    public DateTime? BirthDate { get; set; }
    public int? AgeYears { get; set; } // вычисляемое поле
    public Gender Gender { get; set; }
    public decimal? Weight { get; set; }
    public string? Color { get; set; }
    public string? Microchip { get; set; }
    public string? SpecialNeeds { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}
