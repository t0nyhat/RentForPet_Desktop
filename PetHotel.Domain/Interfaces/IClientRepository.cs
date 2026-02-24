using PetHotel.Domain.Entities;

namespace PetHotel.Domain.Interfaces;

public interface IClientRepository : IRepository<Client>
{
    Task<Client?> GetByUserIdAsync(Guid userId);
    Task<Client?> GetByEmailAsync(string email);
    Task<bool> EmailExistsAsync(string email);
    Task<IEnumerable<Client>> GetAllWithDetailsAsync();
    Task<Client?> GetByIdWithDetailsAsync(Guid id);
}
