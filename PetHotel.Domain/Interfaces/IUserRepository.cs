using PetHotel.Domain.Entities;

namespace PetHotel.Domain.Interfaces;

public interface IUserRepository : IRepository<User>
{
    Task<User?> GetByEmailAsync(string email);
    Task<User?> GetByEmailWithClientAsync(string email);
    Task<bool> EmailExistsAsync(string email);
    Task<User?> GetByRefreshTokenAsync(string refreshToken);
    Task<User?> GetByEmailConfirmationTokenAsync(string email, string token);
    Task<User?> GetByPasswordResetTokenAsync(string email, string token);
}
