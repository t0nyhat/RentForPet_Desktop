namespace PetHotel.Application.DTOs.Rooms;

public class RoomDto
{
    public Guid Id { get; set; }
    public string RoomNumber { get; set; } = string.Empty;
    public Guid RoomTypeId { get; set; }
    public string RoomTypeName { get; set; } = string.Empty;
    public int? Floor { get; set; }
    public string? SpecialNotes { get; set; }
    public bool IsActive { get; set; }
}
