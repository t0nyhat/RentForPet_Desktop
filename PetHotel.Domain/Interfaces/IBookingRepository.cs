using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;

namespace PetHotel.Domain.Interfaces;

public interface IBookingRepository : IRepository<Booking>
{
    Task<IEnumerable<Booking>> GetByClientIdAsync(Guid clientId);
    Task<Booking?> GetByIdWithDetailsAsync(Guid id);
    Task<Booking?> GetByIdAndClientIdAsync(Guid id, Guid clientId);
    Task<bool> IsRoomAvailableAsync(Guid roomId, DateTime checkIn, DateTime checkOut, Guid? excludeBookingId = null);
    Task<bool> HasActiveBookingsForRoomAsync(Guid roomId);
    Task<IEnumerable<Booking>> GetRoomBookingsInRangeAsync(Guid roomId, DateTime from, DateTime to);
    Task<IEnumerable<Booking>> GetAllWithDetailsAsync(DateTime? from = null, DateTime? to = null, BookingStatus? status = null);
    Task<Booking?> GetByIdAsync(Guid id, bool includeDetails = false);
    Task<IEnumerable<Booking>> GetOverlappingBookingsAsync(Guid roomId, DateTime checkIn, DateTime checkOut, Guid? excludeBookingId = null);
    Task<IEnumerable<Booking>> GetOverlappingBookingsAsync(DateTime checkIn, DateTime checkOut);
    Task<IEnumerable<Booking>> GetBookingsForRoomTypeInPeriodAsync(Guid roomTypeId, DateTime start, DateTime end);
    Task<IEnumerable<Booking>> GetBookingsRequiringPaymentAsync();
    Task<IEnumerable<Booking>> GetBookingsRequiringRefundAsync();
    Task<bool> HasActiveBookingsAsync();
}
