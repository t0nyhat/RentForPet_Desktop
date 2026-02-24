namespace PetHotel.API.Middleware;

/// <summary>
/// Middleware that adds security headers to HTTP responses to protect against common web vulnerabilities.
/// </summary>
public class SecurityHeadersMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<SecurityHeadersMiddleware> _logger;
    private readonly IConfiguration _configuration;

    public SecurityHeadersMiddleware(RequestDelegate next, ILogger<SecurityHeadersMiddleware> logger, IConfiguration configuration)
    {
        _next = next;
        _logger = logger;
        _configuration = configuration;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Check if security headers are enabled (default: true)
        var enabled = _configuration.GetValue<bool>("SecurityHeaders:Enabled", true);

        if (enabled)
        {
            // Add security headers to response
            AddSecurityHeaders(context);
        }

        await _next(context);
    }

    private void AddSecurityHeaders(HttpContext context)
    {
        var headers = context.Response.Headers;

        // X-Frame-Options: Защита от clickjacking атак
        // DENY - страница не может быть отображена в iframe/frame
        if (!headers.ContainsKey("X-Frame-Options"))
        {
            headers.Append("X-Frame-Options", "DENY");
        }

        // X-Content-Type-Options: Защита от MIME-sniffing атак
        // nosniff - браузер не должен пытаться определить MIME-тип отличный от указанного в Content-Type
        if (!headers.ContainsKey("X-Content-Type-Options"))
        {
            headers.Append("X-Content-Type-Options", "nosniff");
        }

        // X-XSS-Protection: Устаревшая защита от XSS (для старых браузеров)
        // 1; mode=block - включить фильтр XSS и блокировать страницу при обнаружении атаки
        // Примечание: В современных браузерах заменено Content-Security-Policy
        if (!headers.ContainsKey("X-XSS-Protection"))
        {
            headers.Append("X-XSS-Protection", "1; mode=block");
        }

        // Content-Security-Policy: Основная защита от XSS и injection атак
        // Для API используем строгую политику, так как не отдаем HTML
        if (!headers.ContainsKey("Content-Security-Policy"))
        {
            var csp = "default-src 'none'; " + // Блокировать все по умолчанию
                      "frame-ancestors 'none'; " + // Запретить отображение в iframe (альтернатива X-Frame-Options)
                      "base-uri 'self'; " + // Ограничить base URI
                      "form-action 'self'"; // Разрешить отправку форм только на свой домен

            headers.Append("Content-Security-Policy", csp);
        }

        // Strict-Transport-Security (HSTS): Принудительное использование HTTPS
        // max-age=31536000 - 1 год в секундах
        // includeSubDomains - применять HSTS ко всем поддоменам
        // preload - разрешить включение в HSTS preload список браузеров
        if (!headers.ContainsKey("Strict-Transport-Security"))
        {
            headers.Append("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
        }

        // Referrer-Policy: Контроль передачи referrer информации
        // strict-origin-when-cross-origin - полный URL для same-origin, только origin для cross-origin при HTTPS
        if (!headers.ContainsKey("Referrer-Policy"))
        {
            headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
        }

        // Permissions-Policy: Контроль доступа к browser features и APIs
        // Отключаем потенциально опасные features для API
        if (!headers.ContainsKey("Permissions-Policy"))
        {
            var permissionsPolicy = "geolocation=(), " + // Блокировать геолокацию
                                   "camera=(), " + // Блокировать камеру
                                   "microphone=(), " + // Блокировать микрофон
                                   "payment=(), " + // Блокировать Payment API
                                   "usb=(), " + // Блокировать USB API
                                   "magnetometer=(), " + // Блокировать магнитометр
                                   "gyroscope=(), " + // Блокировать гироскоп
                                   "accelerometer=()"; // Блокировать акселерометр

            headers.Append("Permissions-Policy", permissionsPolicy);
        }

        // X-Permitted-Cross-Domain-Policies: Контроль cross-domain политик (Adobe Flash, PDF)
        // none - запретить загрузку cross-domain policy файлов
        if (!headers.ContainsKey("X-Permitted-Cross-Domain-Policies"))
        {
            headers.Append("X-Permitted-Cross-Domain-Policies", "none");
        }

        _logger.LogDebug("Security headers added to response for {Path}", context.Request.Path);
    }
}
