namespace PetHotel.Application.DTOs.Auth;

public class ConfirmEmailRequest
{
    public string Token { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}
