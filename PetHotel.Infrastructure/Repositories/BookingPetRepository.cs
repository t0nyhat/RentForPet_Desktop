using PetHotel.Domain.Entities;
using PetHotel.Domain.Interfaces;
using PetHotel.Infrastructure.Data;

namespace PetHotel.Infrastructure.Repositories;

public class BookingPetRepository : Repository<BookingPet>, IBookingPetRepository
{
    public BookingPetRepository(ApplicationDbContext context) : base(context)
    {
    }

    public async Task AddRangeAsync(IEnumerable<BookingPet> bookingPets)
    {
        await _dbSet.AddRangeAsync(bookingPets);
    }
}
