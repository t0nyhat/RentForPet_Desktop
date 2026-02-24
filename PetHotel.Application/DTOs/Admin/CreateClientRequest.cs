using System.ComponentModel.DataAnnotations;

namespace PetHotel.Application.DTOs.Admin;

public class CreateClientRequest
{
    private string? _email;
    private string? _phone;

    [Required(ErrorMessage = "Имя обязательно")]
    [MaxLength(50)]
    public string FirstName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Фамилия обязательна")]
    [MaxLength(50)]
    public string LastName { get; set; } = string.Empty;

    [EmailAddress(ErrorMessage = "Некорректный email")]
    [MaxLength(100)]
    public string? Email
    {
        get => _email;
        set => _email = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    [Phone(ErrorMessage = "Некорректный номер телефона")]
    [MaxLength(20)]
    public string? Phone
    {
        get => _phone;
        set => _phone = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    [MaxLength(200)]
    public string? Address { get; set; }

    [MaxLength(100)]
    public string? EmergencyContact { get; set; }

    [MaxLength(2000)]
    public string? InternalNotes { get; set; }

    [Range(0, 100, ErrorMessage = "Скидка должна быть в диапазоне 0-100%")]
    public decimal LoyaltyDiscountPercent { get; set; } = 0;
}
