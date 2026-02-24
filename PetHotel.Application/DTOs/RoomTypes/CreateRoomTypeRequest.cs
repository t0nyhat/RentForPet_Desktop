namespace PetHotel.Application.DTOs.RoomTypes;

public class CreateRoomTypeRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int MaxCapacity { get; set; }
    public decimal PricePerNight { get; set; }
    public decimal PricePerAdditionalPet { get; set; }
    public decimal? SquareMeters { get; set; }
    public List<string> Features { get; set; } = new();
}
