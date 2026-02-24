namespace PetHotel.Application.DTOs.Rooms;

public class UpdateRoomRequest
{
    public string RoomNumber { get; set; } = string.Empty;
    public Guid RoomTypeId { get; set; }
    public int? Floor { get; set; }
    public string? SpecialNotes { get; set; }
    public bool IsActive { get; set; }
}
