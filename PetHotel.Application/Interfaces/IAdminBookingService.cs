using PetHotel.Application.DTOs.Admin;
using PetHotel.Application.DTOs.Bookings;
using PetHotel.Domain.Enums;

namespace PetHotel.Application.Interfaces;

public interface IAdminBookingService
{
    Task<IEnumerable<BookingDto>> GetBookingsAsync(DateTime? from, DateTime? to, BookingStatus? status, Guid? clientId = null);
    Task<IEnumerable<BookingDto>> GetBookingsRequiringPaymentAsync();
    Task<BookingDto> GetBookingByIdAsync(Guid id);
    Task<BookingDto> ConfirmBookingAsync(Guid bookingId);
    Task<BookingDto> CheckInAsync(Guid bookingId);
    Task<BookingDto> CheckOutAsync(Guid bookingId);
    Task<BookingDto> CancelBookingAsync(Guid bookingId);
    Task DeleteAsync(Guid bookingId);
    Task<BookingDto> UpdateDatesAsync(Guid bookingId, DateTime checkIn, DateTime checkOut);
    Task<BookingDto> CreateManualBookingAsync(AdminCreateBookingRequest request);
    Task<BookingDto> MergeBookingsAsync(List<Guid> bookingIds);
    Task<BookingDto> UpdatePrepaymentAmountAsync(Guid bookingId, decimal amount);
    Task<BookingDto> CancelPrepaymentAsync(Guid bookingId);
    Task<BookingDto> AssignRoomAsync(Guid bookingId, Guid roomId);
    Task<BookingDto> UpdateBookingRoomAndDatesAsync(Guid bookingId, Guid roomId, DateTime checkIn, DateTime checkOut);
    Task<IEnumerable<BookingDto>> GetBookingsRequiringRefundAsync();
    Task<BookingDto> ProcessRefundAsync(Guid bookingId, decimal? customAmount = null);
    Task<BookingDto> ConvertOverpaymentToRevenueAsync(Guid bookingId);
    Task<BookingDto> TransferPaymentAsync(Guid sourceBookingId, Guid targetBookingId, decimal? customAmount = null);
    Task<EarlyCheckoutCalculation> CalculateEarlyCheckoutAsync(Guid bookingId);
}
