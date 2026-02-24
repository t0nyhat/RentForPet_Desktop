using FluentAssertions;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using Xunit;

namespace PetHotel.Tests.Domain;

public class PetEntityTests
{
    [Fact]
    public void Pet_ShouldInitializeWithDefaultValues()
    {
        // Act
        var pet = new Pet();

        // Assert
        pet.Name.Should().BeEmpty();
        pet.IsActive.Should().BeFalse();
        pet.BookingPets.Should().BeEmpty();
    }

    [Fact]
    public void Pet_ShouldAllowSettingProperties()
    {
        // Arrange
        var pet = new Pet();
        var clientId = Guid.NewGuid();
        var birthDate = DateTime.Now.AddYears(-3);

        // Act
        pet.ClientId = clientId;
        pet.Name = "Buddy";
        pet.Species = Species.Dog;
        pet.Breed = "Golden Retriever";
        pet.BirthDate = birthDate;
        pet.Gender = Gender.Male;
        pet.Weight = 30.5m;
        pet.Color = "Golden";
        pet.Microchip = "123456789";
        pet.SpecialNeeds = "Needs medication";
        pet.IsActive = true;
        pet.InternalNotes = "Very friendly";

        // Assert
        pet.ClientId.Should().Be(clientId);
        pet.Name.Should().Be("Buddy");
        pet.Species.Should().Be(Species.Dog);
        pet.Breed.Should().Be("Golden Retriever");
        pet.BirthDate.Should().Be(birthDate);
        pet.Gender.Should().Be(Gender.Male);
        pet.Weight.Should().Be(30.5m);
        pet.Color.Should().Be("Golden");
        pet.Microchip.Should().Be("123456789");
        pet.SpecialNeeds.Should().Be("Needs medication");
        pet.IsActive.Should().BeTrue();
        pet.InternalNotes.Should().Be("Very friendly");
    }

    [Fact]
    public void Pet_ShouldSupportDifferentSpecies()
    {
        // Arrange & Act
        var dog = new Pet { Species = Species.Dog, Name = "Max" };
        var cat = new Pet { Species = Species.Cat, Name = "Luna" };

        // Assert
        dog.Species.Should().Be(Species.Dog);
        cat.Species.Should().Be(Species.Cat);
    }

    [Fact]
    public void Pet_ShouldSupportOptionalFields()
    {
        // Arrange & Act
        var pet = new Pet
        {
            Name = "Charlie",
            Species = Species.Dog,
            Gender = Gender.Male,
            IsActive = true
        };

        // Assert - Optional fields should be nullable or null
        pet.Breed.Should().BeNull();
        pet.BirthDate.Should().BeNull();
        pet.Weight.Should().BeNull();
        pet.Color.Should().BeNull();
        pet.Microchip.Should().BeNull();
        pet.SpecialNeeds.Should().BeNull();
        pet.InternalNotes.Should().BeNull();
    }
}
