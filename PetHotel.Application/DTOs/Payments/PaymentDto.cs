using PetHotel.Application.DTOs.Bookings;
using PetHotel.Domain.Enums;

namespace PetHotel.Application.DTOs.Payments;

public class PaymentDto
{
    public Guid Id { get; set; }
    public Guid BookingId { get; set; }
    public decimal Amount { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public PaymentStatus PaymentStatus { get; set; }
    public PaymentType PaymentType { get; set; }
    public decimal? PrepaymentPercentage { get; set; }
    public string? TransactionId { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? PaymentProof { get; set; }
    public string? AdminComment { get; set; }
    public DateTime? ConfirmedAt { get; set; }
    public Guid? ConfirmedByAdminId { get; set; }
    public DateTime CreatedAt { get; set; }

    // Вложенная информация о бронировании для админки
    public BookingDto? Booking { get; set; }
}
