using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;

namespace PetHotel.Infrastructure.Data.Configurations;

public class BookingSettingsConfiguration : IEntityTypeConfiguration<BookingSettings>
{
    public void Configure(EntityTypeBuilder<BookingSettings> builder)
    {
        builder.ToTable("BookingSettings");

        builder.HasKey(bs => bs.Id);

        builder.Property(bs => bs.CalculationMode)
        .IsRequired()
        .HasConversion<string>()
        .HasDefaultValue(BookingCalculationMode.Days);

        builder.Property(bs => bs.CheckInTime)
        .IsRequired()
        .HasDefaultValue(new TimeSpan(15, 0, 0)); // 15:00

        builder.Property(bs => bs.CheckOutTime)
        .IsRequired()
        .HasDefaultValue(new TimeSpan(12, 0, 0)); // 12:00

        builder.Property(bs => bs.IsSingleton)
        .IsRequired()
        .HasDefaultValue(true);

        // Создаем уникальный индекс на IsSingleton, чтобы гарантировать только одну запись
        builder.HasIndex(bs => bs.IsSingleton)
        .IsUnique()
        .HasFilter("\"IsSingleton\" = true");

        // Seed данные - создаем запись по умолчанию с режимом "по дням"
        builder.HasData(new BookingSettings
        {
            Id = Guid.Parse("00000000-0000-0000-0000-000000000001"), // Фиксированный ID для единственной записи
            CalculationMode = BookingCalculationMode.Days,
            CheckInTime = new TimeSpan(15, 0, 0), // 15:00
            CheckOutTime = new TimeSpan(12, 0, 0), // 12:00
            IsSingleton = true,
            CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
        });
    }
}
