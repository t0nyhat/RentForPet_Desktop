using FluentAssertions;
using PetHotel.Domain.Entities;
using Xunit;

namespace PetHotel.Tests.Domain;

public class RoomTypeEntityTests
{
    [Fact]
    public void RoomType_ShouldInitializeWithDefaultValues()
    {
        // Act
        var roomType = new RoomType();

        // Assert
        roomType.Name.Should().BeEmpty();
        roomType.IsActive.Should().BeFalse();
        roomType.Rooms.Should().BeEmpty();
        roomType.Bookings.Should().BeEmpty();
    }

    [Fact]
    public void RoomType_ShouldAllowSettingProperties()
    {
        // Arrange
        var roomType = new RoomType();

        // Act
        roomType.Name = "VIP Suite";
        roomType.Description = "Luxury room with extra amenities";
        roomType.MaxCapacity = 3;
        roomType.PricePerNight = 150m;
        roomType.PricePerAdditionalPet = 30m;
        roomType.SquareMeters = 25.5m;
        roomType.Features = "{\"hasWindow\": true, \"hasPlayArea\": true}";
        roomType.IsActive = true;

        // Assert
        roomType.Name.Should().Be("VIP Suite");
        roomType.Description.Should().Be("Luxury room with extra amenities");
        roomType.MaxCapacity.Should().Be(3);
        roomType.PricePerNight.Should().Be(150m);
        roomType.PricePerAdditionalPet.Should().Be(30m);
        roomType.SquareMeters.Should().Be(25.5m);
        roomType.Features.Should().Be("{\"hasWindow\": true, \"hasPlayArea\": true}");
        roomType.IsActive.Should().BeTrue();
    }

    [Fact]
    public void RoomType_ShouldSupportMultipleRooms()
    {
        // Arrange
        var roomType = new RoomType
        {
            Name = "Standard",
            PricePerNight = 50m,
            MaxCapacity = 2
        };

        var room1 = new Room { RoomTypeId = roomType.Id, RoomNumber = "101" };
        var room2 = new Room { RoomTypeId = roomType.Id, RoomNumber = "102" };
        var room3 = new Room { RoomTypeId = roomType.Id, RoomNumber = "103" };

        // Act
        roomType.Rooms.Add(room1);
        roomType.Rooms.Add(room2);
        roomType.Rooms.Add(room3);

        // Assert
        roomType.Rooms.Should().HaveCount(3);
    }

    [Fact]
    public void RoomType_ShouldSupportDifferentPricingModels()
    {
        // Arrange & Act
        var budget = new RoomType
        {
            Name = "Budget",
            PricePerNight = 30m,
            PricePerAdditionalPet = 10m
        };

        var luxury = new RoomType
        {
            Name = "Luxury",
            PricePerNight = 200m,
            PricePerAdditionalPet = 50m
        };

        // Assert
        budget.PricePerNight.Should().BeLessThan(luxury.PricePerNight);
        budget.PricePerAdditionalPet.Should().BeLessThan(luxury.PricePerAdditionalPet);
    }

    [Fact]
    public void RoomType_CalculateTotalPrice_ForMultiplePets()
    {
        // Arrange
        var roomType = new RoomType
        {
            Name = "Family Room",
            PricePerNight = 100m,
            PricePerAdditionalPet = 20m,
            MaxCapacity = 4
        };

        // Act - Calculate for 3 pets, 5 nights
        var numberOfPets = 3;
        var numberOfNights = 5;
        var basePrice = roomType.PricePerNight * numberOfNights;
        var additionalPetsPrice = (numberOfPets - 1) * roomType.PricePerAdditionalPet * numberOfNights;
        var totalPrice = basePrice + additionalPetsPrice;

        // Assert
        basePrice.Should().Be(500m); // 100 * 5
        additionalPetsPrice.Should().Be(200m); // 2 * 20 * 5
        totalPrice.Should().Be(700m);
        numberOfPets.Should().BeLessThanOrEqualTo(roomType.MaxCapacity);
    }

    [Fact]
    public void RoomType_ShouldSupportOptionalFields()
    {
        // Arrange & Act
        var roomType = new RoomType
        {
            Name = "Basic",
            PricePerNight = 40m,
            PricePerAdditionalPet = 15m,
            MaxCapacity = 2,
            IsActive = true
        };

        // Assert - Optional fields should be nullable or null
        roomType.Description.Should().BeNull();
        roomType.SquareMeters.Should().BeNull();
        roomType.Features.Should().BeNull();
    }
}
