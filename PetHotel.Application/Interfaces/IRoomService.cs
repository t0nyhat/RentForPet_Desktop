using PetHotel.Application.DTOs.Rooms;

namespace PetHotel.Application.Interfaces;

public interface IRoomService
{
    Task<IEnumerable<RoomDto>> GetAllRoomsAsync();
    Task<RoomDto> GetRoomByIdAsync(Guid id);
    Task<IEnumerable<RoomDto>> GetAvailableRoomsAsync(Guid roomTypeId, DateTime checkIn, DateTime checkOut);
    Task<IEnumerable<RoomDto>> GetAvailableRoomsAsync(DateTime checkIn, DateTime checkOut, int? numberOfPets = null);
    Task<RoomDto> CreateRoomAsync(CreateRoomRequest request);
    Task<RoomDto> UpdateRoomAsync(Guid id, CreateRoomRequest request);
    Task DeleteRoomAsync(Guid id);
}
