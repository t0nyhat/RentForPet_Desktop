using PetHotel.Domain.Entities;

namespace PetHotel.Application.Interfaces;

public interface IJwtTokenService
{
    string GenerateAccessToken(User user, Guid clientId);
    string GenerateRefreshToken();
    DateTime GetRefreshTokenExpiryTime();
}
