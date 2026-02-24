using PetHotel.Application.DTOs.Bookings;
using PetHotel.Application.DTOs.Pets;
using PetHotel.Domain.Enums;

namespace PetHotel.Application.DTOs.Payments;

public class ReceiptDto
{
    public Guid BookingId { get; set; }
    public string BookingNumber { get; set; } = string.Empty;
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
    public int NumberOfNights { get; set; }
    public string RoomTypeName { get; set; } = string.Empty;
    public decimal DiscountPercent { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal Subtotal { get; set; }
    public decimal Total { get; set; }
    public decimal Paid { get; set; }
    public decimal Remaining { get; set; }
    public decimal RefundDue { get; set; }
    public string ClientName { get; set; } = string.Empty;
    public string ClientEmail { get; set; } = string.Empty;
    public string ClientPhone { get; set; } = string.Empty;
    public List<PetSummaryDto> Pets { get; set; } = new();
    public List<ReceiptLineDto> Lines { get; set; } = new();
    public List<ReceiptPaymentDto> Payments { get; set; } = new();
}

public class PetSummaryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Species { get; set; }
    public int Gender { get; set; }
}

public class ReceiptLineDto
{
    public string Title { get; set; } = string.Empty;
    public string? Details { get; set; }
    public decimal Amount { get; set; }
}

public class ReceiptPaymentDto
{
    public Guid Id { get; set; }
    public decimal Amount { get; set; }
    public PaymentMethod PaymentMethod { get; set; }
    public PaymentStatus PaymentStatus { get; set; }
    public PaymentType PaymentType { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? PaidAt { get; set; }
    public string? TransactionId { get; set; }
}
