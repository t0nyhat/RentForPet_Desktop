using PetHotel.Domain.Common;
using PetHotel.Domain.Enums;

namespace PetHotel.Domain.Entities;

public class Payment : BaseEntity
{
    public Guid BookingId { get; set; }
    public decimal Amount { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public PaymentStatus PaymentStatus { get; set; }
    public PaymentType PaymentType { get; set; } // Тип платежа (предоплата/полная)
    public decimal? PrepaymentPercentage { get; set; } // Процент предоплаты (если применимо)
    public string? TransactionId { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? PaymentProof { get; set; } // Доказательство оплаты (чек, скриншот и т.д.)
    public string? AdminComment { get; set; } // Комментарий администратора
    public DateTime? ConfirmedAt { get; set; } // Когда администратор подтвердил оплату
    public Guid? ConfirmedByAdminId { get; set; } // Кто подтвердил оплату

    // Navigation properties
    public Booking Booking { get; set; } = null!;
}
