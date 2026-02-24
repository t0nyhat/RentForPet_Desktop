using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PetHotel.Domain.Entities;

namespace PetHotel.Infrastructure.Data.Configurations;

public class BookingPetConfiguration : IEntityTypeConfiguration<BookingPet>
{
    public void Configure(EntityTypeBuilder<BookingPet> builder)
    {
        builder.ToTable("BookingPets");

        builder.HasKey(bp => bp.Id);

        builder.Property(bp => bp.SpecialRequests)
        .HasMaxLength(500);

        // Связи
        builder.HasMany(bp => bp.BookingServices)
        .WithOne(bs => bs.BookingPet)
        .HasForeignKey(bs => bs.BookingPetId)
        .OnDelete(DeleteBehavior.SetNull);

        // Индексы
        builder.HasIndex(bp => bp.BookingId);
        builder.HasIndex(bp => bp.PetId);
    }
}
