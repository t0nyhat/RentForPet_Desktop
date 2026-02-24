using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using PetHotel.Domain.Entities;

namespace PetHotel.Infrastructure.Data.Configurations;

public class RoomConfiguration : IEntityTypeConfiguration<Room>
{
    public void Configure(EntityTypeBuilder<Room> builder)
    {
        builder.ToTable("Rooms");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.RoomNumber)
        .IsRequired()
        .HasMaxLength(20);

        builder.Property(r => r.Floor);

        builder.Property(r => r.SpecialNotes)
        .HasMaxLength(500);

        builder.Property(r => r.IsActive)
        .IsRequired()
        .HasDefaultValue(true);

        // Связи
        builder.HasMany(r => r.AssignedBookings)
        .WithOne(b => b.AssignedRoom)
        .HasForeignKey(b => b.AssignedRoomId)
        .OnDelete(DeleteBehavior.Restrict);

        // Индексы
        // Уникальный индекс по RoomNumber
        builder.HasIndex(r => r.RoomNumber)
        .IsUnique();

        builder.HasIndex(r => r.RoomTypeId);
        builder.HasIndex(r => r.IsActive);

        // Составной индекс для частых запросов по типу и активности
        builder.HasIndex(r => new { r.RoomTypeId, r.IsActive })
        .HasDatabaseName("IX_Rooms_RoomTypeId_IsActive");
    }
}
