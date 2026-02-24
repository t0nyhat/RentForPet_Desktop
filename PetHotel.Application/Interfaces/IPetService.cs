using PetHotel.Application.DTOs.Pets;

namespace PetHotel.Application.Interfaces;

public interface IPetService
{
    Task<IEnumerable<PetDto>> GetClientPetsAsync(Guid clientId);
    Task<PetDto> GetPetByIdAsync(Guid id, Guid clientId);
    Task<PetDto> CreatePetAsync(CreatePetRequest request, Guid clientId);
    Task<PetDto> UpdatePetAsync(Guid id, UpdatePetRequest request, Guid clientId);
    Task DeletePetAsync(Guid id, Guid clientId);
    Task DeletePetForAdminAsync(Guid id);
}
