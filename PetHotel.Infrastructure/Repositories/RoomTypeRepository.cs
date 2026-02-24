using Microsoft.EntityFrameworkCore;
using PetHotel.Application.Common.Helpers;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using PetHotel.Domain.Interfaces;
using PetHotel.Infrastructure.Data;

namespace PetHotel.Infrastructure.Repositories;

public class RoomTypeRepository : Repository<RoomType>, IRoomTypeRepository
{
    private readonly IBookingSettingsRepository _settingsRepository;
    private static readonly Guid SettingsSingletonId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    public RoomTypeRepository(ApplicationDbContext context, IBookingSettingsRepository settingsRepository) : base(context)
    {
        _settingsRepository = settingsRepository;
    }

    public override async Task<IEnumerable<RoomType>> GetAllAsync()
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query
        .OrderBy(rt => rt.Name)
        .ToListAsync();
    }

    public async Task<IEnumerable<RoomType>> GetActiveRoomTypesAsync()
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query
        .Where(rt => rt.IsActive)
        .OrderBy(rt => rt.Name)
        .ToListAsync();
    }

    public async Task<RoomType?> GetActiveByIdAsync(Guid id)
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query
        .FirstOrDefaultAsync(rt => rt.Id == id && rt.IsActive);
    }

    public async Task<RoomType?> GetByIdWithPhotosAsync(Guid id)
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query
        .FirstOrDefaultAsync(rt => rt.Id == id);
    }

    public async Task<bool> RoomTypeNameExistsAsync(string name, Guid? excludeId = null)
    {
        var query = _dbSet.Where(rt => rt.Name == name);

        if (excludeId.HasValue)
            query = query.Where(rt => rt.Id != excludeId.Value);

        // Query filters автоматически применяют фильтр по TenantId
        // Если TenantContext установлен, будут проверяться только типы номеров текущей организации
        return await query.AnyAsync();
    }

    public async Task<int> GetAvailableRoomsCountAsync(Guid roomTypeId, DateTime checkIn, DateTime checkOut)
    {
        // Получаем настройки для определения режима расчета
        var settings = await GetOrCreateSettingsAsync();

        // Получаем все активные номера данного типа
        var totalRooms = await _context.Rooms
        .Where(r => r.RoomTypeId == roomTypeId && r.IsActive)
        .CountAsync();

        // Получаем все бронирования для данного типа номера
        // Исключаем родительские составные бронирования (они не занимают номера)
        var bookings = await _context.Bookings
        .Where(b =>
        b.RoomTypeId == roomTypeId &&
        b.Status != BookingStatus.Cancelled &&
        !b.IsComposite) // Исключаем родительские бронирования
        .Select(b => new { b.CheckInDate, b.CheckOutDate })
        .ToListAsync();

        // Проверяем пересечения с учетом режима расчета (Days/Nights)
        var bookedRoomsCount = bookings.Count(b =>
        BookingCalculationHelper.DoPeriodsOverlap(
        checkIn, checkOut,
        b.CheckInDate, b.CheckOutDate,
        settings.CalculationMode));

        return totalRooms - bookedRoomsCount;
    }

    /// <summary>
    /// Получить настройки бронирования или создать дефолтные.
    /// </summary>
    private async Task<BookingSettings> GetOrCreateSettingsAsync()
    {
        var settings = await _settingsRepository.GetSingletonAsync();

        if (settings == null)
        {
            // Создаем дефолтные настройки если их нет
            settings = new BookingSettings
            {
                Id = SettingsSingletonId,
                CalculationMode = BookingCalculationMode.Days,
                CheckInTime = new TimeSpan(15, 0, 0),
                CheckOutTime = new TimeSpan(12, 0, 0),
                IsSingleton = true
            };

            await _settingsRepository.AddAsync(settings);
            await _context.SaveChangesAsync();
        }

        return settings;
    }
}
