using System.Security.Claims;
using System.Text.Encodings.Web;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.DependencyInjection;
using PetHotel.Infrastructure.Data;
using PetHotel.Domain.Enums;
using Microsoft.EntityFrameworkCore;

// Authentication handler that automatically authenticates as Admin from database
public class AllowAllAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private readonly IServiceProvider _serviceProvider;

    public AllowAllAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IServiceProvider serviceProvider)
        : base(options, logger, encoder)
    {
        _serviceProvider = serviceProvider;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // Get admin user from database
        using var scope = _serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var adminUser = await db.Users
            .Include(u => u.Client)
            .FirstOrDefaultAsync(u => u.Role == UserRole.Admin && u.IsActive);

        if (adminUser == null)
        {
            // Fallback to default admin if no admin found in DB
            var claims = new List<Claim>
            {
                new(ClaimTypes.NameIdentifier, "11111111-1111-1111-1111-111111111111"),
                new(ClaimTypes.Email, "admin@localhost"),
                new(ClaimTypes.Role, "Admin"),
            };

            var identity = new ClaimsIdentity(claims, Scheme.Name);
            var principal = new ClaimsPrincipal(identity);
            var ticket = new AuthenticationTicket(principal, Scheme.Name);
            return AuthenticateResult.Success(ticket);
        }

        var adminClaims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, adminUser.Id.ToString()),
            new(ClaimTypes.Email, adminUser.Email ?? "admin@localhost"),
            new(ClaimTypes.Role, "Admin"),
        };

        // Add ClientId if admin has a client profile
        if (adminUser.Client != null)
        {
            adminClaims.Add(new Claim("ClientId", adminUser.Client.Id.ToString()));
        }

        var adminIdentity = new ClaimsIdentity(adminClaims, Scheme.Name);
        var adminPrincipal = new ClaimsPrincipal(adminIdentity);
        var adminTicket = new AuthenticationTicket(adminPrincipal, Scheme.Name);

        return AuthenticateResult.Success(adminTicket);
    }
}
