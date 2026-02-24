using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PetHotel.Domain.Entities;

namespace PetHotel.Infrastructure.Data.Configurations;

public class PetConfiguration : IEntityTypeConfiguration<Pet>
{
    public void Configure(EntityTypeBuilder<Pet> builder)
    {
        builder.ToTable("Pets");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Name)
        .IsRequired()
        .HasMaxLength(100);

        builder.Property(p => p.Species)
        .IsRequired()
        .HasConversion<string>();

        builder.Property(p => p.Breed)
        .HasMaxLength(100);

        builder.Property(p => p.Gender)
        .IsRequired()
        .HasConversion<string>();

        builder.Property(p => p.Weight)
        .HasPrecision(5, 2); // 999.99 кг максимум

        builder.Property(p => p.Color)
        .HasMaxLength(50);

        builder.Property(p => p.Microchip)
        .HasMaxLength(50);

        builder.Property(p => p.SpecialNeeds)
        .HasMaxLength(1000);

        builder.Property(p => p.InternalNotes)
        .HasMaxLength(2000);

        builder.Property(p => p.IsActive)
        .IsRequired()
        .HasDefaultValue(true);

        // Связи
        builder.HasMany(p => p.BookingPets)
        .WithOne(bp => bp.Pet)
        .HasForeignKey(bp => bp.PetId)
        .OnDelete(DeleteBehavior.Restrict);

        // Индексы
        builder.HasIndex(p => p.ClientId);
        builder.HasIndex(p => p.Microchip);
        builder.HasIndex(p => p.IsActive);

        // Составной индекс для частых запросов активных питомцев клиента
        builder.HasIndex(p => new { p.ClientId, p.IsActive })
        .HasDatabaseName("IX_Pets_ClientId_IsActive");
    }
}
