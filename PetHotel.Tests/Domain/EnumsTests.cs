using FluentAssertions;
using PetHotel.Domain.Enums;
using Xunit;

namespace PetHotel.Tests.Domain;

public class EnumsTests
{
    #region BookingStatus Tests

    [Fact]
    public void BookingStatus_ShouldHaveExpectedValues()
    {
        // Assert
        ((int)BookingStatus.Pending).Should().Be(0);
        ((int)BookingStatus.WaitingForPaymentApproval).Should().Be(1);
        ((int)BookingStatus.AwaitingPayment).Should().Be(2);
        ((int)BookingStatus.PaymentPending).Should().Be(3);
        ((int)BookingStatus.Confirmed).Should().Be(4);
        ((int)BookingStatus.CheckedIn).Should().Be(5);
        ((int)BookingStatus.CheckedOut).Should().Be(6);
        ((int)BookingStatus.Cancelled).Should().Be(7);
    }

    [Fact]
    public void BookingStatus_ShouldBeDefinedForAllValues()
    {
        // Assert
        Enum.IsDefined(typeof(BookingStatus), 0).Should().BeTrue();
        Enum.IsDefined(typeof(BookingStatus), 7).Should().BeTrue();
        Enum.IsDefined(typeof(BookingStatus), 99).Should().BeFalse();
    }

    #endregion

    #region BookingCalculationMode Tests

    [Fact]
    public void BookingCalculationMode_ShouldHaveExpectedValues()
    {
        // Assert
        ((int)BookingCalculationMode.Days).Should().Be(0);
        ((int)BookingCalculationMode.Nights).Should().Be(1);
    }

    #endregion

    #region PaymentStatus Tests

    [Fact]
    public void PaymentStatus_ShouldHaveExpectedValues()
    {
        // Assert
        ((int)PaymentStatus.Pending).Should().Be(0);
        ((int)PaymentStatus.Completed).Should().Be(1);
        ((int)PaymentStatus.Failed).Should().Be(2);
        ((int)PaymentStatus.Refunded).Should().Be(3);
    }

    #endregion

    #region PaymentType Tests

    [Fact]
    public void PaymentType_ShouldHaveExpectedValues()
    {
        // Assert
        ((int)PaymentType.Prepayment).Should().Be(0);
        ((int)PaymentType.FullPayment).Should().Be(1);
    }

    #endregion

    #region PaymentMethod Tests

    [Fact]
    public void PaymentMethod_ShouldHaveExpectedValues()
    {
        // Assert
        ((int)PaymentMethod.Card).Should().Be(0);
        ((int)PaymentMethod.Cash).Should().Be(1);
        ((int)PaymentMethod.Online).Should().Be(2);
        ((int)PaymentMethod.QrCode).Should().Be(3);
        ((int)PaymentMethod.PhoneTransfer).Should().Be(4);
    }

    #endregion

    #region Gender Tests

    [Fact]
    public void Gender_ShouldHaveExpectedValues()
    {
        // Assert
        ((int)Gender.Male).Should().Be(0);
        ((int)Gender.Female).Should().Be(1);
    }

    #endregion

    #region Species Tests

    [Fact]
    public void Species_ShouldHaveExpectedValues()
    {
        // Assert
        ((int)Species.Dog).Should().Be(0);
        ((int)Species.Cat).Should().Be(1);
    }

    [Fact]
    public void Species_ShouldSupportBothDogAndCat()
    {
        // Arrange
        var dog = Species.Dog;
        var cat = Species.Cat;

        // Assert
        dog.Should().NotBe(cat);
        Enum.IsDefined(typeof(Species), dog).Should().BeTrue();
        Enum.IsDefined(typeof(Species), cat).Should().BeTrue();
    }

    #endregion
}
