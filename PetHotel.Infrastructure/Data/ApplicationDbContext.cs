using Microsoft.EntityFrameworkCore;
using PetHotel.Domain.Entities;
using PetHotel.Infrastructure.Data.Configurations;

namespace PetHotel.Infrastructure.Data;

public class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    // DbSets - таблицы в БД (только для локального десктопного приложения)
    public DbSet<User> Users { get; set; }
    public DbSet<Client> Clients { get; set; }
    public DbSet<Pet> Pets { get; set; }
    public DbSet<RoomType> RoomTypes { get; set; }
    public DbSet<Room> Rooms { get; set; }
    public DbSet<Booking> Bookings { get; set; }
    public DbSet<BookingPet> BookingPets { get; set; }
    public DbSet<AdditionalService> AdditionalServices { get; set; }
    public DbSet<BookingService> BookingServices { get; set; }
    public DbSet<Payment> Payments { get; set; }
    public DbSet<BookingSettings> BookingSettings { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Применяем все конфигурации из сборки
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
