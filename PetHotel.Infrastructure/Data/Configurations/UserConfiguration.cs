using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PetHotel.Domain.Entities;

namespace PetHotel.Infrastructure.Data.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");

        builder.HasKey(u => u.Id);

        builder.Property(u => u.Email)
        .IsRequired()
        .HasMaxLength(256);

        builder.Property(u => u.PasswordHash)
        .IsRequired()
        .HasMaxLength(512);

        builder.Property(u => u.Role)
        .IsRequired()
        .HasConversion<string>(); // Храним enum как строку

        builder.Property(u => u.IsActive)
        .IsRequired()
        .HasDefaultValue(true);

        builder.Property(u => u.RefreshToken)
        .HasMaxLength(512);

        // Email confirmation fields
        builder.Property(u => u.EmailConfirmed)
        .IsRequired()
        .HasDefaultValue(false);

        builder.Property(u => u.EmailConfirmationToken)
        .HasMaxLength(512);

        builder.Property(u => u.PasswordResetToken)
        .HasMaxLength(512);

        // Уникальный индекс по Email
        builder.HasIndex(u => u.Email)
        .IsUnique();

        // Связь One-to-One с Client
        builder.HasOne(u => u.Client)
        .WithOne(c => c.User)
        .HasForeignKey<Client>(c => c.UserId)
        .OnDelete(DeleteBehavior.Cascade);
    }
}
