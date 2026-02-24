using Microsoft.EntityFrameworkCore;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using PetHotel.Domain.Interfaces;
using PetHotel.Infrastructure.Data;

namespace PetHotel.Infrastructure.Repositories;

public class BookingRepository : Repository<Booking>, IBookingRepository
{
    public BookingRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task<IEnumerable<Booking>> GetByClientIdAsync(Guid clientId)
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query
        .Include(b => b.RoomType)
        .Include(b => b.AssignedRoom)
        .Include(b => b.Client)
        .ThenInclude(c => c.User)
        .Include(b => b.BookingPets)
        .ThenInclude(bp => bp.Pet)
        .Include(b => b.BookingServices)
        .ThenInclude(bs => bs.Service)
        .Include(b => b.Payments) // Добавлено для расчета paidAmount и remainingAmount
        .Include(b => b.ChildBookings) // Загружаем дочерние бронирования (сегменты для составных бронирований)
        .ThenInclude(cb => cb.RoomType)
        .Include(b => b.ChildBookings) // Повторный Include для загрузки AssignedRoom у дочерних
        .ThenInclude(cb => cb.AssignedRoom)
        .Include(b => b.ChildBookings) // Загружаем платежи дочерних бронирований
        .ThenInclude(cb => cb.Payments)
        .Where(b => b.ClientId == clientId)
        .OrderByDescending(b => b.CreatedAt)
        .ToListAsync();
    }

    public async Task<Booking?> GetByIdWithDetailsAsync(Guid id)
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query
        .Include(b => b.RoomType)
        .Include(b => b.AssignedRoom)
        .ThenInclude(r => r!.RoomType) // Загружаем RoomType для назначенного номера
        .Include(b => b.Client)
        .ThenInclude(c => c.User)
        .Include(b => b.BookingPets)
        .ThenInclude(bp => bp.Pet)
        .Include(b => b.BookingServices)
        .ThenInclude(bs => bs.Service)
        .Include(b => b.Payments)
        .Include(b => b.ChildBookings) // Загружаем дочерние бронирования (сегменты)
        .ThenInclude(cb => cb.RoomType)
        .Include(b => b.ChildBookings) // Повторный Include для загрузки AssignedRoom у дочерних
        .ThenInclude(cb => cb.AssignedRoom)
        .Include(b => b.ChildBookings) // Загрузка питомцев для дочерних бронирований
        .ThenInclude(cb => cb.BookingPets)
        .ThenInclude(bp => bp.Pet)
        .Include(b => b.ChildBookings) // Загружаем платежи дочерних бронирований
        .ThenInclude(cb => cb.Payments)
        .FirstOrDefaultAsync(b => b.Id == id);
    }

    public async Task<Booking?> GetByIdAndClientIdAsync(Guid id, Guid clientId)
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query
        .Include(b => b.RoomType)
        .Include(b => b.AssignedRoom)
        .ThenInclude(r => r!.RoomType) // Загружаем RoomType для назначенного номера
        .Include(b => b.Client)
        .ThenInclude(c => c.User)
        .Include(b => b.BookingPets)
        .ThenInclude(bp => bp.Pet)
        .Include(b => b.BookingServices)
        .ThenInclude(bs => bs.Service)
        .Include(b => b.Payments) // Добавлено для расчета paidAmount и remainingAmount
        .Include(b => b.ChildBookings) // Загружаем дочерние бронирования (сегменты)
        .ThenInclude(cb => cb.RoomType)
        .Include(b => b.ChildBookings) // Загрузка AssignedRoom для дочерних
        .ThenInclude(cb => cb.AssignedRoom)
        .Include(b => b.ChildBookings) // Загрузка питомцев для дочерних
        .ThenInclude(cb => cb.BookingPets)
        .ThenInclude(bp => bp.Pet)
        .Include(b => b.ChildBookings) // Загружаем платежи дочерних бронирований
        .ThenInclude(cb => cb.Payments)
        .FirstOrDefaultAsync(b => b.Id == id && b.ClientId == clientId);
    }

    public async Task<bool> IsRoomAvailableAsync(Guid roomId, DateTime checkIn, DateTime checkOut, Guid? excludeBookingId = null)
    {
        var query = _dbSet.Where(b =>
        b.AssignedRoomId == roomId &&
        b.Status != BookingStatus.Cancelled &&
        checkIn <= b.CheckOutDate && checkOut >= b.CheckInDate);

        if (excludeBookingId.HasValue)
            query = query.Where(b => b.Id != excludeBookingId.Value);

        return !await query.AnyAsync();
    }

    public async Task<bool> HasActiveBookingsForRoomAsync(Guid roomId)
    {
        return await _dbSet.AnyAsync(b =>
        b.AssignedRoomId == roomId &&
        b.Status != BookingStatus.Cancelled &&
        b.Status != BookingStatus.CheckedOut);
    }

    public async Task<IEnumerable<Booking>> GetRoomBookingsInRangeAsync(Guid roomId, DateTime from, DateTime to)
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query
        .Include(b => b.RoomType)
        .Include(b => b.Client)
        .ThenInclude(c => c.User)
        .Include(b => b.BookingPets)
        .ThenInclude(bp => bp.Pet)
        .Include(b => b.Payments) // Добавлено для расчета paidAmount и remainingAmount
        .Where(b => b.AssignedRoomId == roomId &&
        b.Status != BookingStatus.Cancelled &&
        b.CheckOutDate > from &&
        b.CheckInDate < to)
        .ToListAsync();
    }

    public async Task<IEnumerable<Booking>> GetAllWithDetailsAsync(DateTime? from = null, DateTime? to = null, BookingStatus? status = null)
    {
        var query = _dbSet
        .AsNoTracking() // Оптимизация: read-only query
        .AsSplitQuery() // Оптимизация: разделяем запросы для избежания картезианского произведения
        .Include(b => b.RoomType)
        .Include(b => b.AssignedRoom)
        .ThenInclude(r => r!.RoomType) // Загружаем RoomType для назначенного номера
        .Include(b => b.Client)
        .ThenInclude(c => c.User)
        .Include(b => b.BookingPets)
        .ThenInclude(bp => bp.Pet)
        .Include(b => b.BookingServices)
        .ThenInclude(bs => bs.Service)
        .Include(b => b.Payments) // Добавлено для расчета paidAmount и remainingAmount
        .Include(b => b.ChildBookings) // Загружаем дочерние бронирования (сегменты для составных бронирований)
        .ThenInclude(cb => cb.RoomType)
        .Include(b => b.ChildBookings) // Повторный Include для загрузки AssignedRoom у дочерних
        .ThenInclude(cb => cb.AssignedRoom)
        .Include(b => b.ChildBookings) // Загрузка питомцев для дочерних бронирований
        .ThenInclude(cb => cb.BookingPets)
        .ThenInclude(bp => bp.Pet)
        .Include(b => b.ChildBookings) // Загружаем платежи дочерних бронирований
        .ThenInclude(cb => cb.Payments)
        .AsQueryable();

        if (from.HasValue)
        {
            var fromDate = from.Value.Date;
            query = query.Where(b => b.CheckOutDate >= fromDate);
        }

        if (to.HasValue)
        {
            var toDate = to.Value.Date;
            query = query.Where(b => b.CheckInDate <= toDate);
        }

        if (status.HasValue)
        {
            query = query.Where(b => b.Status == status.Value);
        }

        return await query
        .OrderBy(b => b.CheckInDate)
        .ThenBy(b => b.AssignedRoom != null ? b.AssignedRoom.RoomNumber : "")
        .ToListAsync();
    }

    public async Task<Booking?> GetByIdAsync(Guid id, bool includeDetails = false)
    {
        if (!includeDetails)
        {
            return await base.GetByIdAsync(id);
        }

        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query
        .Include(b => b.RoomType)
        .Include(b => b.AssignedRoom)
        .Include(b => b.Client)
        .ThenInclude(c => c.User)
        .Include(b => b.BookingPets)
        .ThenInclude(bp => bp.Pet)
        .Include(b => b.BookingServices)
        .ThenInclude(bs => bs.Service)
        .Include(b => b.Payments) // Добавлено для расчета paidAmount и remainingAmount
        .FirstOrDefaultAsync(b => b.Id == id);
    }

    public async Task<IEnumerable<Booking>> GetOverlappingBookingsAsync(Guid roomId, DateTime checkIn, DateTime checkOut, Guid? excludeBookingId = null)
    {
        var query = _dbSet
        .Where(b => b.AssignedRoomId == roomId)
        .Where(b => b.Status != BookingStatus.Cancelled)
        .Where(b => checkIn <= b.CheckOutDate && checkOut >= b.CheckInDate);

        if (excludeBookingId.HasValue)
        {
            query = query.Where(b => b.Id != excludeBookingId.Value);
        }

        return await query.ToListAsync();
    }

    public async Task<IEnumerable<Booking>> GetOverlappingBookingsAsync(DateTime checkIn, DateTime checkOut)
    {
        return await _dbSet
        .Where(b => b.Status != BookingStatus.Cancelled)
        .Where(b => checkIn <= b.CheckOutDate && checkOut >= b.CheckInDate)
        .ToListAsync();
    }

    public async Task<IEnumerable<Booking>> GetBookingsForRoomTypeInPeriodAsync(Guid roomTypeId, DateTime start, DateTime end)
    {
        return await _dbSet
        .AsNoTracking() // Оптимизация: read-only query
        .Include(b => b.AssignedRoom)
        .Where(b => b.RoomTypeId == roomTypeId)
        .Where(b => b.Status != BookingStatus.Cancelled)
        .Where(b => !b.IsComposite) // Исключаем родительские составные бронирования - они не занимают номера
        .Where(b => start <= b.CheckOutDate && end >= b.CheckInDate)
        .OrderBy(b => b.CheckInDate)
        .ToListAsync();
    }

    public async Task<IEnumerable<Booking>> GetBookingsRequiringPaymentAsync()
    {
        // Оптимизированный запрос: фильтруем на уровне БД
        return await _dbSet
        .AsNoTracking()
        .AsSplitQuery()
        .Include(b => b.RoomType)
        .Include(b => b.AssignedRoom)
        .ThenInclude(r => r!.RoomType)
        .Include(b => b.Client)
        .ThenInclude(c => c.User)
        .Include(b => b.BookingPets)
        .ThenInclude(bp => bp.Pet)
        .Include(b => b.BookingServices)
        .ThenInclude(bs => bs.Service)
        .Include(b => b.Payments)
        .Include(b => b.ChildBookings)
        .ThenInclude(cb => cb.RoomType)
        .Include(b => b.ChildBookings)
        .ThenInclude(cb => cb.AssignedRoom)
        .Include(b => b.ChildBookings)
        .ThenInclude(cb => cb.BookingPets)
        .ThenInclude(bp => bp.Pet)
        .Include(b => b.ChildBookings) // Загружаем платежи дочерних бронирований
        .ThenInclude(cb => cb.Payments)
        .Where(b => b.Status == BookingStatus.AwaitingPayment ||
        b.Status == BookingStatus.Confirmed ||
        b.Status == BookingStatus.CheckedIn)
        .OrderBy(b => b.CheckInDate)
        .ToListAsync();
    }

    public async Task<IEnumerable<Booking>> GetBookingsRequiringRefundAsync()
    {
        // Оптимизированный запрос: фильтруем на уровне БД
        return await _dbSet
        .AsNoTracking()
        .AsSplitQuery()
        .Include(b => b.RoomType)
        .Include(b => b.AssignedRoom)
        .ThenInclude(r => r!.RoomType)
        .Include(b => b.Client)
        .ThenInclude(c => c.User)
        .Include(b => b.BookingPets)
        .ThenInclude(bp => bp.Pet)
        .Include(b => b.BookingServices)
        .ThenInclude(bs => bs.Service)
        .Include(b => b.Payments)
        .Include(b => b.ChildBookings)
        .ThenInclude(cb => cb.RoomType)
        .Include(b => b.ChildBookings)
        .ThenInclude(cb => cb.AssignedRoom)
        .Include(b => b.ChildBookings)
        .ThenInclude(cb => cb.BookingPets)
        .ThenInclude(bp => bp.Pet)
        .Include(b => b.ChildBookings) // Загружаем платежи дочерних бронирований
        .ThenInclude(cb => cb.Payments)
        .Where(b => (b.Status == BookingStatus.CheckedOut ||
        b.Status == BookingStatus.Cancelled) &&
        !b.OverpaymentConvertedToRevenue) // Исключаем бронирования, где остаток уже зачислен в доход
        .OrderBy(b => b.CheckInDate)
        .ToListAsync();
    }

    public async Task<bool> HasActiveBookingsAsync()
    {
        // Активными считаются все бронирования кроме Cancelled и CheckedOut
        return await _dbSet.AnyAsync(b =>
        b.Status != BookingStatus.Cancelled &&
        b.Status != BookingStatus.CheckedOut);
    }
}
