using Microsoft.EntityFrameworkCore;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Interfaces;
using PetHotel.Infrastructure.Data;

namespace PetHotel.Infrastructure.Repositories;

public class ClientRepository : Repository<Client>, IClientRepository
{
    public ClientRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<Client?> GetByUserIdAsync(Guid userId)
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query
        .Include(c => c.User)
        .FirstOrDefaultAsync(c => c.UserId == userId);
    }

    public async Task<Client?> GetByEmailAsync(string email)
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query
        .Include(c => c.User)
        .FirstOrDefaultAsync(c => c.User.Email == email);
    }

    public async Task<bool> EmailExistsAsync(string email)
    {
        return await _context.Users.AnyAsync(u => u.Email == email);
    }

    public async Task<IEnumerable<Client>> GetAllWithDetailsAsync()
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query
        .AsSplitQuery() // Оптимизация: разделяем запросы для избежания картезианского произведения
        .Include(c => c.User)
        .Include(c => c.Pets.Where(p => p.IsActive))
        .OrderBy(c => c.LastName)
        .ThenBy(c => c.FirstName)
        .ToListAsync();
    }

    public async Task<Client?> GetByIdWithDetailsAsync(Guid id)
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query
        .AsSplitQuery() // Оптимизация: разделяем запросы для избежания картезианского произведения
        .Include(c => c.User)
        .Include(c => c.Pets.Where(p => p.IsActive))
        .FirstOrDefaultAsync(c => c.Id == id);
    }
}
