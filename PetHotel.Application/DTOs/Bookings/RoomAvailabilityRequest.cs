namespace PetHotel.Application.DTOs.Bookings;

public class RoomAvailabilityRequest
{
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
    public int NumberOfPets { get; set; }
}
