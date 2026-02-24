using PetHotel.Application.DTOs.Pets;

namespace PetHotel.Application.DTOs.Admin;

public class AdminPetDto : PetDto
{
    public string? InternalNotes { get; set; }
}
