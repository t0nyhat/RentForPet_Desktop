using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;

namespace PetHotel.Domain.Interfaces;

public interface IPaymentRepository : IRepository<Payment>
{
    Task<IEnumerable<Payment>> GetAllWithBookingsAsync();
    Task<IEnumerable<Payment>> GetByBookingIdAsync(Guid bookingId);
    Task<IEnumerable<Payment>> GetPendingPaymentsAsync();
    Task<Payment?> GetByIdWithBookingAsync(Guid id);
}
