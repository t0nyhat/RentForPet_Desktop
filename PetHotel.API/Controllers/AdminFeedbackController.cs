using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using PetHotel.Application.DTOs.Admin;
using PetHotel.Application.Interfaces;

namespace PetHotel.API.Controllers;

[Route("api/admin/feedback")]
public class AdminFeedbackController : BaseApiController
{
    private readonly IEmailService _emailService;

    public AdminFeedbackController(IEmailService emailService)
    {
        _emailService = emailService;
    }

    [HttpPost]
    public async Task<IActionResult> SendFeedback([FromBody] FeedbackRequestDto request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(new { error = "Invalid feedback data" });
        }

        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var role = User.FindFirst(ClaimTypes.Role)?.Value;
        var clientId = User.FindFirst("ClientId")?.Value;

        await _emailService.SendFeedbackAsync(request, userId, role, clientId);
        return Ok(new { message = "Feedback sent" });
    }
}
