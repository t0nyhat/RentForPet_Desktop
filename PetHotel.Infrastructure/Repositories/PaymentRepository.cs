using Microsoft.EntityFrameworkCore;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using PetHotel.Domain.Interfaces;
using PetHotel.Infrastructure.Data;

namespace PetHotel.Infrastructure.Repositories;

public class PaymentRepository : Repository<Payment>, IPaymentRepository
{
    public PaymentRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Payment>> GetAllWithBookingsAsync()
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query, предотвращаем tracking конфликты
        .Include(p => p.Booking)
        .ThenInclude(b => b.Client)
        .Include(p => p.Booking)
        .ThenInclude(b => b.RoomType)
        .Include(p => p.Booking)
        .ThenInclude(b => b.AssignedRoom!)
        .ThenInclude(r => r.RoomType)
        .OrderByDescending(p => p.CreatedAt)
        .ToListAsync();
    }

    public async Task<IEnumerable<Payment>> GetByBookingIdAsync(Guid bookingId)
    {
        return await _dbSet
        .Where(p => p.BookingId == bookingId)
        .OrderByDescending(p => p.CreatedAt)
        .ToListAsync();
    }

    public async Task<IEnumerable<Payment>> GetPendingPaymentsAsync()
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query, предотвращаем tracking конфликты
        .Include(p => p.Booking)
        .ThenInclude(b => b.Client)
        .Include(p => p.Booking)
        .ThenInclude(b => b.RoomType)
        .Include(p => p.Booking)
        .ThenInclude(b => b.AssignedRoom!)
        .ThenInclude(r => r.RoomType)
        .Where(p => p.PaymentStatus == PaymentStatus.Pending)
        .OrderBy(p => p.CreatedAt)
        .ToListAsync();
    }

    public async Task<Payment?> GetByIdWithBookingAsync(Guid id)
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query, предотвращаем tracking конфликты
        .Include(p => p.Booking)
        .ThenInclude(b => b.Client)
        .Include(p => p.Booking)
        .ThenInclude(b => b.RoomType)
        .Include(p => p.Booking)
        .ThenInclude(b => b.AssignedRoom!)
        .ThenInclude(r => r.RoomType)
        .FirstOrDefaultAsync(p => p.Id == id);
    }
}
