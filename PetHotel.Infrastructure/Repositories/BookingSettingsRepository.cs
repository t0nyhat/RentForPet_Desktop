using Microsoft.EntityFrameworkCore;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Interfaces;
using PetHotel.Infrastructure.Data;

namespace PetHotel.Infrastructure.Repositories;

/// <summary>
/// Репозиторий для управления настройками бронирования.
/// </summary>
public class BookingSettingsRepository : Repository<BookingSettings>, IBookingSettingsRepository
{
    public BookingSettingsRepository(ApplicationDbContext context) : base(context)
    {
    }

    /// <summary>
    /// Получить единственную запись настроек (Singleton pattern).
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    public async Task<BookingSettings?> GetSingletonAsync()
    {
        return await _dbSet
        .Where(s => s.IsSingleton)
        .FirstOrDefaultAsync();
    }
}
