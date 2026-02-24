using PetHotel.Application.DTOs.RoomTypes;

namespace PetHotel.Application.DTOs.Bookings;

public class RoomAvailabilityDto
{
    public RoomTypeDto RoomType { get; set; } = null!;
    public decimal TotalPrice { get; set; }
    public PriceBreakdownDto PriceBreakdown { get; set; } = null!;
}

public class PriceBreakdownDto
{
    public decimal BasePrice { get; set; }
    public decimal AdditionalPetsPrice { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal LoyaltyDiscountPercent { get; set; }
    public int NumberOfNights { get; set; }
    public int NumberOfPets { get; set; }
}
