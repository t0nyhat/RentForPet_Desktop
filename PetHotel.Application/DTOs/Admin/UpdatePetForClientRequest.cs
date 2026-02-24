using System.ComponentModel.DataAnnotations;
using PetHotel.Domain.Enums;

namespace PetHotel.Application.DTOs.Admin;

public class UpdatePetForClientRequest
{
    [Required(ErrorMessage = "Имя питомца обязательно")]
    [MaxLength(50)]
    public string Name { get; set; } = string.Empty;

    [Required(ErrorMessage = "Вид питомца обязателен")]
    public Species Species { get; set; }

    [MaxLength(100)]
    public string? Breed { get; set; }

    public DateTime? BirthDate { get; set; }

    [Required(ErrorMessage = "Пол питомца обязателен")]
    public Gender Gender { get; set; }

    public decimal? Weight { get; set; }

    [MaxLength(50)]
    public string? Color { get; set; }

    [MaxLength(50)]
    public string? Microchip { get; set; }

    [MaxLength(500)]
    public string? SpecialNeeds { get; set; }

    [MaxLength(2000)]
    public string? InternalNotes { get; set; }
}
