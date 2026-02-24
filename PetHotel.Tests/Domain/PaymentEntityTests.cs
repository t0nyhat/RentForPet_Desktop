using FluentAssertions;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using Xunit;

namespace PetHotel.Tests.Domain;

public class PaymentEntityTests
{
    [Fact]
    public void Payment_ShouldAllowSettingBasicProperties()
    {
        // Arrange
        var payment = new Payment();
        var bookingId = Guid.NewGuid();
        var transactionId = "TXN-12345";
        var paidAt = DateTime.Now;

        // Act
        payment.BookingId = bookingId;
        payment.Amount = 500m;
        payment.PaymentMethod = PaymentMethod.Card;
        payment.PaymentStatus = PaymentStatus.Completed;
        payment.PaymentType = PaymentType.Prepayment;
        payment.PrepaymentPercentage = 30m;
        payment.TransactionId = transactionId;
        payment.PaidAt = paidAt;

        // Assert
        payment.BookingId.Should().Be(bookingId);
        payment.Amount.Should().Be(500m);
        payment.PaymentMethod.Should().Be(PaymentMethod.Card);
        payment.PaymentStatus.Should().Be(PaymentStatus.Completed);
        payment.PaymentType.Should().Be(PaymentType.Prepayment);
        payment.PrepaymentPercentage.Should().Be(30m);
        payment.TransactionId.Should().Be(transactionId);
        payment.PaidAt.Should().Be(paidAt);
    }

    [Fact]
    public void Payment_ShouldSupportPrepaymentTracking()
    {
        // Arrange & Act
        var payment = new Payment
        {
            BookingId = Guid.NewGuid(),
            Amount = 300m,
            PaymentType = PaymentType.Prepayment,
            PrepaymentPercentage = 30m,
            PaymentMethod = PaymentMethod.Card,
            PaymentStatus = PaymentStatus.Completed
        };

        // Assert
        payment.PaymentType.Should().Be(PaymentType.Prepayment);
        payment.PrepaymentPercentage.Should().Be(30m);
    }

    [Fact]
    public void Payment_ShouldSupportFullPaymentTracking()
    {
        // Arrange & Act
        var payment = new Payment
        {
            BookingId = Guid.NewGuid(),
            Amount = 1000m,
            PaymentType = PaymentType.FullPayment,
            PaymentMethod = PaymentMethod.Cash,
            PaymentStatus = PaymentStatus.Completed
        };

        // Assert
        payment.PaymentType.Should().Be(PaymentType.FullPayment);
        payment.PrepaymentPercentage.Should().BeNull();
    }

    [Fact]
    public void Payment_ShouldSupportAdminConfirmation()
    {
        // Arrange
        var payment = new Payment
        {
            BookingId = Guid.NewGuid(),
            Amount = 500m,
            PaymentStatus = PaymentStatus.Pending,
            PaymentProof = "receipt.jpg"
        };

        var adminId = Guid.NewGuid();
        var confirmedAt = DateTime.Now;

        // Act - Simulate admin confirmation
        payment.PaymentStatus = PaymentStatus.Completed;
        payment.ConfirmedByAdminId = adminId;
        payment.ConfirmedAt = confirmedAt;
        payment.AdminComment = "Payment verified";

        // Assert
        payment.PaymentStatus.Should().Be(PaymentStatus.Completed);
        payment.ConfirmedByAdminId.Should().Be(adminId);
        payment.ConfirmedAt.Should().Be(confirmedAt);
        payment.AdminComment.Should().Be("Payment verified");
    }

    [Fact]
    public void Payment_ShouldSupportPaymentProof()
    {
        // Arrange & Act
        var payment = new Payment
        {
            BookingId = Guid.NewGuid(),
            Amount = 200m,
            PaymentMethod = PaymentMethod.Online,
            PaymentStatus = PaymentStatus.Pending,
            PaymentProof = "https://example.com/proof.jpg"
        };

        // Assert
        payment.PaymentProof.Should().Be("https://example.com/proof.jpg");
        payment.PaymentStatus.Should().Be(PaymentStatus.Pending);
    }

    [Fact]
    public void Payment_ShouldSupportDifferentPaymentMethods()
    {
        // Arrange & Act
        var cardPayment = new Payment
        {
            PaymentMethod = PaymentMethod.Card,
            Amount = 500m
        };

        var cashPayment = new Payment
        {
            PaymentMethod = PaymentMethod.Cash,
            Amount = 300m
        };

        var onlinePayment = new Payment
        {
            PaymentMethod = PaymentMethod.Online,
            Amount = 700m
        };

        // Assert
        cardPayment.PaymentMethod.Should().Be(PaymentMethod.Card);
        cashPayment.PaymentMethod.Should().Be(PaymentMethod.Cash);
        onlinePayment.PaymentMethod.Should().Be(PaymentMethod.Online);
    }

    [Fact]
    public void Payment_ShouldSupportOptionalFields()
    {
        // Arrange & Act
        var payment = new Payment
        {
            BookingId = Guid.NewGuid(),
            Amount = 100m,
            PaymentMethod = PaymentMethod.Card,
            PaymentStatus = PaymentStatus.Pending,
            PaymentType = PaymentType.Prepayment
        };

        // Assert - Optional fields should be null by default
        payment.PrepaymentPercentage.Should().BeNull();
        payment.TransactionId.Should().BeNull();
        payment.PaidAt.Should().BeNull();
        payment.PaymentProof.Should().BeNull();
        payment.AdminComment.Should().BeNull();
        payment.ConfirmedAt.Should().BeNull();
        payment.ConfirmedByAdminId.Should().BeNull();
    }
}
