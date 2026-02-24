using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PetHotel.Application.DTOs.Auth;
using PetHotel.Application.Interfaces;
using System.Security.Claims;
using PetHotel.API.Services;

namespace PetHotel.API.Controllers;

public class AuthController : BaseApiController
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
    {
        _authService = authService;
    }

    /// <summary>
    /// Регистрация нового пользователя.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponse>> Register([FromBody] RegisterRequest request)
    {
        var response = await _authService.RegisterAsync(request);

        // Метрики
        BusinessMetrics.UsersRegistered.Inc();

        return Ok(response);
    }

    /// <summary>
    /// Вход в систему.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        try
        {
            var response = await _authService.LoginAsync(request);

            // Метрики успешного входа
            BusinessMetrics.UsersLoggedIn.Inc();

            return Ok(response);
        }
        catch (PetHotel.Application.Common.Exceptions.UnauthorizedException)
        {
            // Метрики неудачного входа
            BusinessMetrics.UsersLoginFailed.WithLabels("invalid_credentials").Inc();
            throw;
        }
        catch
        {
            // Метрики других ошибок входа
            BusinessMetrics.UsersLoginFailed.WithLabels("error").Inc();
            throw;
        }
    }

    /// <summary>
    /// Обновление токена.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    [HttpPost("refresh")]
    public async Task<ActionResult<AuthResponse>> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var response = await _authService.RefreshTokenAsync(request.RefreshToken);
        return Ok(response);
    }

    /// <summary>
    /// Выход из системы.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    [HttpPost("logout")]
    public async Task<ActionResult> Logout()
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);
        await _authService.LogoutAsync(userId);
        return NoContent();
    }

    /// <summary>
    /// Получить информацию о текущем пользователе.
    /// </summary>
    /// <returns></returns>
    [HttpGet("me")]
    public ActionResult GetCurrentUser()
    {
        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var email = User.FindFirst(ClaimTypes.Email)?.Value;
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        var clientId = User.FindFirst("ClientId")?.Value;

        var allClaims = User.Claims.Select(c => new { c.Type, c.Value }).ToList();

        return Ok(new
        {
            userId,
            email,
            role,
            clientId,
            allClaims
        });
    }

    /// <summary>
    /// Подтверждение email по токену.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    [HttpGet("confirm-email")]
    public async Task<ActionResult<RegisterResponse>> ConfirmEmail([FromQuery] string token, [FromQuery] string email)
    {
        var request = new ConfirmEmailRequest { Token = token, Email = email };
        var response = await _authService.ConfirmEmailAsync(request);
        return Ok(response);
    }

    /// <summary>
    /// Запрос на сброс пароля.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    [HttpPost("forgot-password")]
    public async Task<ActionResult<RegisterResponse>> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        var response = await _authService.ForgotPasswordAsync(request);
        return Ok(response);
    }

    /// <summary>
    /// Сброс пароля по токену.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    [HttpPost("reset-password")]
    public async Task<ActionResult<RegisterResponse>> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        var response = await _authService.ResetPasswordAsync(request);
        return Ok(response);
    }

    /// <summary>
    /// Смена пароля (требует авторизации).
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    [HttpPost("change-password")]
    public async Task<ActionResult<RegisterResponse>> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = Guid.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value!);
        var response = await _authService.ChangePasswordAsync(userId, request);
        return Ok(response);
    }
}
