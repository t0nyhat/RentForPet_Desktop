namespace PetHotel.Application.DTOs.Auth;

public class LoginRequest
{
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// Gets or sets subdomain организации для валидации доступа
    /// Если указан, проверяется что TenantId пользователя соответствует организации с этим subdomain.
    /// </summary>
    public string? Subdomain { get; set; }
}
