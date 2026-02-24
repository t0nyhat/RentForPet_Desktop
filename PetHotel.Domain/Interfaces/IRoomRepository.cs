using PetHotel.Domain.Entities;

namespace PetHotel.Domain.Interfaces;

public interface IRoomRepository : IRepository<Room>
{
    Task<IEnumerable<Room>> GetActiveRoomsAsync();
    Task<Room?> GetActiveByIdAsync(Guid id);
    Task<bool> RoomNumberExistsAsync(string roomNumber, Guid? excludeId = null);
    Task<IEnumerable<Room>> GetAvailableRoomsAsync(DateTime checkIn, DateTime checkOut, int numberOfPets);
    Task<IEnumerable<Room>> GetByRoomTypeIdAsync(Guid roomTypeId);
    Task<int> GetCountByRoomTypeAsync(Guid roomTypeId);
}
