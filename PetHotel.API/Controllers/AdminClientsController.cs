using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PetHotel.Application.DTOs.Admin;
using PetHotel.Application.Interfaces;
using PetHotel.API.Services;

namespace PetHotel.API.Controllers;

[Route("api/admin/clients")]
public class AdminClientsController : BaseApiController
{
    private readonly IAdminClientService _adminClientService;
    private readonly AuditService _audit;

    public AdminClientsController(IAdminClientService adminClientService, AuditService audit)
    {
        _adminClientService = adminClientService;
        _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<AdminClientDto>>> GetClients()
    {
        var clients = await _adminClientService.GetClientsAsync();
        return Ok(clients);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<AdminClientDto>> GetClient(Guid id)
    {
        var client = await _adminClientService.GetClientByIdAsync(id);
        return Ok(client);
    }

    [HttpPost]
    public async Task<ActionResult<AdminClientDto>> CreateClient([FromBody] CreateClientRequest request)
    {
        var client = await _adminClientService.CreateClientAsync(request);
        await _audit.LogAsync("СОЗДАНИЕ КЛИЕНТА",
            $"Клиент создан: {request.LastName} {request.FirstName}",
            FormatClientDetails(client));
        return CreatedAtAction(nameof(GetClient), new { id = client.Id }, client);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<AdminClientDto>> UpdateClient(Guid id, [FromBody] UpdateClientRequest request)
    {
        var client = await _adminClientService.UpdateClientAsync(id, request);
        await _audit.LogAsync("ОБНОВЛЕНИЕ КЛИЕНТА",
            $"Клиент обновлён: {request.LastName} {request.FirstName}",
            FormatClientDetails(client));
        return Ok(client);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteClient(Guid id)
    {
        AdminClientDto? client = null;
        try { client = await _adminClientService.GetClientByIdAsync(id); } catch { /* best effort */ }

        await _adminClientService.DeleteClientAsync(id);

        await _audit.LogAsync("УДАЛЕНИЕ КЛИЕНТА",
            client != null ? $"Клиент удалён: {client.LastName} {client.FirstName}" : $"Клиент удалён",
            client != null ? FormatClientDetails(client) : $"ID: {id}");
        return NoContent();
    }

    [HttpPost("{clientId}/pets")]
    public async Task<ActionResult<AdminPetDto>> CreatePetForClient(Guid clientId, [FromBody] CreatePetForClientRequest request)
    {
        var pet = await _adminClientService.CreatePetForClientAsync(clientId, request);
        await _audit.LogAsync("СОЗДАНИЕ ПИТОМЦА",
            $"Питомец создан: {request.Name}",
            FormatPetDetails(pet, clientId));
        return CreatedAtAction(nameof(GetClient), new { id = clientId }, pet);
    }

    [HttpPut("{clientId}/pets/{petId}")]
    public async Task<ActionResult<AdminPetDto>> UpdatePetForClient(Guid clientId, Guid petId, [FromBody] UpdatePetForClientRequest request)
    {
        var pet = await _adminClientService.UpdatePetForClientAsync(clientId, petId, request);
        await _audit.LogAsync("ОБНОВЛЕНИЕ ПИТОМЦА",
            $"Питомец обновлён: {request.Name}",
            FormatPetDetails(pet, clientId));
        return Ok(pet);
    }

    [HttpPut("{clientId}/notes")]
    public async Task<ActionResult> UpdateClientNotes(Guid clientId, [FromBody] UpdateAdminNoteRequest request)
    {
        await _adminClientService.UpdateClientNotesAsync(clientId, request.Notes);
        await _audit.LogAsync("ЗАМЕТКИ ПО КЛИЕНТУ",
            $"Заметки по клиенту обновлены",
            $"ID клиента: {clientId}\nЗаметки: {request.Notes ?? "(пусто)"}");
        return NoContent();
    }

    [HttpPut("{clientId}/pets/{petId}/notes")]
    public async Task<ActionResult> UpdatePetNotes(Guid clientId, Guid petId, [FromBody] UpdateAdminNoteRequest request)
    {
        await _adminClientService.UpdatePetNotesAsync(clientId, petId, request.Notes);
        await _audit.LogAsync("ЗАМЕТКИ ПО ПИТОМЦУ",
            $"Заметки по питомцу обновлены",
            $"ID клиента: {clientId}\nID питомца: {petId}\nЗаметки: {request.Notes ?? "(пусто)"}");
        return NoContent();
    }

    // ── Форматирование ──────────────────────────────────

    private static string FormatClientDetails(AdminClientDto c)
    {
        var lines = new List<string>
        {
            $"ID: {c.Id}",
            $"ФИО: {c.LastName} {c.FirstName}",
            $"Email: {c.Email}",
            $"Телефон: {c.Phone}",
        };

        if (!string.IsNullOrWhiteSpace(c.Address))
            lines.Add($"Адрес: {c.Address}");

        if (c.LoyaltyDiscountPercent > 0)
            lines.Add($"Скидка лояльности: {c.LoyaltyDiscountPercent}%");

        if (c.Pets.Count > 0)
            lines.Add($"Питомцы ({c.Pets.Count}): {string.Join(", ", c.Pets.Select(p => $"{p.Name} ({p.Species})"))}");

        return string.Join("\n", lines);
    }

    private static string FormatPetDetails(AdminPetDto p, Guid clientId)
    {
        var lines = new List<string>
        {
            $"ID питомца: {p.Id}",
            $"ID клиента: {clientId}",
            $"Имя: {p.Name}",
            $"Вид: {p.Species}",
        };

        if (!string.IsNullOrWhiteSpace(p.Breed))
            lines.Add($"Порода: {p.Breed}");

        if (p.Gender != default)
            lines.Add($"Пол: {p.Gender}");

        if (p.Weight.HasValue)
            lines.Add($"Вес: {p.Weight}кг");

        if (!string.IsNullOrWhiteSpace(p.Color))
            lines.Add($"Окрас: {p.Color}");

        return string.Join("\n", lines);
    }
}
