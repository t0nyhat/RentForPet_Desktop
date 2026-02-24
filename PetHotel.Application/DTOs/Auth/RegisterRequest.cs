namespace PetHotel.Application.DTOs.Auth;

public class RegisterRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string ConfirmPassword { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets subdomain организации для регистрации клиента в конкретной организации
    /// Если указан, клиент будет создан в этой организации.
    /// </summary>
    public string? Subdomain { get; set; }
}
