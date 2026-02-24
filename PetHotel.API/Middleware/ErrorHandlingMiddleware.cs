using System.Net;
using System.Text.Json;
using PetHotel.Application.Common.Exceptions;
using PetHotel.API.Services;

namespace PetHotel.API.Middleware;

public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred: {Message}", ex.Message);
            await HandleExceptionAsync(context, ex);
        }
    }

    private static Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        var code = HttpStatusCode.InternalServerError;
        var result = string.Empty;

        switch (exception)
        {
            case NotFoundException notFoundException:
                code = HttpStatusCode.NotFound;
                result = JsonSerializer.Serialize(new { error = notFoundException.Message });
                break;

            case BadRequestException badRequestException:
                code = HttpStatusCode.BadRequest;
                result = JsonSerializer.Serialize(new { error = badRequestException.Message });
                break;

            case UnauthorizedException unauthorizedException:
                code = HttpStatusCode.Unauthorized;
                result = JsonSerializer.Serialize(new { error = unauthorizedException.Message });
                // Метрики безопасности
                BusinessMetrics.UnauthorizedRequests
                .WithLabels(context.Request.Path, context.Request.Method)
                .Inc();
                break;

            case UnauthorizedAccessException unauthorizedAccessException:
                // Если ошибка связана с ClientId, возвращаем 403 Forbidden для более понятного сообщения
                if (unauthorizedAccessException.Message.Contains("ClientId"))
                {
                    code = HttpStatusCode.Forbidden;
                    result = JsonSerializer.Serialize(new
                    {
                        error = "Доступ запрещен",
                        message = unauthorizedAccessException.Message
                    });
                    BusinessMetrics.ForbiddenRequests
                    .WithLabels(context.Request.Path, context.Request.Method)
                    .Inc();
                }
                else
                {
                    code = HttpStatusCode.Unauthorized;
                    result = JsonSerializer.Serialize(new
                    {
                        error = "Требуется авторизация",
                        message = "Пожалуйста, войдите в систему и предоставьте JWT токен",
                        details = unauthorizedAccessException.Message
                    });
                    BusinessMetrics.UnauthorizedRequests
                    .WithLabels(context.Request.Path, context.Request.Method)
                    .Inc();
                }
                break;

            case ForbiddenException forbiddenException:
                code = HttpStatusCode.Forbidden;
                result = JsonSerializer.Serialize(new { error = forbiddenException.Message });
                // Метрики безопасности
                BusinessMetrics.ForbiddenRequests
                .WithLabels(context.Request.Path, context.Request.Method)
                .Inc();
                break;

            default:
                result = JsonSerializer.Serialize(new { error = "Произошла внутренняя ошибка сервера" });
                break;
        }

        context.Response.ContentType = "application/json";
        context.Response.StatusCode = (int)code;

        return context.Response.WriteAsync(result);
    }
}
