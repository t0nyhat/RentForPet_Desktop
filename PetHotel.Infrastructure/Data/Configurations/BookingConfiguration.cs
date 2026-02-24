using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PetHotel.Domain.Entities;

namespace PetHotel.Infrastructure.Data.Configurations;

public class BookingConfiguration : IEntityTypeConfiguration<Booking>
{
    public void Configure(EntityTypeBuilder<Booking> builder)
    {
        builder.ToTable("Bookings");

        builder.HasKey(b => b.Id);

        builder.Property(b => b.CheckInDate)
        .IsRequired();

        builder.Property(b => b.CheckOutDate)
        .IsRequired();

        builder.Property(b => b.NumberOfPets)
        .IsRequired();

        builder.Property(b => b.Status)
        .IsRequired()
        .HasConversion<string>();

        builder.Property(b => b.BasePrice)
        .IsRequired()
        .HasPrecision(10, 2);

        builder.Property(b => b.AdditionalPetsPrice)
        .IsRequired()
        .HasPrecision(10, 2);

        builder.Property(b => b.ServicesPrice)
        .IsRequired()
        .HasPrecision(10, 2);

        builder.Property(b => b.TotalPrice)
        .IsRequired()
        .HasPrecision(10, 2);

        builder.Property(b => b.DiscountPercent)
        .IsRequired()
        .HasPrecision(5, 2)
        .HasDefaultValue(0);

        builder.Property(b => b.DiscountAmount)
        .IsRequired()
        .HasPrecision(10, 2)
        .HasDefaultValue(0);

        builder.Property(b => b.SpecialRequests)
        .HasMaxLength(1000);

        builder.Property(b => b.PaymentApproved)
        .IsRequired()
        .HasDefaultValue(false);

        builder.Property(b => b.RequiredPrepaymentAmount)
        .IsRequired()
        .HasPrecision(10, 2)
        .HasDefaultValue(0);

        // Составные бронирования
        builder.Property(b => b.IsComposite)
        .IsRequired()
        .HasDefaultValue(false);

        builder.Property(b => b.ParentBookingId)
        .IsRequired(false);

        builder.Property(b => b.SegmentOrder)
        .IsRequired(false);

        // Связи
        builder.HasMany(b => b.BookingPets)
        .WithOne(bp => bp.Booking)
        .HasForeignKey(bp => bp.BookingId)
        .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(b => b.BookingServices)
        .WithOne(bs => bs.Booking)
        .HasForeignKey(bs => bs.BookingId)
        .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(b => b.Payments)
        .WithOne(p => p.Booking)
        .HasForeignKey(p => p.BookingId)
        .OnDelete(DeleteBehavior.Cascade);

        // Составные бронирования - связь parent-child
        builder.HasOne(b => b.ParentBooking)
        .WithMany(b => b.ChildBookings)
        .HasForeignKey(b => b.ParentBookingId)
        .OnDelete(DeleteBehavior.Restrict); // Предотвращаем каскадное удаление

        // Индексы для быстрого поиска
        builder.HasIndex(b => b.ClientId);
        builder.HasIndex(b => b.RoomTypeId);
        builder.HasIndex(b => b.AssignedRoomId);
        builder.HasIndex(b => b.CheckInDate);
        builder.HasIndex(b => b.CheckOutDate);
        builder.HasIndex(b => b.Status);
        builder.HasIndex(b => b.ParentBookingId);
        builder.HasIndex(b => b.IsComposite);

        // Составные индексы для частых запросов (оптимизация производительности)
        builder.HasIndex(b => new { b.Status, b.CheckInDate })
        .HasDatabaseName("IX_Bookings_Status_CheckInDate");

        builder.HasIndex(b => new { b.CheckOutDate, b.CheckInDate, b.Status })
        .HasDatabaseName("IX_Bookings_DateRange_Status");

        builder.HasIndex(b => new { b.AssignedRoomId, b.CheckInDate, b.CheckOutDate, b.Status })
        .HasDatabaseName("IX_Bookings_Room_DateRange_Status");

        // Составной индекс для запросов по типу номера с фильтрацией по статусу и составности
        builder.HasIndex(b => new { b.RoomTypeId, b.Status, b.IsComposite, b.CheckInDate, b.CheckOutDate })
        .HasDatabaseName("IX_Bookings_RoomType_Status_Composite_Dates");
    }
}
