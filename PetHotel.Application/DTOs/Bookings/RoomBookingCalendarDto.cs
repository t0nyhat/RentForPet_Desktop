namespace PetHotel.Application.DTOs.Bookings;

public class RoomBookingCalendarDto
{
    public Guid BookingId { get; set; }
    public Guid RoomId { get; set; }
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
    public string Status { get; set; } = string.Empty;
}
