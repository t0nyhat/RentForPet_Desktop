namespace PetHotel.Application.DTOs.Services;

public class AddServiceToBookingRequest
{
    public Guid BookingId { get; set; }
    public Guid ServiceId { get; set; }
    public Guid? BookingPetId { get; set; } // Опционально - для каких питомцев
    public int Quantity { get; set; }
    public DateTime? Date { get; set; }
}
