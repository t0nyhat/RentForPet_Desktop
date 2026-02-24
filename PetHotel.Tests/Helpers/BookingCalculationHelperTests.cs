using FluentAssertions;
using PetHotel.Application.Common.Helpers;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using Xunit;

namespace PetHotel.Tests.Helpers;

public class BookingCalculationHelperTests
{
    #region CalculateUnits Tests

    [Fact]
    public void CalculateUnits_WithDaysMode_ShouldReturnDaysCount()
    {
        // Arrange
        var checkIn = new DateTime(2024, 11, 15);
        var checkOut = new DateTime(2024, 11, 17);
        var settings = new BookingSettings
        {
            CalculationMode = BookingCalculationMode.Days
        };

        // Act
        var result = BookingCalculationHelper.CalculateUnits(checkIn, checkOut, settings);

        // Assert
        result.Should().Be(3); // 15, 16, 17 = 3 days
    }

    [Fact]
    public void CalculateUnits_WithNightsMode_ShouldReturnNightsCount()
    {
        // Arrange
        var checkIn = new DateTime(2024, 11, 15);
        var checkOut = new DateTime(2024, 11, 17);
        var settings = new BookingSettings
        {
            CalculationMode = BookingCalculationMode.Nights
        };

        // Act
        var result = BookingCalculationHelper.CalculateUnits(checkIn, checkOut, settings);

        // Assert
        result.Should().Be(2); // Night 15-16, Night 16-17 = 2 nights
    }

    #endregion

    #region CalculateDays Tests

    [Fact]
    public void CalculateDays_WithThreeDayPeriod_ShouldReturnThree()
    {
        // Arrange
        var checkIn = new DateTime(2024, 11, 15);
        var checkOut = new DateTime(2024, 11, 17);

        // Act
        var result = BookingCalculationHelper.CalculateDays(checkIn, checkOut);

        // Assert
        result.Should().Be(3);
    }

    [Fact]
    public void CalculateDays_WithSingleDay_ShouldReturnOne()
    {
        // Arrange
        var checkIn = new DateTime(2024, 11, 15);
        var checkOut = new DateTime(2024, 11, 15);

        // Act
        var result = BookingCalculationHelper.CalculateDays(checkIn, checkOut);

        // Assert
        result.Should().Be(1);
    }

    [Fact]
    public void CalculateDays_WithOneWeekPeriod_ShouldReturnSeven()
    {
        // Arrange
        var checkIn = new DateTime(2024, 11, 1);
        var checkOut = new DateTime(2024, 11, 7);

        // Act
        var result = BookingCalculationHelper.CalculateDays(checkIn, checkOut);

        // Assert
        result.Should().Be(7);
    }

    #endregion

    #region CalculateNights Tests

    [Fact]
    public void CalculateNights_WithThreeDayPeriod_ShouldReturnTwo()
    {
        // Arrange
        var checkIn = new DateTime(2024, 11, 15);
        var checkOut = new DateTime(2024, 11, 17);

        // Act
        var result = BookingCalculationHelper.CalculateNights(checkIn, checkOut);

        // Assert
        result.Should().Be(2);
    }

    [Fact]
    public void CalculateNights_WithSingleDay_ShouldReturnZero()
    {
        // Arrange
        var checkIn = new DateTime(2024, 11, 15);
        var checkOut = new DateTime(2024, 11, 15);

        // Act
        var result = BookingCalculationHelper.CalculateNights(checkIn, checkOut);

        // Assert
        result.Should().Be(0);
    }

    [Fact]
    public void CalculateNights_WithOneWeekPeriod_ShouldReturnSix()
    {
        // Arrange
        var checkIn = new DateTime(2024, 11, 1);
        var checkOut = new DateTime(2024, 11, 7);

        // Act
        var result = BookingCalculationHelper.CalculateNights(checkIn, checkOut);

        // Assert
        result.Should().Be(6);
    }

    #endregion

    #region GetMinimumPeriod Tests

    [Fact]
    public void GetMinimumPeriod_WithDaysMode_ShouldReturnTwo()
    {
        // Act
        var result = BookingCalculationHelper.GetMinimumPeriod(BookingCalculationMode.Days);

        // Assert
        result.Should().Be(2);
    }

    [Fact]
    public void GetMinimumPeriod_WithNightsMode_ShouldReturnOne()
    {
        // Act
        var result = BookingCalculationHelper.GetMinimumPeriod(BookingCalculationMode.Nights);

        // Assert
        result.Should().Be(1);
    }

    #endregion

    #region AreSegmentsSequential Tests

    [Fact]
    public void AreSegmentsSequential_InDaysMode_WithSequentialDates_ShouldReturnTrue()
    {
        // Arrange
        var previousCheckOut = new DateTime(2024, 11, 17);
        var currentCheckIn = new DateTime(2024, 11, 18);

        // Act
        var result = BookingCalculationHelper.AreSegmentsSequential(
            previousCheckOut,
            currentCheckIn,
            BookingCalculationMode.Days);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void AreSegmentsSequential_InDaysMode_WithSameDate_ShouldReturnFalse()
    {
        // Arrange
        var previousCheckOut = new DateTime(2024, 11, 17);
        var currentCheckIn = new DateTime(2024, 11, 17);

        // Act
        var result = BookingCalculationHelper.AreSegmentsSequential(
            previousCheckOut,
            currentCheckIn,
            BookingCalculationMode.Days);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void AreSegmentsSequential_InNightsMode_WithSameDate_ShouldReturnTrue()
    {
        // Arrange
        var previousCheckOut = new DateTime(2024, 11, 17);
        var currentCheckIn = new DateTime(2024, 11, 17);

        // Act
        var result = BookingCalculationHelper.AreSegmentsSequential(
            previousCheckOut,
            currentCheckIn,
            BookingCalculationMode.Nights);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void AreSegmentsSequential_InNightsMode_WithNextDay_ShouldReturnTrue()
    {
        // Arrange
        var previousCheckOut = new DateTime(2024, 11, 17);
        var currentCheckIn = new DateTime(2024, 11, 18);

        // Act
        var result = BookingCalculationHelper.AreSegmentsSequential(
            previousCheckOut,
            currentCheckIn,
            BookingCalculationMode.Nights);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void AreSegmentsSequential_InNightsMode_WithGap_ShouldReturnFalse()
    {
        // Arrange
        var previousCheckOut = new DateTime(2024, 11, 17);
        var currentCheckIn = new DateTime(2024, 11, 19);

        // Act
        var result = BookingCalculationHelper.AreSegmentsSequential(
            previousCheckOut,
            currentCheckIn,
            BookingCalculationMode.Nights);

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region DoPeriodsOverlap Tests

    [Fact]
    public void DoPeriodsOverlap_InDaysMode_WithOverlappingPeriods_ShouldReturnTrue()
    {
        // Arrange
        var checkIn1 = new DateTime(2024, 11, 15);
        var checkOut1 = new DateTime(2024, 11, 17);
        var checkIn2 = new DateTime(2024, 11, 16);
        var checkOut2 = new DateTime(2024, 11, 18);

        // Act
        var result = BookingCalculationHelper.DoPeriodsOverlap(
            checkIn1, checkOut1,
            checkIn2, checkOut2,
            BookingCalculationMode.Days);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void DoPeriodsOverlap_InDaysMode_WithSameDayBoundary_ShouldReturnTrue()
    {
        // Arrange - Second period starts on same day as first ends
        var checkIn1 = new DateTime(2024, 11, 15);
        var checkOut1 = new DateTime(2024, 11, 17);
        var checkIn2 = new DateTime(2024, 11, 17);
        var checkOut2 = new DateTime(2024, 11, 19);

        // Act
        var result = BookingCalculationHelper.DoPeriodsOverlap(
            checkIn1, checkOut1,
            checkIn2, checkOut2,
            BookingCalculationMode.Days);

        // Assert
        result.Should().BeTrue(); // In days mode, both dates are inclusive
    }

    [Fact]
    public void DoPeriodsOverlap_InDaysMode_WithNonOverlappingPeriods_ShouldReturnFalse()
    {
        // Arrange
        var checkIn1 = new DateTime(2024, 11, 15);
        var checkOut1 = new DateTime(2024, 11, 17);
        var checkIn2 = new DateTime(2024, 11, 18);
        var checkOut2 = new DateTime(2024, 11, 20);

        // Act
        var result = BookingCalculationHelper.DoPeriodsOverlap(
            checkIn1, checkOut1,
            checkIn2, checkOut2,
            BookingCalculationMode.Days);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void DoPeriodsOverlap_InNightsMode_WithOverlappingPeriods_ShouldReturnTrue()
    {
        // Arrange
        var checkIn1 = new DateTime(2024, 11, 15);
        var checkOut1 = new DateTime(2024, 11, 17);
        var checkIn2 = new DateTime(2024, 11, 16);
        var checkOut2 = new DateTime(2024, 11, 18);

        // Act
        var result = BookingCalculationHelper.DoPeriodsOverlap(
            checkIn1, checkOut1,
            checkIn2, checkOut2,
            BookingCalculationMode.Nights);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void DoPeriodsOverlap_InNightsMode_WithSameDayBoundary_ShouldReturnFalse()
    {
        // Arrange - Second period starts on same day as first ends
        var checkIn1 = new DateTime(2024, 11, 15);
        var checkOut1 = new DateTime(2024, 11, 17);
        var checkIn2 = new DateTime(2024, 11, 17);
        var checkOut2 = new DateTime(2024, 11, 19);

        // Act
        var result = BookingCalculationHelper.DoPeriodsOverlap(
            checkIn1, checkOut1,
            checkIn2, checkOut2,
            BookingCalculationMode.Nights);

        // Assert
        result.Should().BeFalse(); // In nights mode, checkout day is released
    }

    [Fact]
    public void DoPeriodsOverlap_InNightsMode_WithNonOverlappingPeriods_ShouldReturnFalse()
    {
        // Arrange
        var checkIn1 = new DateTime(2024, 11, 15);
        var checkOut1 = new DateTime(2024, 11, 17);
        var checkIn2 = new DateTime(2024, 11, 18);
        var checkOut2 = new DateTime(2024, 11, 20);

        // Act
        var result = BookingCalculationHelper.DoPeriodsOverlap(
            checkIn1, checkOut1,
            checkIn2, checkOut2,
            BookingCalculationMode.Nights);

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region GetUnitName Tests

    [Theory]
    [InlineData(1, "день")]
    [InlineData(2, "дня")]
    [InlineData(3, "дня")]
    [InlineData(4, "дня")]
    [InlineData(5, "дней")]
    [InlineData(10, "дней")]
    [InlineData(21, "дней")]
    public void GetUnitName_InDaysMode_ShouldReturnCorrectRussianForm(int count, string expected)
    {
        // Act
        var result = BookingCalculationHelper.GetUnitName(BookingCalculationMode.Days, count);

        // Assert
        result.Should().Be(expected);
    }

    [Theory]
    [InlineData(1, "ночь")]
    [InlineData(2, "ночи")]
    [InlineData(3, "ночи")]
    [InlineData(4, "ночи")]
    [InlineData(5, "ночей")]
    [InlineData(10, "ночей")]
    [InlineData(21, "ночей")]
    public void GetUnitName_InNightsMode_ShouldReturnCorrectRussianForm(int count, string expected)
    {
        // Act
        var result = BookingCalculationHelper.GetUnitName(BookingCalculationMode.Nights, count);

        // Assert
        result.Should().Be(expected);
    }

    #endregion
}
