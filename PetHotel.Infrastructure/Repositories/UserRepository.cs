using Microsoft.EntityFrameworkCore;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Interfaces;
using PetHotel.Infrastructure.Data;

namespace PetHotel.Infrastructure.Repositories;

public class UserRepository : Repository<User>, IUserRepository
{
    public UserRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<User?> GetByEmailAsync(string email)
    {
        return await _dbSet.FirstOrDefaultAsync(u => u.Email == email);
    }

    public async Task<User?> GetByEmailWithClientAsync(string email)
    {
        return await _dbSet
        .Include(u => u.Client)
        .FirstOrDefaultAsync(u => u.Email == email);
    }

    public async Task<bool> EmailExistsAsync(string email)
    {
        return await _dbSet.AnyAsync(u => u.Email == email);
    }

    public async Task<User?> GetByRefreshTokenAsync(string refreshToken)
    {
        return await _dbSet
        .Include(u => u.Client)
        .FirstOrDefaultAsync(u => u.RefreshToken == refreshToken);
    }

    public async Task<User?> GetByEmailConfirmationTokenAsync(string email, string token)
    {
        return await _dbSet
        .Include(u => u.Client)
        .FirstOrDefaultAsync(u => u.Email == email && u.EmailConfirmationToken == token);
    }

    public async Task<User?> GetByPasswordResetTokenAsync(string email, string token)
    {
        return await _dbSet
        .Include(u => u.Client)
        .FirstOrDefaultAsync(u => u.Email == email && u.PasswordResetToken == token);
    }
}
