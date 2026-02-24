using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PetHotel.Domain.Entities;

namespace PetHotel.Infrastructure.Data.Configurations;

public class AdditionalServiceConfiguration : IEntityTypeConfiguration<AdditionalService>
{
    public void Configure(EntityTypeBuilder<AdditionalService> builder)
    {
        builder.ToTable("AdditionalServices");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.ServiceType)
        .IsRequired()
        .HasConversion<string>();

        builder.Property(s => s.Name)
        .IsRequired()
        .HasMaxLength(200);

        builder.Property(s => s.Description)
        .HasMaxLength(1000);

        builder.Property(s => s.Price)
        .IsRequired()
        .HasPrecision(10, 2);

        builder.Property(s => s.Unit)
        .IsRequired()
        .HasConversion<string>();

        builder.Property(s => s.IsActive)
        .IsRequired()
        .HasDefaultValue(true);

        // Связи
        builder.HasMany(s => s.BookingServices)
        .WithOne(bs => bs.Service)
        .HasForeignKey(bs => bs.ServiceId)
        .OnDelete(DeleteBehavior.Restrict);

        // Индексы
        // Уникальный индекс по комбинации ServiceType и Name
        builder.HasIndex(s => new { s.ServiceType, s.Name })
        .IsUnique();
    }
}
