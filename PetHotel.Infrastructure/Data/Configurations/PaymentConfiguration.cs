using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PetHotel.Domain.Entities;

namespace PetHotel.Infrastructure.Data.Configurations;

public class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("Payments");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Amount)
        .IsRequired()
        .HasPrecision(10, 2);

        builder.Property(p => p.PaymentMethod)
        .IsRequired()
        .HasConversion<string>();

        builder.Property(p => p.PaymentStatus)
        .IsRequired()
        .HasConversion<string>();

        builder.Property(p => p.PaymentType)
        .IsRequired()
        .HasConversion<string>();

        builder.Property(p => p.PrepaymentPercentage)
        .HasPrecision(5, 2);

        builder.Property(p => p.TransactionId)
        .HasMaxLength(200);

        builder.Property(p => p.PaymentProof)
        .HasMaxLength(500);

        builder.Property(p => p.AdminComment)
        .HasMaxLength(1000);

        // Индексы
        builder.HasIndex(p => p.BookingId);
        builder.HasIndex(p => p.TransactionId);
        builder.HasIndex(p => p.PaymentStatus);
        builder.HasIndex(p => p.CreatedAt);

        // Составной индекс для частых запросов по бронированию и статусу
        builder.HasIndex(p => new { p.BookingId, p.PaymentStatus })
        .HasDatabaseName("IX_Payments_BookingId_PaymentStatus");

        // Составной индекс для сортировки платежей по дате
        builder.HasIndex(p => new { p.PaymentStatus, p.CreatedAt })
        .HasDatabaseName("IX_Payments_PaymentStatus_CreatedAt");
    }
}
