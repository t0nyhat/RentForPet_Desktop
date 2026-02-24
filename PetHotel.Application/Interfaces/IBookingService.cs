using PetHotel.Application.DTOs.Bookings;
using PetHotel.Application.DTOs.Payments;

namespace PetHotel.Application.Interfaces;

public interface IBookingService
{
    Task<IEnumerable<BookingDto>> GetClientBookingsAsync(Guid clientId);
    Task<BookingDto> GetBookingByIdAsync(Guid id, Guid clientId);
    Task<BookingDto> CreateBookingAsync(CreateBookingRequest request, Guid clientId);
    Task<BookingDto> MergeBookingsAsync(List<Guid> bookingIds);
    Task<IEnumerable<RoomAvailabilityDto>> GetAvailableRoomsAsync(RoomAvailabilityRequest request, Guid clientId);
    Task CancelBookingAsync(Guid id, Guid clientId);
    Task<IEnumerable<RoomBookingCalendarDto>> GetRoomCalendarAsync(Guid roomId, DateTime from, DateTime to);
    Task<ReceiptDto> GetReceiptAsync(Guid bookingId, Guid clientId, bool isAdmin);
}
