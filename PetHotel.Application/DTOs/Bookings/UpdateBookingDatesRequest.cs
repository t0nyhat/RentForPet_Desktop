namespace PetHotel.Application.DTOs.Bookings;

public class UpdateBookingDatesRequest
{
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
}
