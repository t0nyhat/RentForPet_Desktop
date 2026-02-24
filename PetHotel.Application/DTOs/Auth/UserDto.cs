using PetHotel.Domain.Enums;

namespace PetHotel.Application.DTOs.Auth;

public class UserDto
{
    public Guid Id { get; set; }
    public string Email { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public ClientDto? Client { get; set; }
}
