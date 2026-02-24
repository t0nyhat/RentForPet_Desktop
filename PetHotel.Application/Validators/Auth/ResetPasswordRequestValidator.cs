using FluentValidation;
using PetHotel.Application.DTOs.Auth;

namespace PetHotel.Application.Validators.Auth;

public class ResetPasswordRequestValidator : AbstractValidator<ResetPasswordRequest>
{
    public ResetPasswordRequestValidator()
    {
        RuleFor(x => x.Email)
        .NotEmpty().WithMessage("Email обязателен")
        .EmailAddress().WithMessage("Неверный формат email");

        RuleFor(x => x.Token)
        .NotEmpty().WithMessage("Токен обязателен");

        RuleFor(x => x.NewPassword)
        .NotEmpty().WithMessage("Новый пароль обязателен")
        .MinimumLength(8).WithMessage("Пароль должен содержать минимум 8 символов")
        .Matches(@"[A-Za-z]").WithMessage("Пароль должен содержать буквы")
        .Matches(@"[0-9]").WithMessage("Пароль должен содержать цифры");

        RuleFor(x => x.ConfirmPassword)
        .Equal(x => x.NewPassword).WithMessage("Пароли не совпадают");
    }
}
