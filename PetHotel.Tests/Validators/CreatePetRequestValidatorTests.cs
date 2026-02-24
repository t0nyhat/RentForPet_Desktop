using FluentAssertions;
using FluentValidation.TestHelper;
using PetHotel.Application.DTOs.Pets;
using PetHotel.Application.Validators.Pets;
using PetHotel.Domain.Enums;
using Xunit;

namespace PetHotel.Tests.Validators;

public class CreatePetRequestValidatorTests
{
    private readonly CreatePetRequestValidator _validator;

    public CreatePetRequestValidatorTests()
    {
        _validator = new CreatePetRequestValidator();
    }

    [Fact]
    public void Validate_WithValidData_ShouldNotHaveValidationError()
    {
        // Arrange
        var request = new CreatePetRequest
        {
            Name = "Buddy",
            Species = Species.Dog,
            Gender = Gender.Male,
            Breed = "Golden Retriever",
            BirthDate = DateTime.Now.AddYears(-2),
            Weight = 25.5m
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_WithoutName_ShouldHaveValidationError()
    {
        // Arrange
        var request = new CreatePetRequest
        {
            Name = "",
            Species = Species.Dog,
            Gender = Gender.Male
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Validate_WithTooLongName_ShouldHaveValidationError()
    {
        // Arrange
        var request = new CreatePetRequest
        {
            Name = new string('a', 101),
            Species = Species.Cat,
            Gender = Gender.Female
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Name);
    }

    [Fact]
    public void Validate_WithInvalidSpecies_ShouldHaveValidationError()
    {
        // Arrange
        var request = new CreatePetRequest
        {
            Name = "Max",
            Species = (Species)999,
            Gender = Gender.Male
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Species);
    }

    [Fact]
    public void Validate_WithFutureBirthDate_ShouldHaveValidationError()
    {
        // Arrange
        var request = new CreatePetRequest
        {
            Name = "Luna",
            Species = Species.Cat,
            Gender = Gender.Female,
            BirthDate = DateTime.Now.AddDays(1)
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.BirthDate);
    }

    [Fact]
    public void Validate_WithZeroWeight_ShouldHaveValidationError()
    {
        // Arrange
        var request = new CreatePetRequest
        {
            Name = "Charlie",
            Species = Species.Dog,
            Gender = Gender.Male,
            Weight = 0
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Weight);
    }

    [Fact]
    public void Validate_WithNegativeWeight_ShouldHaveValidationError()
    {
        // Arrange
        var request = new CreatePetRequest
        {
            Name = "Bella",
            Species = Species.Cat,
            Gender = Gender.Female,
            Weight = -5
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Weight);
    }

    [Fact]
    public void Validate_WithExcessiveWeight_ShouldHaveValidationError()
    {
        // Arrange
        var request = new CreatePetRequest
        {
            Name = "Max",
            Species = Species.Dog,
            Gender = Gender.Male,
            Weight = 1001
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Weight);
    }

    [Fact]
    public void Validate_WithTooLongBreed_ShouldHaveValidationError()
    {
        // Arrange
        var request = new CreatePetRequest
        {
            Name = "Rocky",
            Species = Species.Dog,
            Gender = Gender.Male,
            Breed = new string('a', 101)
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Breed);
    }

    [Fact]
    public void Validate_WithTooLongMicrochip_ShouldHaveValidationError()
    {
        // Arrange
        var request = new CreatePetRequest
        {
            Name = "Daisy",
            Species = Species.Cat,
            Gender = Gender.Female,
            Microchip = new string('1', 51)
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.Microchip);
    }

    [Fact]
    public void Validate_WithTooLongSpecialNeeds_ShouldHaveValidationError()
    {
        // Arrange
        var request = new CreatePetRequest
        {
            Name = "Cooper",
            Species = Species.Dog,
            Gender = Gender.Male,
            SpecialNeeds = new string('a', 1001)
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldHaveValidationErrorFor(x => x.SpecialNeeds);
    }

    [Fact]
    public void Validate_WithValidOptionalFields_ShouldNotHaveValidationError()
    {
        // Arrange
        var request = new CreatePetRequest
        {
            Name = "Milo",
            Species = Species.Dog,
            Gender = Gender.Male,
            Breed = "Labrador",
            BirthDate = DateTime.Now.AddYears(-3),
            Weight = 30.0m,
            Microchip = "123456789",
            SpecialNeeds = "Needs medication twice a day"
        };

        // Act
        var result = _validator.TestValidate(request);

        // Assert
        result.ShouldNotHaveAnyValidationErrors();
    }
}
