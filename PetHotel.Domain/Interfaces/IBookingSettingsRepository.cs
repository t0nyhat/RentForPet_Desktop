using PetHotel.Domain.Entities;

namespace PetHotel.Domain.Interfaces;

/// <summary>
/// Репозиторий для управления настройками бронирования.
/// </summary>
public interface IBookingSettingsRepository : IRepository<BookingSettings>
{
    /// <summary>
    /// Получить единственную запись настроек (Singleton pattern).
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    Task<BookingSettings?> GetSingletonAsync();
}
