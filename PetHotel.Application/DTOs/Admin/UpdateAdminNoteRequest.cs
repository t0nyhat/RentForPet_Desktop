using System.ComponentModel.DataAnnotations;

namespace PetHotel.Application.DTOs.Admin;

public class UpdateAdminNoteRequest
{
    [MaxLength(2000)]
    public string? Notes { get; set; }
}
