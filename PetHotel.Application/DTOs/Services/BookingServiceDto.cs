namespace PetHotel.Application.DTOs.Services;

public class BookingServiceDto
{
    public Guid Id { get; set; }
    public Guid BookingId { get; set; }
    public Guid? BookingPetId { get; set; }
    public Guid ServiceId { get; set; }
    public int Quantity { get; set; }
    public decimal Price { get; set; }
    public DateTime? Date { get; set; }
    public string Status { get; set; } = "Scheduled";

    // Navigation
    public AdditionalServiceDto? Service { get; set; }
    public string? PetName { get; set; } // Для удобства на фронте
}
