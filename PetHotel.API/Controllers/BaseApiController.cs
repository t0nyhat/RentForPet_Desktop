using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace PetHotel.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public abstract class BaseApiController : ControllerBase
{
    private static readonly Guid DevAdminId = Guid.Parse("11111111-1111-1111-1111-111111111111");

    protected Guid GetClientId()
    {
        var clientIdClaim = User.FindFirst("ClientId")?.Value;
        if (string.IsNullOrEmpty(clientIdClaim) || !Guid.TryParse(clientIdClaim, out var clientId) || clientId == Guid.Empty)
        {
            var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "unknown";
            var role = User.FindFirst(ClaimTypes.Role)?.Value ?? "unknown";
            var allClaims = string.Join(", ", User.Claims.Select(c => $"{c.Type}={c.Value}"));
            throw new UnauthorizedAccessException(
            $"Не удалось определить ClientId для пользователя {userId} (Role: {role}). " +
            $"ClientId claim: '{clientIdClaim}'. All claims: {allClaims}");
        }
        return clientId;
    }

    protected Guid GetUserId()
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        if (Guid.TryParse(userIdClaim, out var userId))
        {
            return userId;
        }

        // Dev fallback: when AllowAll authentication is used but no NameIdentifier claim is present
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        if (role == "Admin" || role == "1")
        {
            return DevAdminId;
        }

        throw new UnauthorizedAccessException("Не удалось определить пользователя");
    }

    protected bool IsAdmin()
    {
        var roleClaim = User.FindFirst(ClaimTypes.Role)?.Value;
        return roleClaim == "Admin" || roleClaim == "1";
    }

    protected bool IsSuperAdmin()
    {
        var roleClaim = User.FindFirst("Role")?.Value;
        return roleClaim == "SuperAdmin" || roleClaim == "2";
    }
}
