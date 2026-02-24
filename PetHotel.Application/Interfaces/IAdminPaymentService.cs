using PetHotel.Application.DTOs.Payments;

namespace PetHotel.Application.Interfaces;

public interface IAdminPaymentService
{
    Task<IEnumerable<PaymentDto>> GetAllPaymentsAsync();
    Task<IEnumerable<PaymentDto>> GetPendingPaymentsAsync();
    Task<PaymentDto> ConfirmPaymentAsync(Guid paymentId, Guid adminId);
    Task<PaymentDto> RejectPaymentAsync(Guid paymentId, Guid adminId);
    Task<PaymentDto> CreateManualPaymentAsync(CreateManualPaymentRequest request, Guid adminId);
}
