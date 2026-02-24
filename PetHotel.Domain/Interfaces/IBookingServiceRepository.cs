using PetHotel.Domain.Entities;

namespace PetHotel.Domain.Interfaces;

public interface IBookingServiceRepository : IRepository<BookingService>
{
    Task<IEnumerable<BookingService>> GetByBookingIdAsync(Guid bookingId);
    Task DeleteByBookingIdAsync(Guid bookingId);
}
