using PetHotel.Domain.Enums;

namespace PetHotel.Application.DTOs.Services;

public class AdditionalServiceDto
{
    public Guid Id { get; set; }
    public ServiceType ServiceType { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public decimal Price { get; set; }
    public ServiceUnit Unit { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}
