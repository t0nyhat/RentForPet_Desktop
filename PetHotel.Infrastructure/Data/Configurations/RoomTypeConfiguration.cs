using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PetHotel.Domain.Entities;

namespace PetHotel.Infrastructure.Data.Configurations;

public class RoomTypeConfiguration : IEntityTypeConfiguration<RoomType>
{
    public void Configure(EntityTypeBuilder<RoomType> builder)
    {
        builder.ToTable("RoomTypes");

        builder.HasKey(rt => rt.Id);

        builder.Property(rt => rt.Name)
        .IsRequired()
        .HasMaxLength(50);

        builder.Property(rt => rt.Description)
        .HasMaxLength(1000);

        builder.Property(rt => rt.MaxCapacity)
        .IsRequired();

        builder.Property(rt => rt.PricePerNight)
        .IsRequired()
        .HasPrecision(10, 2);

        builder.Property(rt => rt.PricePerAdditionalPet)
        .IsRequired()
        .HasPrecision(10, 2);

        builder.Property(rt => rt.SquareMeters)
        .HasPrecision(6, 2);

        builder.Property(rt => rt.Features)
        .HasMaxLength(2000); // JSON

        builder.Property(rt => rt.IsActive)
        .IsRequired()
        .HasDefaultValue(true);

        // Связи
        builder.HasMany(rt => rt.Rooms)
        .WithOne(r => r.RoomType)
        .HasForeignKey(r => r.RoomTypeId)
        .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(rt => rt.Bookings)
        .WithOne(b => b.RoomType)
        .HasForeignKey(b => b.RoomTypeId)
        .OnDelete(DeleteBehavior.Restrict);

        // Индексы
        // Уникальный индекс по Name
        builder.HasIndex(rt => rt.Name)
        .IsUnique();

        // Индекс для фильтрации активных типов номеров
        builder.HasIndex(rt => rt.IsActive);
    }
}
