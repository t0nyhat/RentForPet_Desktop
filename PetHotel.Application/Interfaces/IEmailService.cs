namespace PetHotel.Application.Interfaces;

using PetHotel.Application.DTOs.Admin;

public interface IEmailService
{
    Task SendEmailConfirmationAsync(string email, string token);
    Task SendPasswordResetAsync(string email, string token);
    Task SendFeedbackAsync(FeedbackRequestDto request, string? userId, string? role, string? clientId);
}
