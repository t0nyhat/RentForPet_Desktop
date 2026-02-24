using PetHotel.Domain.Entities;

namespace PetHotel.Domain.Interfaces;

public interface IRoomTypeRepository : IRepository<RoomType>
{
    Task<IEnumerable<RoomType>> GetActiveRoomTypesAsync();
    Task<RoomType?> GetActiveByIdAsync(Guid id);
    Task<RoomType?> GetByIdWithPhotosAsync(Guid id);
    Task<bool> RoomTypeNameExistsAsync(string name, Guid? excludeId = null);
    Task<int> GetAvailableRoomsCountAsync(Guid roomTypeId, DateTime checkIn, DateTime checkOut);
}
