using FluentAssertions;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using Xunit;

namespace PetHotel.Tests.Domain;

public class BookingEntityTests
{
    [Fact]
    public void Booking_ShouldInitializeWithDefaultValues()
    {
        // Act
        var booking = new Booking();

        // Assert
        booking.PaymentApproved.Should().BeFalse();
        booking.PrepaymentCancelled.Should().BeFalse();
        booking.IsEarlyCheckout.Should().BeFalse();
        booking.OverpaymentConvertedToRevenue.Should().BeFalse();
        booking.IsComposite.Should().BeFalse();
        booking.BookingPets.Should().BeEmpty();
        booking.BookingServices.Should().BeEmpty();
        booking.Payments.Should().BeEmpty();
        booking.ChildBookings.Should().BeEmpty();
    }

    [Fact]
    public void Booking_ShouldAllowSettingProperties()
    {
        // Arrange
        var booking = new Booking();
        var clientId = Guid.NewGuid();
        var roomTypeId = Guid.NewGuid();
        var checkInDate = DateTime.Now.AddDays(1);
        var checkOutDate = DateTime.Now.AddDays(5);

        // Act
        booking.ClientId = clientId;
        booking.RoomTypeId = roomTypeId;
        booking.CheckInDate = checkInDate;
        booking.CheckOutDate = checkOutDate;
        booking.NumberOfPets = 2;
        booking.Status = BookingStatus.Pending;
        booking.BasePrice = 1000m;
        booking.AdditionalPetsPrice = 200m;
        booking.ServicesPrice = 150m;
        booking.TotalPrice = 1350m;
        booking.DiscountPercent = 10m;
        booking.DiscountAmount = 135m;

        // Assert
        booking.ClientId.Should().Be(clientId);
        booking.RoomTypeId.Should().Be(roomTypeId);
        booking.CheckInDate.Should().Be(checkInDate);
        booking.CheckOutDate.Should().Be(checkOutDate);
        booking.NumberOfPets.Should().Be(2);
        booking.Status.Should().Be(BookingStatus.Pending);
        booking.BasePrice.Should().Be(1000m);
        booking.AdditionalPetsPrice.Should().Be(200m);
        booking.ServicesPrice.Should().Be(150m);
        booking.TotalPrice.Should().Be(1350m);
        booking.DiscountPercent.Should().Be(10m);
        booking.DiscountAmount.Should().Be(135m);
    }

    [Fact]
    public void Booking_CompositeBooking_ShouldHaveChildBookings()
    {
        // Arrange
        var parentBooking = new Booking
        {
            IsComposite = true,
            ClientId = Guid.NewGuid(),
            Status = BookingStatus.Pending
        };

        var childBooking1 = new Booking
        {
            ParentBookingId = parentBooking.Id,
            SegmentOrder = 1
        };

        var childBooking2 = new Booking
        {
            ParentBookingId = parentBooking.Id,
            SegmentOrder = 2
        };

        // Act
        parentBooking.ChildBookings.Add(childBooking1);
        parentBooking.ChildBookings.Add(childBooking2);

        // Assert
        parentBooking.IsComposite.Should().BeTrue();
        parentBooking.ChildBookings.Should().HaveCount(2);
        parentBooking.ChildBookings.First().SegmentOrder.Should().Be(1);
        parentBooking.ChildBookings.Last().SegmentOrder.Should().Be(2);
    }

    [Fact]
    public void Booking_EarlyCheckout_ShouldStoreOriginalDate()
    {
        // Arrange
        var originalCheckOut = DateTime.Now.AddDays(10);
        var booking = new Booking
        {
            CheckInDate = DateTime.Now.AddDays(1),
            CheckOutDate = originalCheckOut,
            Status = BookingStatus.Confirmed
        };

        // Act - Simulate early checkout
        booking.IsEarlyCheckout = true;
        booking.OriginalCheckOutDate = originalCheckOut;
        booking.CheckOutDate = DateTime.Now.AddDays(7); // Left 3 days early

        // Assert
        booking.IsEarlyCheckout.Should().BeTrue();
        booking.OriginalCheckOutDate.Should().Be(originalCheckOut);
        booking.CheckOutDate.Should().BeBefore(originalCheckOut);
    }

    [Fact]
    public void Booking_RevenueConversion_ShouldTrackConversionDetails()
    {
        // Arrange
        var booking = new Booking
        {
            TotalPrice = 1000m,
            Status = BookingStatus.CheckedOut
        };

        // Act - Convert overpayment to revenue
        booking.OverpaymentConvertedToRevenue = true;
        booking.RevenueConversionAmount = 200m;
        booking.RevenueConversionComment = "Converted remaining balance to revenue";

        // Assert
        booking.OverpaymentConvertedToRevenue.Should().BeTrue();
        booking.RevenueConversionAmount.Should().Be(200m);
        booking.RevenueConversionComment.Should().Be("Converted remaining balance to revenue");
    }

    [Fact]
    public void Booking_PaymentApproval_ShouldTrackPrepaymentDetails()
    {
        // Arrange
        var booking = new Booking
        {
            TotalPrice = 1000m,
            Status = BookingStatus.Pending
        };

        // Act - Approve payment with prepayment requirement
        booking.PaymentApproved = true;
        booking.RequiredPrepaymentAmount = 300m;

        // Assert
        booking.PaymentApproved.Should().BeTrue();
        booking.RequiredPrepaymentAmount.Should().Be(300m);
        booking.PrepaymentCancelled.Should().BeFalse();
    }

    [Fact]
    public void Booking_ShouldSupportMultipleBookingPets()
    {
        // Arrange
        var booking = new Booking
        {
            ClientId = Guid.NewGuid(),
            NumberOfPets = 2
        };

        var pet1 = new BookingPet { BookingId = booking.Id, PetId = Guid.NewGuid() };
        var pet2 = new BookingPet { BookingId = booking.Id, PetId = Guid.NewGuid() };

        // Act
        booking.BookingPets.Add(pet1);
        booking.BookingPets.Add(pet2);

        // Assert
        booking.BookingPets.Should().HaveCount(2);
        booking.NumberOfPets.Should().Be(2);
    }

    [Fact]
    public void Booking_ShouldSupportAdditionalServices()
    {
        // Arrange
        var booking = new Booking
        {
            BasePrice = 1000m,
            ServicesPrice = 0m
        };

        var service1 = new BookingService
        {
            BookingId = booking.Id,
            ServiceId = Guid.NewGuid(),
            Price = 50m,
            Quantity = 2
        };

        var service2 = new BookingService
        {
            BookingId = booking.Id,
            ServiceId = Guid.NewGuid(),
            Price = 30m,
            Quantity = 1
        };

        // Act
        booking.BookingServices.Add(service1);
        booking.BookingServices.Add(service2);
        booking.ServicesPrice = 130m; // (50 * 2) + (30 * 1)

        // Assert
        booking.BookingServices.Should().HaveCount(2);
        booking.ServicesPrice.Should().Be(130m);
    }

    [Fact]
    public void Booking_ShouldSupportPaymentTracking()
    {
        // Arrange
        var booking = new Booking
        {
            TotalPrice = 1000m
        };

        var payment1 = new Payment
        {
            BookingId = booking.Id,
            Amount = 300m,
            PaymentType = PaymentType.Prepayment,
            PaymentStatus = PaymentStatus.Completed
        };

        var payment2 = new Payment
        {
            BookingId = booking.Id,
            Amount = 700m,
            PaymentType = PaymentType.FullPayment,
            PaymentStatus = PaymentStatus.Completed
        };

        // Act
        booking.Payments.Add(payment1);
        booking.Payments.Add(payment2);

        // Assert
        booking.Payments.Should().HaveCount(2);
        booking.Payments.Sum(p => p.Amount).Should().Be(1000m);
    }
}
