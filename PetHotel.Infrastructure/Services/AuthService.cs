using System.Security.Cryptography;
using AutoMapper;
using PetHotel.Application.Common.Exceptions;
using PetHotel.Application.DTOs.Auth;
using PetHotel.Application.Interfaces;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using PetHotel.Domain.Interfaces;

namespace PetHotel.Application.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IClientRepository _clientRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IJwtTokenService _jwtTokenService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;
    private readonly IEmailService _emailService;

    public AuthService(
    IUserRepository userRepository,
    IClientRepository clientRepository,
    IPasswordHasher passwordHasher,
    IJwtTokenService jwtTokenService,
    IUnitOfWork unitOfWork,
    IMapper mapper,
    IEmailService emailService)
    {
        _userRepository = userRepository;
        _clientRepository = clientRepository;
        _passwordHasher = passwordHasher;
        _jwtTokenService = jwtTokenService;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
        _emailService = emailService;
    }

    private static string GenerateSecureToken()
    {
        var randomBytes = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);
        return Convert.ToBase64String(randomBytes);
    }

    public async Task<AuthResponse> RegisterAsync(RegisterRequest request)
    {
        // Проверяем, существует ли пользователь
        if (await _userRepository.EmailExistsAsync(request.Email))
            throw new BadRequestException("Пользователь с таким email уже существует");

        // Хешируем пароль
        var passwordHash = _passwordHasher.HashPassword(request.Password);

        // Генерируем токен подтверждения email
        var emailConfirmationToken = GenerateSecureToken();

        // Создаем пользователя (локальный режим - без tenant)
        var user = new User
        {
            Email = request.Email,
            PasswordHash = passwordHash,
            Role = UserRole.Client,
            IsActive = true,
            EmailConfirmed = true,
            EmailConfirmationToken = emailConfirmationToken,
            EmailConfirmationTokenExpiry = DateTime.Now.AddHours(24)
        };

        await _unitOfWork.BeginTransactionAsync();

        try
        {
            await _userRepository.AddAsync(user);
            await _unitOfWork.SaveChangesAsync();

            // Создаем профиль клиента
            var client = new Client
            {
                UserId = user.Id,
                FirstName = request.FirstName,
                LastName = request.LastName,
                Phone = request.Phone
            };

            await _clientRepository.AddAsync(client);
            await _unitOfWork.SaveChangesAsync();

            // Генерируем токены
            var accessToken = _jwtTokenService.GenerateAccessToken(user, client.Id);
            var refreshToken = _jwtTokenService.GenerateRefreshToken();

            // Сохраняем refresh token
            user.RefreshToken = refreshToken;
            user.RefreshTokenExpiryTime = _jwtTokenService.GetRefreshTokenExpiryTime();
            await _userRepository.UpdateAsync(user);
            await _unitOfWork.SaveChangesAsync();

            await _unitOfWork.CommitTransactionAsync();

            // Отправляем email подтверждения (опционально, так как EmailConfirmed уже true)
            // await _emailService.SendEmailConfirmationAsync(user.Email, emailConfirmationToken);

            return new AuthResponse
            {
                Token = accessToken,
                RefreshToken = refreshToken,
                ExpiresAt = DateTime.Now.AddMinutes(60),
                User = new UserDto
                {
                    Id = user.Id,
                    Email = user.Email,
                    Role = user.Role,
                    Client = _mapper.Map<ClientDto>(client)
                }
            };
        }
        catch
        {
            await _unitOfWork.RollbackTransactionAsync();
            throw;
        }
    }

    public async Task<AuthResponse> LoginAsync(LoginRequest request)
    {
        // Ищем пользователя
        var user = await _userRepository.GetByEmailWithClientAsync(request.Email);

        if (user == null)
            throw new UnauthorizedException("Неверный email или пароль");

        // Проверяем пароль
        if (!_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
            throw new UnauthorizedException("Неверный email или пароль");

        // Проверяем, подтвержден ли email
        if (!user.EmailConfirmed)
            throw new UnauthorizedException("Email не подтвержден. Проверьте почту для подтверждения.");

        // Проверяем, активен ли пользователь
        if (!user.IsActive)
            throw new UnauthorizedException("Аккаунт деактивирован");

        // Проверяем, что у пользователя есть профиль клиента (только для роли Client)
        if (user.Role == UserRole.Client && user.Client == null)
            throw new BadRequestException("Профиль клиента не найден");

        // Генерируем токены (для SuperAdmin и Admin clientId может быть Guid.Empty)
        var clientId = user.Client?.Id ?? Guid.Empty;
        var accessToken = _jwtTokenService.GenerateAccessToken(user, clientId);
        var refreshToken = _jwtTokenService.GenerateRefreshToken();

        // Сохраняем refresh token
        user.RefreshToken = refreshToken;
        user.RefreshTokenExpiryTime = _jwtTokenService.GetRefreshTokenExpiryTime();
        await _userRepository.UpdateAsync(user);
        await _unitOfWork.SaveChangesAsync();

        return new AuthResponse
        {
            Token = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt = DateTime.Now.AddMinutes(60),
            User = new UserDto
            {
                Id = user.Id,
                Email = user.Email,
                Role = user.Role,
                Client = user.Client != null ? _mapper.Map<ClientDto>(user.Client) : null
            }
        };
    }

    public async Task<AuthResponse> RefreshTokenAsync(string refreshToken)
    {
        // Ищем пользователя по refresh token
        var user = await _userRepository.GetByRefreshTokenAsync(refreshToken);

        if (user == null || user.RefreshToken != refreshToken)
            throw new UnauthorizedException("Недействительный refresh token");

        // Проверяем срок действия
        if (user.RefreshTokenExpiryTime < DateTime.Now)
            throw new UnauthorizedException("Refresh token истек");

        // Проверяем наличие клиента (только для роли Client)
        if (user.Role == UserRole.Client && user.Client == null)
            throw new BadRequestException("Профиль клиента не найден");

        // Генерируем новые токены (для SuperAdmin и Admin clientId может быть Guid.Empty)
        var clientId = user.Client?.Id ?? Guid.Empty;
        var accessToken = _jwtTokenService.GenerateAccessToken(user, clientId);
        var newRefreshToken = _jwtTokenService.GenerateRefreshToken();

        // Обновляем refresh token
        user.RefreshToken = newRefreshToken;
        user.RefreshTokenExpiryTime = _jwtTokenService.GetRefreshTokenExpiryTime();
        await _userRepository.UpdateAsync(user);
        await _unitOfWork.SaveChangesAsync();

        return new AuthResponse
        {
            Token = accessToken,
            RefreshToken = newRefreshToken,
            ExpiresAt = DateTime.Now.AddMinutes(60),
            User = new UserDto
            {
                Id = user.Id,
                Email = user.Email,
                Role = user.Role,
                Client = user.Client != null ? _mapper.Map<ClientDto>(user.Client) : null
            }
        };
    }

    public async Task LogoutAsync(Guid userId)
    {
        var user = await _userRepository.GetByIdAsync(userId);

        if (user == null)
            throw new NotFoundException("Пользователь", userId);

        // Очищаем refresh token
        user.RefreshToken = null;
        user.RefreshTokenExpiryTime = null;
        await _userRepository.UpdateAsync(user);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task<RegisterResponse> ConfirmEmailAsync(ConfirmEmailRequest request)
    {
        var user = await _userRepository.GetByEmailConfirmationTokenAsync(request.Email, request.Token);

        if (user == null)
            return new RegisterResponse { Success = false, Message = "Недействительный токен подтверждения" };

        if (user.EmailConfirmationTokenExpiry < DateTime.Now)
            return new RegisterResponse { Success = false, Message = "Срок действия токена истек" };

        if (user.EmailConfirmed)
            return new RegisterResponse { Success = true, Message = "Email уже подтвержден" };

        user.EmailConfirmed = true;
        user.EmailConfirmationToken = null;
        user.EmailConfirmationTokenExpiry = null;

        await _userRepository.UpdateAsync(user);
        await _unitOfWork.SaveChangesAsync();

        return new RegisterResponse { Success = true, Message = "Email успешно подтвержден" };
    }

    public async Task<RegisterResponse> ForgotPasswordAsync(ForgotPasswordRequest request)
    {
        // Всегда возвращаем успешный ответ, чтобы не раскрывать информацию о существовании email
        var user = await _userRepository.GetByEmailAsync(request.Email);

        if (user != null)
        {
            var resetToken = GenerateSecureToken();
            user.PasswordResetToken = resetToken;
            user.PasswordResetTokenExpiry = DateTime.Now.AddHours(1);

            await _userRepository.UpdateAsync(user);
            await _unitOfWork.SaveChangesAsync();

            await _emailService.SendPasswordResetAsync(user.Email, resetToken);
        }

        return new RegisterResponse
        {
            Success = true,
            Message = "Если указанный email зарегистрирован, вы получите письмо с инструкциями по сбросу пароля"
        };
    }

    public async Task<RegisterResponse> ResetPasswordAsync(ResetPasswordRequest request)
    {
        // Defense-in-depth: also validated by FluentValidation
        if (request.NewPassword != request.ConfirmPassword)
            return new RegisterResponse { Success = false, Message = "Пароли не совпадают" };

        var user = await _userRepository.GetByPasswordResetTokenAsync(request.Email, request.Token);

        if (user == null)
            return new RegisterResponse { Success = false, Message = "Недействительный токен сброса пароля" };

        if (user.PasswordResetTokenExpiry < DateTime.Now)
            return new RegisterResponse { Success = false, Message = "Срок действия токена истек" };

        user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
        user.PasswordResetToken = null;
        user.PasswordResetTokenExpiry = null;

        await _userRepository.UpdateAsync(user);
        await _unitOfWork.SaveChangesAsync();

        return new RegisterResponse { Success = true, Message = "Пароль успешно изменен" };
    }

    public async Task<RegisterResponse> ChangePasswordAsync(Guid userId, ChangePasswordRequest request)
    {
        // Defense-in-depth: also validated by FluentValidation
        if (request.NewPassword != request.ConfirmPassword)
            return new RegisterResponse { Success = false, Message = "Пароли не совпадают" };

        var user = await _userRepository.GetByIdAsync(userId);

        if (user == null)
            throw new NotFoundException("Пользователь", userId);

        if (!_passwordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash))
            return new RegisterResponse { Success = false, Message = "Неверный текущий пароль" };

        user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);

        await _userRepository.UpdateAsync(user);
        await _unitOfWork.SaveChangesAsync();

        return new RegisterResponse { Success = true, Message = "Пароль успешно изменен" };
    }
}
