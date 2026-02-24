using PetHotel.Domain.Enums;

namespace PetHotel.Application.DTOs.Payments;

public class CreatePaymentRequest
{
    public Guid BookingId { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public PaymentType PaymentType { get; set; }
    public decimal Amount { get; set; }
    public decimal? PrepaymentPercentage { get; set; }
    public string? PaymentProof { get; set; } // Доказательство оплаты (URL чека, скриншот и т.д.)
}
