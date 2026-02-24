using Microsoft.EntityFrameworkCore;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using PetHotel.Domain.Interfaces;
using PetHotel.Infrastructure.Data;

namespace PetHotel.Infrastructure.Repositories;

public class RoomRepository : Repository<Room>, IRoomRepository
{
    public RoomRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Room>> GetActiveRoomsAsync()
    {
        return await _dbSet
        .Include(r => r.RoomType)
        .Where(r => r.IsActive)
        .OrderBy(r => r.RoomNumber)
        .ToListAsync();
    }

    public async Task<Room?> GetActiveByIdAsync(Guid id)
    {
        return await _dbSet
        .Include(r => r.RoomType)
        .FirstOrDefaultAsync(r => r.Id == id && r.IsActive);
    }

    public async Task<bool> RoomNumberExistsAsync(string roomNumber, Guid? excludeId = null)
    {
        var query = _dbSet.Where(r => r.RoomNumber == roomNumber);

        if (excludeId.HasValue)
            query = query.Where(r => r.Id != excludeId.Value);

        return await query.AnyAsync();
    }

    public async Task<IEnumerable<Room>> GetAvailableRoomsAsync(DateTime checkIn, DateTime checkOut, int numberOfPets)
    {
        // Получаем все активные номера с достаточной вместимостью через RoomType
        return await _dbSet
        .Include(r => r.RoomType)
        .Where(r => r.IsActive && r.RoomType.MaxCapacity >= numberOfPets)
        .Where(r => !_context.Bookings.Any(b =>
        b.AssignedRoomId == r.Id &&
        b.Status != BookingStatus.Cancelled &&
        checkIn <= b.CheckOutDate && checkOut >= b.CheckInDate))
        .ToListAsync();
    }

    public async Task<IEnumerable<Room>> GetByRoomTypeIdAsync(Guid roomTypeId)
    {
        return await _dbSet
        .Include(r => r.RoomType)
        .Where(r => r.RoomTypeId == roomTypeId)
        .OrderBy(r => r.RoomNumber)
        .ToListAsync();
    }

    public async Task<int> GetCountByRoomTypeAsync(Guid roomTypeId)
    {
        return await _dbSet
        .Where(r => r.RoomTypeId == roomTypeId && r.IsActive)
        .CountAsync();
    }
}
