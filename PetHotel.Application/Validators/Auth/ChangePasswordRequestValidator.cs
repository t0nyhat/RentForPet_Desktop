using FluentValidation;
using PetHotel.Application.DTOs.Auth;

namespace PetHotel.Application.Validators.Auth;

public class ChangePasswordRequestValidator : AbstractValidator<ChangePasswordRequest>
{
    public ChangePasswordRequestValidator()
    {
        RuleFor(x => x.CurrentPassword)
        .NotEmpty().WithMessage("Текущий пароль обязателен");

        RuleFor(x => x.NewPassword)
        .NotEmpty().WithMessage("Новый пароль обязателен")
        .MinimumLength(8).WithMessage("Пароль должен содержать минимум 8 символов")
        .Matches(@"[A-Za-z]").WithMessage("Пароль должен содержать буквы")
        .Matches(@"[0-9]").WithMessage("Пароль должен содержать цифры");

        RuleFor(x => x.ConfirmPassword)
        .Equal(x => x.NewPassword).WithMessage("Пароли не совпадают");
    }
}
