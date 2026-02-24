using System.ComponentModel.DataAnnotations;

namespace PetHotel.Application.DTOs.Rooms;

public class CreateRoomRequest
{
    [Required(ErrorMessage = "Номер комнаты обязателен")]
    [MaxLength(20)]
    public string RoomNumber { get; set; } = string.Empty;

    [Required(ErrorMessage = "Тип номера обязателен")]
    public Guid RoomTypeId { get; set; }

    public int? Floor { get; set; }

    [MaxLength(500)]
    public string? SpecialNotes { get; set; }
}
