namespace PetHotel.Application.DTOs.Admin;

public class AdminClientDto
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? InternalNotes { get; set; }
    public decimal LoyaltyDiscountPercent { get; set; }
    public List<AdminPetDto> Pets { get; set; } = new();
}
