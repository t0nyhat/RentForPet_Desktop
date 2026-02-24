namespace PetHotel.Application.DTOs.Bookings;

public class BookingClientDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public decimal LoyaltyDiscountPercent { get; set; }
}
