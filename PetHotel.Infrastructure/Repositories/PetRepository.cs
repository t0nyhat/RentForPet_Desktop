using Microsoft.EntityFrameworkCore;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using PetHotel.Domain.Interfaces;
using PetHotel.Infrastructure.Data;

namespace PetHotel.Infrastructure.Repositories;

public class PetRepository : Repository<Pet>, IPetRepository
{
    public PetRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Pet>> GetByClientIdAsync(Guid clientId)
    {
        return await _dbSet
        .Where(p => p.ClientId == clientId && p.IsActive)
        .OrderBy(p => p.Name)
        .ToListAsync();
    }

    public async Task<Pet?> GetByIdAndClientIdAsync(Guid id, Guid clientId)
    {
        return await _dbSet
        .FirstOrDefaultAsync(p => p.Id == id && p.ClientId == clientId);
    }

    public async Task<bool> HasActiveBookingsAsync(Guid petId)
    {
        return await _context.BookingPets
        .Include(bp => bp.Booking)
        .AnyAsync(bp => bp.PetId == petId &&
        bp.Booking.Status != BookingStatus.Cancelled &&
        bp.Booking.Status != BookingStatus.CheckedOut);
    }
}
