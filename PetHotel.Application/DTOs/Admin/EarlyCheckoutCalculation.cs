namespace PetHotel.Application.DTOs.Admin;

public class EarlyCheckoutCalculation
{
    public Guid BookingId { get; set; }
    public DateTime OriginalCheckOutDate { get; set; }
    public DateTime ActualCheckOutDate { get; set; }
    public int TotalNights { get; set; }
    public int NightsStayed { get; set; }
    public int NightsUnused { get; set; }
    public decimal TotalPrice { get; set; }
    public decimal PaidAmount { get; set; }
    public decimal PricePerNight { get; set; }
    public decimal AmountForStayedNights { get; set; }
    public decimal RefundAmount { get; set; }
    public bool IsEarlyCheckout { get; set; }
    public string Message { get; set; } = string.Empty;
}
