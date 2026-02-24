using FluentValidation;
using PetHotel.Application.DTOs.Auth;

namespace PetHotel.Application.Validators.Auth;

public class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(x => x.Email)
        .NotEmpty().WithMessage("Email обязателен")
        .EmailAddress().WithMessage("Неверный формат email")
        .MaximumLength(256);

        RuleFor(x => x.Password)
        .NotEmpty().WithMessage("Пароль обязателен")
        .MinimumLength(8).WithMessage("Пароль должен содержать минимум 8 символов")
        .Matches(@"[A-Za-z]").WithMessage("Пароль должен содержать буквы")
        .Matches(@"[0-9]").WithMessage("Пароль должен содержать цифры");

        RuleFor(x => x.ConfirmPassword)
        .Equal(x => x.Password).WithMessage("Пароли не совпадают");

        RuleFor(x => x.FirstName)
        .NotEmpty().WithMessage("Имя обязательно")
        .MaximumLength(100);

        RuleFor(x => x.LastName)
        .NotEmpty().WithMessage("Фамилия обязательна")
        .MaximumLength(100);

        RuleFor(x => x.Phone)
        .NotEmpty().WithMessage("Телефон обязателен")
        .Matches(@"^\+?[1-9]\d{1,14}$").WithMessage("Неверный формат телефона")
        .MaximumLength(20);
    }
}
