using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;
using PetHotel.Application.Common.Settings;
using PetHotel.Application.Interfaces;

namespace PetHotel.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly EmailSettings _emailSettings;

    public EmailService(IOptions<EmailSettings> emailSettings)
    {
        _emailSettings = emailSettings.Value;
    }

    public async Task SendEmailConfirmationAsync(string email, string token)
    {
        var confirmationLink = $"{_emailSettings.FrontendUrl}/confirm-email?token={Uri.EscapeDataString(token)}&email={Uri.EscapeDataString(email)}";

        var subject = "Подтверждение email - PetHotel";
        var body = $@"
 <html>
 <body>
 <h2>Добро пожаловать в PetHotel!</h2>
 <p>Для подтверждения вашего email перейдите по ссылке:</p>
 <p><a href=""{confirmationLink}"">Подтвердить email</a></p>
 <p>Или скопируйте ссылку в браузер:</p>
 <p>{confirmationLink}</p>
 <p>Ссылка действительна 24 часа.</p>
 <br/>
 <p>С уважением,<br/>Команда PetHotel</p>
 </body>
 </html>";

        await SendEmailAsync(email, subject, body);
    }

    public async Task SendPasswordResetAsync(string email, string token)
    {
        var resetLink = $"{_emailSettings.FrontendUrl}/reset-password?token={Uri.EscapeDataString(token)}&email={Uri.EscapeDataString(email)}";

        var subject = "Сброс пароля - PetHotel";
        var body = $@"
 <html>
 <body>
 <h2>Сброс пароля</h2>
 <p>Вы запросили сброс пароля для вашего аккаунта в PetHotel.</p>
 <p>Для сброса пароля перейдите по ссылке:</p>
 <p><a href=""{resetLink}"">Сбросить пароль</a></p>
 <p>Или скопируйте ссылку в браузер:</p>
 <p>{resetLink}</p>
 <p>Ссылка действительна 1 час.</p>
 <p>Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
 <br/>
 <p>С уважением,<br/>Команда PetHotel</p>
 </body>
 </html>";

        await SendEmailAsync(email, subject, body);
    }

    public async Task SendFeedbackAsync(PetHotel.Application.DTOs.Admin.FeedbackRequestDto request, string? userId, string? role, string? clientId)
    {
        var supportEmail = _emailSettings.SupportEmail ?? _emailSettings.FromEmail;
        if (string.IsNullOrEmpty(supportEmail))
        {
            Console.WriteLine("[EmailService] Support email not configured. Feedback would be sent but SMTP not available.");
            return;
        }

        var subject = "Feedback - PetHotel Admin";
        var body = $@"
<html>
<body>
<h2>New feedback message</h2>
<p><strong>Name:</strong> {WebUtility.HtmlEncode(request.Name)}</p>
<p><strong>Email:</strong> {WebUtility.HtmlEncode(request.Email)}</p>
<p><strong>Message:</strong></p>
<pre style=""white-space: pre-wrap; font-family: inherit;"">{WebUtility.HtmlEncode(request.Message)}</pre>
<hr />
<p><strong>UserId:</strong> {WebUtility.HtmlEncode(userId ?? "N/A")}</p>
<p><strong>Role:</strong> {WebUtility.HtmlEncode(role ?? "N/A")}</p>
<p><strong>ClientId:</strong> {WebUtility.HtmlEncode(clientId ?? "N/A")}</p>
</body>
</html>";

        await SendEmailAsync(supportEmail, subject, body);
    }

    private async Task SendEmailAsync(string to, string subject, string body)
    {
        if (string.IsNullOrEmpty(_emailSettings.SmtpServer))
        {
            // If SMTP is not configured, log and skip (useful for development)
            Console.WriteLine($"[EmailService] SMTP not configured. Would send email to: {to}, Subject: {subject}");
            return;
        }

        using var client = new SmtpClient(_emailSettings.SmtpServer, _emailSettings.SmtpPort)
        {
            Credentials = new NetworkCredential(_emailSettings.SmtpUsername, _emailSettings.SmtpPassword),
            EnableSsl = _emailSettings.EnableSsl
        };

        using var mailMessage = new MailMessage
        {
            From = new MailAddress(_emailSettings.FromEmail, _emailSettings.FromName),
            Subject = subject,
            Body = body,
            IsBodyHtml = true
        };
        mailMessage.To.Add(to);

        await client.SendMailAsync(mailMessage);
    }
}
