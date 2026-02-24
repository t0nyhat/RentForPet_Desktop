using FluentValidation;
using PetHotel.Application.DTOs.Auth;

namespace PetHotel.Application.Validators.Auth;

public class ConfirmEmailRequestValidator : AbstractValidator<ConfirmEmailRequest>
{
    public ConfirmEmailRequestValidator()
    {
        RuleFor(x => x.Email)
        .NotEmpty().WithMessage("Email обязателен")
        .EmailAddress().WithMessage("Неверный формат email");

        RuleFor(x => x.Token)
        .NotEmpty().WithMessage("Токен обязателен");
    }
}
