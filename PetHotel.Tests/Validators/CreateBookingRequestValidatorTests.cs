using FluentAssertions;
using FluentValidation.TestHelper;
using PetHotel.Application.DTOs.Bookings;
using PetHotel.Application.Validators.Bookings;
using Xunit;

namespace PetHotel.Tests.Validators;

public class CreateBookingRequestValidatorTests
{
    private readonly CreateBookingRequestValidator _validator;

    public CreateBookingRequestValidatorTests()
    {
        _validator = new CreateBookingRequestValidator();
    }

    #region Simple Booking Tests

    [Fact]
    public void Validate_SimpleBooking_WithValidData_ShouldNotHaveValidationError()
    {
        // Arrange
        var request = new CreateBookingRequest
        {
            RoomTypeId = Guid.NewGuid(),
            CheckInDate = DateTime.Now.AddDays(1),
            CheckOutDate = DateTime.Now.AddDays(3),
            PetIds = new List<Guid> { Guid.NewGuid() }
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_SimpleBooking_WithoutRoomTypeId_ShouldHaveValidationError()
    {
        // Arrange
        var request = new CreateBookingRequest
        {
            RoomTypeId = null,
            CheckInDate = DateTime.Now.AddDays(1),
            CheckOutDate = DateTime.Now.AddDays(3),
            PetIds = new List<Guid> { Guid.NewGuid() }
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.RoomTypeId);
    }

    [Fact]
    public void Validate_SimpleBooking_WithPastCheckInDate_ShouldHaveValidationError()
    {
        // Arrange
        var request = new CreateBookingRequest
        {
            RoomTypeId = Guid.NewGuid(),
            CheckInDate = DateTime.Now.AddDays(-1),
            CheckOutDate = DateTime.Now.AddDays(1),
            PetIds = new List<Guid> { Guid.NewGuid() }
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.CheckInDate);
    }

    [Fact]
    public void Validate_SimpleBooking_WithCheckOutBeforeCheckIn_ShouldHaveValidationError()
    {
        // Arrange
        var request = new CreateBookingRequest
        {
            RoomTypeId = Guid.NewGuid(),
            CheckInDate = DateTime.Now.AddDays(3),
            CheckOutDate = DateTime.Now.AddDays(1),
            PetIds = new List<Guid> { Guid.NewGuid() }
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.CheckOutDate);
    }

    [Fact]
    public void Validate_SimpleBooking_WithoutPets_ShouldHaveValidationError()
    {
        // Arrange
        var request = new CreateBookingRequest
        {
            RoomTypeId = Guid.NewGuid(),
            CheckInDate = DateTime.Now.AddDays(1),
            CheckOutDate = DateTime.Now.AddDays(3),
            PetIds = new List<Guid>()
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.PetIds);
    }

    [Fact]
    public void Validate_SimpleBooking_WithTooLongSpecialRequests_ShouldHaveValidationError()
    {
        // Arrange
        var request = new CreateBookingRequest
        {
            RoomTypeId = Guid.NewGuid(),
            CheckInDate = DateTime.Now.AddDays(1),
            CheckOutDate = DateTime.Now.AddDays(3),
            PetIds = new List<Guid> { Guid.NewGuid() },
            SpecialRequests = new string('a', 1001)
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.SpecialRequests);
    }

    #endregion

    #region Composite Booking Tests

    [Fact]
    public void Validate_CompositeBooking_WithValidSegments_ShouldNotHaveValidationError()
    {
        // Arrange
        var request = new CreateBookingRequest
        {
            PetIds = new List<Guid> { Guid.NewGuid() },
            Segments = new List<BookingSegmentRequest>
            {
                new BookingSegmentRequest
                {
                    RoomTypeId = Guid.NewGuid(),
                    CheckInDate = DateTime.Now.AddDays(1),
                    CheckOutDate = DateTime.Now.AddDays(3)
                },
                new BookingSegmentRequest
                {
                    RoomTypeId = Guid.NewGuid(),
                    CheckInDate = DateTime.Now.AddDays(3),
                    CheckOutDate = DateTime.Now.AddDays(5)
                }
            }
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_CompositeBooking_WithoutPets_ShouldHaveValidationError()
    {
        // Arrange
        var request = new CreateBookingRequest
        {
            PetIds = new List<Guid>(),
            Segments = new List<BookingSegmentRequest>
            {
                new BookingSegmentRequest
                {
                    RoomTypeId = Guid.NewGuid(),
                    CheckInDate = DateTime.Now.AddDays(1),
                    CheckOutDate = DateTime.Now.AddDays(3)
                }
            }
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.PetIds);
    }

    #endregion
}
