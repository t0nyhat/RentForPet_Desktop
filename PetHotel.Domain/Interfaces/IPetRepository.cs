using PetHotel.Domain.Entities;

namespace PetHotel.Domain.Interfaces;

public interface IPetRepository : IRepository<Pet>
{
    Task<IEnumerable<Pet>> GetByClientIdAsync(Guid clientId);
    Task<Pet?> GetByIdAndClientIdAsync(Guid id, Guid clientId);
    Task<bool> HasActiveBookingsAsync(Guid petId);
}
