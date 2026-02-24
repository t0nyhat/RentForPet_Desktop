using PetHotel.Application.DTOs.Admin;

namespace PetHotel.Application.Interfaces;

public interface IAdminClientService
{
    Task<IEnumerable<AdminClientDto>> GetClientsAsync();
    Task<AdminClientDto> GetClientByIdAsync(Guid id);
    Task<AdminClientDto> CreateClientAsync(CreateClientRequest request);
    Task<AdminClientDto> UpdateClientAsync(Guid id, UpdateClientRequest request);
    Task DeleteClientAsync(Guid id);
    Task<AdminPetDto> CreatePetForClientAsync(Guid clientId, CreatePetForClientRequest request);
    Task<AdminPetDto> UpdatePetForClientAsync(Guid clientId, Guid petId, UpdatePetForClientRequest request);
    Task UpdateClientNotesAsync(Guid id, string? notes);
    Task UpdatePetNotesAsync(Guid clientId, Guid petId, string? notes);
}
