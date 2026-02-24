using PetHotel.Domain.Enums;

namespace PetHotel.Application.DTOs.Payments;

public class CreateManualPaymentRequest
{
    public Guid BookingId { get; set; }
    public decimal Amount { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public PaymentType PaymentType { get; set; }
    public string? AdminComment { get; set; } // Комментарий администратора
    public bool AutoConfirm { get; set; } = true; // Автоматически подтвердить платеж
}
