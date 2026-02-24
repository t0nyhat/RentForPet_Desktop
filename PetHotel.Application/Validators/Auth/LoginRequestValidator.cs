using FluentValidation;
using PetHotel.Application.DTOs.Auth;

namespace PetHotel.Application.Validators.Auth;

public class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(x => x.Email)
        .NotEmpty().WithMessage("Email обязателен")
        .EmailAddress().WithMessage("Неверный формат email");

        RuleFor(x => x.Password)
        .NotEmpty().WithMessage("Пароль обязателен");
    }
}
