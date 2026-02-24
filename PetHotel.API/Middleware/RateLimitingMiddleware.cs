using PetHotel.API.Services;

namespace PetHotel.API.Middleware;

/// <summary>
/// Middleware для логирования и отслеживания событий rate limiting.
/// Работает совместно с AspNetCoreRateLimit для сбора метрик.
/// </summary>
public class RateLimitingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<RateLimitingMiddleware> _logger;

    public RateLimitingMiddleware(RequestDelegate next, ILogger<RateLimitingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        await _next(context);

        // Проверяем, был ли запрос отклонен из-за rate limiting
        if (context.Response.StatusCode == 429)
        {
            var clientIp = GetClientIp(context);
            var endpoint = context.Request.Path.ToString();

            // Маскируем последний октет IP для privacy
            var maskedIp = MaskIpAddress(clientIp);

            _logger.LogWarning(
                "Rate limit exceeded for IP {MaskedIp} on endpoint {Endpoint}",
                maskedIp,
                endpoint);

            // Инкрементируем метрику
            BusinessMetrics.RateLimitExceeded
                .WithLabels(endpoint, maskedIp)
                .Inc();
        }
    }

    private static string GetClientIp(HttpContext context)
    {
        // Получаем реальный IP из заголовка X-Forwarded-For (если за прокси)
        var forwardedFor = context.Request.Headers["X-Forwarded-For"].FirstOrDefault();
        if (!string.IsNullOrEmpty(forwardedFor))
        {
            // Берем первый IP из списка (оригинальный клиент)
            var ip = forwardedFor.Split(',').FirstOrDefault()?.Trim();
            if (!string.IsNullOrEmpty(ip))
            {
                return ip;
            }
        }

        return context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
    }

    private static string MaskIpAddress(string ip)
    {
        if (string.IsNullOrEmpty(ip) || ip == "unknown")
        {
            return "unknown";
        }

        // Для IPv4: маскируем последний октет
        if (ip.Contains('.'))
        {
            var parts = ip.Split('.');
            if (parts.Length == 4)
            {
                return $"{parts[0]}.{parts[1]}.{parts[2]}.xxx";
            }
        }

        // Для IPv6: маскируем последние 64 бита
        if (ip.Contains(':'))
        {
            var parts = ip.Split(':');
            if (parts.Length >= 4)
            {
                return string.Join(":", parts.Take(4)) + ":xxxx:xxxx:xxxx:xxxx";
            }
        }

        return "masked";
    }
}
