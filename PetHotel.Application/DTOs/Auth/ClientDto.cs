namespace PetHotel.Application.DTOs.Auth;

public class ClientDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Address { get; set; }
    public decimal LoyaltyDiscountPercent { get; set; }
}
