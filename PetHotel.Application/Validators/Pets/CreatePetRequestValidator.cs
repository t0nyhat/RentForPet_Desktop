using FluentValidation;
using PetHotel.Application.DTOs.Pets;

namespace PetHotel.Application.Validators.Pets;

public class CreatePetRequestValidator : AbstractValidator<CreatePetRequest>
{
    public CreatePetRequestValidator()
    {
        RuleFor(x => x.Name)
        .NotEmpty().WithMessage("Имя питомца обязательно")
        .MaximumLength(100);

        RuleFor(x => x.Species)
        .IsInEnum().WithMessage("Неверный вид животного");

        RuleFor(x => x.Breed)
        .MaximumLength(100).When(x => !string.IsNullOrEmpty(x.Breed));

        RuleFor(x => x.BirthDate)
        .LessThan(DateTime.Now).WithMessage("Дата рождения не может быть в будущем")
        .When(x => x.BirthDate.HasValue);

        RuleFor(x => x.Gender)
        .IsInEnum().WithMessage("Неверный пол");

        RuleFor(x => x.Weight)
        .GreaterThan(0).WithMessage("Вес должен быть больше 0")
        .LessThan(1000).WithMessage("Вес слишком большой")
        .When(x => x.Weight.HasValue);

        RuleFor(x => x.Microchip)
        .MaximumLength(50).When(x => !string.IsNullOrEmpty(x.Microchip));

        RuleFor(x => x.SpecialNeeds)
        .MaximumLength(1000).When(x => !string.IsNullOrEmpty(x.SpecialNeeds));
    }
}
