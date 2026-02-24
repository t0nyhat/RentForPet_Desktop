using FluentAssertions;
using FluentValidation.TestHelper;
using PetHotel.Application.DTOs.Auth;
using PetHotel.Application.Validators.Auth;
using Xunit;

namespace PetHotel.Tests.Validators;

public class LoginRequestValidatorTests
{
    private readonly LoginRequestValidator _validator;

    public LoginRequestValidatorTests()
    {
        _validator = new LoginRequestValidator();
    }

    [Fact]
    public void Validate_WithValidData_ShouldNotHaveValidationError()
    {
        // Arrange
        var request = new LoginRequest
        {
            Email = "user@example.com",
            Password = "SecurePassword123"
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithoutEmail_ShouldHaveValidationError()
    {
        // Arrange
        var request = new LoginRequest
        {
            Email = "",
            Password = "password"
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Validate_WithInvalidEmailFormat_ShouldHaveValidationError()
    {
        // Arrange
        var request = new LoginRequest
        {
            Email = "notanemail",
            Password = "password"
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Validate_WithoutPassword_ShouldHaveValidationError()
    {
        // Arrange
        var request = new LoginRequest
        {
            Email = "user@example.com",
            Password = ""
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Password);
    }
}
