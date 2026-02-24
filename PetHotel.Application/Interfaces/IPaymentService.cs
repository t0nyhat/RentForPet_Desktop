using PetHotel.Application.DTOs.Payments;

namespace PetHotel.Application.Interfaces;

public interface IPaymentService
{
    Task<PaymentDto> CreatePaymentAsync(CreatePaymentRequest request, Guid clientId);
    Task<IEnumerable<PaymentDto>> GetBookingPaymentsAsync(Guid bookingId, Guid clientId);
    Task<IEnumerable<PaymentDto>> GetBookingPaymentsByAdminAsync(Guid bookingId);
}
