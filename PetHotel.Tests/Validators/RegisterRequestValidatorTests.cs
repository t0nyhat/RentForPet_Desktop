using FluentAssertions;
using FluentValidation.TestHelper;
using PetHotel.Application.DTOs.Auth;
using PetHotel.Application.Validators.Auth;
using Xunit;

namespace PetHotel.Tests.Validators;

public class RegisterRequestValidatorTests
{
    private readonly RegisterRequestValidator _validator;

    public RegisterRequestValidatorTests()
    {
        _validator = new RegisterRequestValidator();
    }

    [Fact]
    public void Validate_WithValidData_ShouldNotHaveValidationError()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "user@example.com",
            Password = "SecurePass123",
            ConfirmPassword = "SecurePass123",
            FirstName = "John",
            LastName = "Doe",
            Phone = "+1234567890"
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
        var request = new RegisterRequest
        {
            Email = "",
            Password = "SecurePass123",
            ConfirmPassword = "SecurePass123",
            FirstName = "John",
            LastName = "Doe",
            Phone = "+1234567890"
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Validate_WithInvalidEmail_ShouldHaveValidationError()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "notanemail",
            Password = "SecurePass123",
            ConfirmPassword = "SecurePass123",
            FirstName = "John",
            LastName = "Doe",
            Phone = "+1234567890"
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Email);
    }

    [Fact]
    public void Validate_WithTooLongEmail_ShouldHaveValidationError()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = new string('a', 250) + "@test.com", // > 256 chars
            Password = "SecurePass123",
            ConfirmPassword = "SecurePass123",
            FirstName = "John",
            LastName = "Doe",
            Phone = "+1234567890"
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
        var request = new RegisterRequest
        {
            Email = "user@example.com",
            Password = "",
            ConfirmPassword = "",
            FirstName = "John",
            LastName = "Doe",
            Phone = "+1234567890"
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Password);
    }

    [Fact]
    public void Validate_WithShortPassword_ShouldHaveValidationError()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "user@example.com",
            Password = "Pass1",
            ConfirmPassword = "Pass1",
            FirstName = "John",
            LastName = "Doe",
            Phone = "+1234567890"
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Password);
    }

    [Fact]
    public void Validate_WithPasswordWithoutLetters_ShouldHaveValidationError()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "user@example.com",
            Password = "12345678",
            ConfirmPassword = "12345678",
            FirstName = "John",
            LastName = "Doe",
            Phone = "+1234567890"
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Password);
    }

    [Fact]
    public void Validate_WithPasswordWithoutDigits_ShouldHaveValidationError()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "user@example.com",
            Password = "SecurePassword",
            ConfirmPassword = "SecurePassword",
            FirstName = "John",
            LastName = "Doe",
            Phone = "+1234567890"
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Password);
    }

    [Fact]
    public void Validate_WithMismatchedPasswords_ShouldHaveValidationError()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "user@example.com",
            Password = "SecurePass123",
            ConfirmPassword = "DifferentPass123",
            FirstName = "John",
            LastName = "Doe",
            Phone = "+1234567890"
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.ConfirmPassword);
    }

    [Fact]
    public void Validate_WithoutFirstName_ShouldHaveValidationError()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "user@example.com",
            Password = "SecurePass123",
            ConfirmPassword = "SecurePass123",
            FirstName = "",
            LastName = "Doe",
            Phone = "+1234567890"
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.FirstName);
    }

    [Fact]
    public void Validate_WithoutLastName_ShouldHaveValidationError()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "user@example.com",
            Password = "SecurePass123",
            ConfirmPassword = "SecurePass123",
            FirstName = "John",
            LastName = "",
            Phone = "+1234567890"
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.LastName);
    }

    [Fact]
    public void Validate_WithoutPhone_ShouldHaveValidationError()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "user@example.com",
            Password = "SecurePass123",
            ConfirmPassword = "SecurePass123",
            FirstName = "John",
            LastName = "Doe",
            Phone = ""
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Phone);
    }

    [Fact]
    public void Validate_WithInvalidPhone_ShouldHaveValidationError()
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "user@example.com",
            Password = "SecurePass123",
            ConfirmPassword = "SecurePass123",
            FirstName = "John",
            LastName = "Doe",
            Phone = "invalid-phone"
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Phone);
    }

    [Theory]
    [InlineData("+1234567890")]
    [InlineData("+79991234567")]
    [InlineData("1234567890")]
    public void Validate_WithValidPhoneFormats_ShouldNotHaveValidationError(string phone)
    {
        // Arrange
        var request = new RegisterRequest
        {
            Email = "user@example.com",
            Password = "SecurePass123",
            ConfirmPassword = "SecurePass123",
            FirstName = "John",
            LastName = "Doe",
            Phone = phone
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldNotHaveValidationErrorFor(x => x.Phone);
    }
}
