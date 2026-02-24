using PetHotel.Domain.Entities;

namespace PetHotel.Domain.Interfaces;

public interface IBookingPetRepository : IRepository<BookingPet>
{
    Task AddRangeAsync(IEnumerable<BookingPet> bookingPets);
}
