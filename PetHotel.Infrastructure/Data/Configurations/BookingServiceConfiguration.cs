using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PetHotel.Domain.Entities;

namespace PetHotel.Infrastructure.Data.Configurations;

public class BookingServiceConfiguration : IEntityTypeConfiguration<BookingService>
{
    public void Configure(EntityTypeBuilder<BookingService> builder)
    {
        builder.ToTable("BookingServices");

        builder.HasKey(bs => bs.Id);

        builder.Property(bs => bs.Quantity)
        .IsRequired();

        builder.Property(bs => bs.Price)
        .IsRequired()
        .HasPrecision(10, 2);

        builder.Property(bs => bs.Status)
        .IsRequired()
        .HasMaxLength(50);

        // Индексы
        builder.HasIndex(bs => bs.BookingId);
        builder.HasIndex(bs => bs.ServiceId);

        // Составной индекс для избежания дубликатов и быстрого поиска
        builder.HasIndex(bs => new { bs.BookingId, bs.ServiceId })
        .HasDatabaseName("IX_BookingServices_BookingId_ServiceId");
    }
}
