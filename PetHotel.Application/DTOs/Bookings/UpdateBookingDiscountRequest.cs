using System.ComponentModel.DataAnnotations;

namespace PetHotel.Application.DTOs.Bookings;

public class UpdateBookingDiscountRequest
{
    [Range(0, 100, ErrorMessage = "Скидка должна быть в диапазоне 0-100%")]
    public decimal DiscountPercent { get; set; }
}
