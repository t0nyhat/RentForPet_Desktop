using PetHotel.Domain.Common;
using PetHotel.Domain.Enums;

namespace PetHotel.Domain.Entities;

public class AdditionalService : BaseEntity
{
    public ServiceType ServiceType { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public ServiceUnit Unit { get; set; }
    public bool IsActive { get; set; }

    // Navigation properties
    public ICollection<BookingService> BookingServices { get; set; } = new List<BookingService>();
}
