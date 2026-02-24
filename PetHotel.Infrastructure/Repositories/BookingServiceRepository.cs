using Microsoft.EntityFrameworkCore;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Interfaces;
using PetHotel.Infrastructure.Data;

namespace PetHotel.Infrastructure.Repositories;

public class BookingServiceRepository : Repository<BookingService>, IBookingServiceRepository
{
    public BookingServiceRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<BookingService>> GetByBookingIdAsync(Guid bookingId)
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query, предотвращаем tracking конфликты
        .Include(bs => bs.Service)
        .Where(bs => bs.BookingId == bookingId)
        .ToListAsync();
    }

    public async Task DeleteByBookingIdAsync(Guid bookingId)
    {
        var services = await _dbSet
        .Where(bs => bs.BookingId == bookingId)
        .ToListAsync();

        _dbSet.RemoveRange(services);
    }
}
