namespace PetHotel.Application.DTOs.Bookings;

public class MergeBookingsRequest
{
    public List<Guid> BookingIds { get; set; } = new();
}
