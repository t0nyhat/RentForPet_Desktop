using PetHotel.Application.DTOs.Auth;

namespace PetHotel.Application.Interfaces;

public interface IAuthService
{
    Task<AuthResponse> RegisterAsync(RegisterRequest request);
    Task<AuthResponse> LoginAsync(LoginRequest request);
    Task<AuthResponse> RefreshTokenAsync(string refreshToken);
    Task LogoutAsync(Guid userId);
    Task<RegisterResponse> ConfirmEmailAsync(ConfirmEmailRequest request);
    Task<RegisterResponse> ForgotPasswordAsync(ForgotPasswordRequest request);
    Task<RegisterResponse> ResetPasswordAsync(ResetPasswordRequest request);
    Task<RegisterResponse> ChangePasswordAsync(Guid userId, ChangePasswordRequest request);
}
