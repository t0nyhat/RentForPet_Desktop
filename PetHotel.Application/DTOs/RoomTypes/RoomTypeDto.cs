namespace PetHotel.Application.DTOs.RoomTypes;

public class RoomTypeDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public int MaxCapacity { get; set; }
    public decimal PricePerNight { get; set; }
    public decimal PricePerAdditionalPet { get; set; }
    public decimal? SquareMeters { get; set; }
    public List<string>? Features { get; set; }
    public bool IsActive { get; set; }
    public int AvailableRoomsCount { get; set; } // Количество доступных номеров этого типа
}
