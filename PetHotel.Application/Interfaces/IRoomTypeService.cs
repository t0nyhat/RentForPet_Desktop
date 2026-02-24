using PetHotel.Application.DTOs.RoomTypes;

namespace PetHotel.Application.Interfaces;

public interface IRoomTypeService
{
    Task<IEnumerable<RoomTypeDto>> GetAllRoomTypesAsync();
    Task<IEnumerable<RoomTypeDto>> GetAllRoomTypesWithInactiveAsync();
    Task<IEnumerable<RoomTypeDto>> GetAvailableRoomTypesAsync(DateTime checkIn, DateTime checkOut);
    Task<RoomTypeDto> GetRoomTypeByIdAsync(Guid id);
    Task<IEnumerable<string>> GetBusyDatesAsync(Guid roomTypeId);
    Task<RoomTypeDto> CreateRoomTypeAsync(CreateRoomTypeRequest request);
    Task<RoomTypeDto> UpdateRoomTypeAsync(Guid id, UpdateRoomTypeRequest request);
    Task DeleteRoomTypeAsync(Guid id);
}
