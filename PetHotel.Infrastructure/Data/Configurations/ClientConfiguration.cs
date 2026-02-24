using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PetHotel.Domain.Entities;

namespace PetHotel.Infrastructure.Data.Configurations;

public class ClientConfiguration : IEntityTypeConfiguration<Client>
{
    public void Configure(EntityTypeBuilder<Client> builder)
    {
        builder.ToTable("Clients");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.FirstName)
        .IsRequired()
        .HasMaxLength(100);

        builder.Property(c => c.LastName)
        .IsRequired()
        .HasMaxLength(100);

        builder.Property(c => c.Phone)
        .IsRequired()
        .HasMaxLength(20);

        builder.Property(c => c.Address)
        .HasMaxLength(500);

        builder.Property(c => c.EmergencyContact)
        .HasMaxLength(200);

        builder.Property(c => c.EspoCrmId)
        .HasMaxLength(100);

        builder.Property(c => c.InternalNotes)
        .HasMaxLength(2000);

        builder.Property(c => c.LoyaltyDiscountPercent)
        .HasPrecision(5, 2)
        .HasDefaultValue(0);

        // Связи One-to-Many
        builder.HasMany(c => c.Pets)
        .WithOne(p => p.Client)
        .HasForeignKey(p => p.ClientId)
        .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(c => c.Bookings)
        .WithOne(b => b.Client)
        .HasForeignKey(b => b.ClientId)
        .OnDelete(DeleteBehavior.Restrict); // Не удаляем бронирования при удалении клиента

        // Индекс для поиска
        builder.HasIndex(c => c.Phone);
    }
}
