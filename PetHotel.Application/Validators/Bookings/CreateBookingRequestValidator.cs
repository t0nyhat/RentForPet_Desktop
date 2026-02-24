using FluentValidation;
using PetHotel.Application.DTOs.Bookings;

namespace PetHotel.Application.Validators.Bookings;

public class CreateBookingRequestValidator : AbstractValidator<CreateBookingRequest>
{
    public CreateBookingRequestValidator()
    {
        // For simple bookings (no segments), require RoomTypeId, CheckInDate, CheckOutDate
        RuleFor(x => x.RoomTypeId)
        .NotEmpty().WithMessage("Необходимо выбрать тип номера")
        .When(x => x.Segments == null || !x.Segments.Any());

        RuleFor(x => x.CheckInDate)
        .NotEmpty().WithMessage("Укажите дату заезда")
        .GreaterThanOrEqualTo(DateTime.Now.Date)
        .WithMessage("Дата заезда не может быть в прошлом")
        .When(x => x.Segments == null || !x.Segments.Any());

        RuleFor(x => x.CheckOutDate)
        .NotEmpty().WithMessage("Укажите дату выезда")
        .GreaterThan(x => x.CheckInDate ?? DateTime.MinValue)
        .WithMessage("Дата выезда должна быть позже даты заезда")
        .When(x => x.Segments == null || !x.Segments.Any());

        // For composite bookings, require at least one segment
        RuleFor(x => x.Segments)
        .NotEmpty().WithMessage("Необходимо указать хотя бы один сегмент бронирования")
        .When(x => x.Segments != null && x.Segments.Any());

        // Validate each segment in composite booking
        RuleForEach(x => x.Segments)
        .SetValidator(new BookingSegmentRequestValidator())
        .When(x => x.Segments != null && x.Segments.Any());

        // PetIds are always required (for both simple and composite bookings)
        RuleFor(x => x.PetIds)
        .NotEmpty().WithMessage("Необходимо выбрать хотя бы одного питомца")
        .Must(list => list.Count > 0).WithMessage("Необходимо выбрать хотя бы одного питомца");

        RuleFor(x => x.SpecialRequests)
        .MaximumLength(1000).When(x => !string.IsNullOrEmpty(x.SpecialRequests));
    }
}

/// <summary>
/// Validator for individual booking segments in composite bookings.
/// </summary>
public class BookingSegmentRequestValidator : AbstractValidator<BookingSegmentRequest>
{
    public BookingSegmentRequestValidator()
    {
        RuleFor(x => x.RoomTypeId)
        .NotEmpty().WithMessage("Тип номера обязателен для каждого сегмента");

        RuleFor(x => x.CheckInDate)
        .NotEmpty().WithMessage("Дата заезда обязательна для каждого сегмента")
        .GreaterThanOrEqualTo(DateTime.Now.Date)
        .WithMessage("Дата заезда не может быть в прошлом");

        RuleFor(x => x.CheckOutDate)
        .NotEmpty().WithMessage("Дата выезда обязательна для каждого сегмента")
        .GreaterThan(x => x.CheckInDate)
        .WithMessage("Дата выезда должна быть позже даты заезда");
    }
}
