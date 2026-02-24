using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PetHotel.Application.DTOs.RoomTypes;
using PetHotel.Application.Interfaces;
using PetHotel.API.Services;

namespace PetHotel.API.Controllers;

[Route("api/room-types")]
public class RoomTypesController : BaseApiController
{
    private readonly IRoomTypeService _roomTypeService;
    private readonly AuditService _audit;

    public RoomTypesController(IRoomTypeService roomTypeService, AuditService audit)
    {
        _roomTypeService = roomTypeService;
        _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<RoomTypeDto>>> GetAllRoomTypes()
    {
        try
        {
            var roomTypes = await _roomTypeService.GetAllRoomTypesAsync();
            return Ok(roomTypes);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { error = "Внутренняя ошибка сервера", message = ex.Message });
        }
    }

    [HttpGet("all")]
    public async Task<ActionResult<IEnumerable<RoomTypeDto>>> GetAllRoomTypesWithInactive()
    {
        var roomTypes = await _roomTypeService.GetAllRoomTypesWithInactiveAsync();
        return Ok(roomTypes);
    }

    [HttpGet("available")]
    public async Task<ActionResult<IEnumerable<RoomTypeDto>>> GetAvailableRoomTypes(
    [FromQuery] DateTime checkIn,
    [FromQuery] DateTime checkOut)
    {
        var roomTypes = await _roomTypeService.GetAvailableRoomTypesAsync(checkIn, checkOut);
        return Ok(roomTypes);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<RoomTypeDto>> GetRoomType(Guid id)
    {
        var roomType = await _roomTypeService.GetRoomTypeByIdAsync(id);
        return Ok(roomType);
    }

    [HttpGet("{id}/busy-dates")]
    public async Task<ActionResult<IEnumerable<string>>> GetBusyDates(Guid id)
    {
        var busyDates = await _roomTypeService.GetBusyDatesAsync(id);
        return Ok(busyDates);
    }

    [HttpPost]
    public async Task<ActionResult<RoomTypeDto>> CreateRoomType([FromBody] CreateRoomTypeRequest request)
    {
        try
        {
            var roomType = await _roomTypeService.CreateRoomTypeAsync(request);
            await _audit.LogAsync("СОЗДАНИЕ ТИПА НОМЕРА",
                $"Тип номера создан: {request.Name}",
                FormatRoomTypeDetails(roomType));
            return CreatedAtAction(nameof(GetRoomType), new { id = roomType.Id }, roomType);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = "Не удалось создать тип номера", message = ex.Message });
        }
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<RoomTypeDto>> UpdateRoomType(Guid id, [FromBody] UpdateRoomTypeRequest request)
    {
        var roomType = await _roomTypeService.UpdateRoomTypeAsync(id, request);
        await _audit.LogAsync("ОБНОВЛЕНИЕ ТИПА НОМЕРА",
            $"Тип номера обновлён: {request.Name}",
            FormatRoomTypeDetails(roomType));
        return Ok(roomType);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteRoomType(Guid id)
    {
        RoomTypeDto? roomType = null;
        try { roomType = await _roomTypeService.GetRoomTypeByIdAsync(id); } catch { /* best effort */ }

        await _roomTypeService.DeleteRoomTypeAsync(id);

        await _audit.LogAsync("УДАЛЕНИЕ ТИПА НОМЕРА",
            roomType != null ? $"Тип номера удалён: {roomType.Name}" : "Тип номера удалён",
            roomType != null ? FormatRoomTypeDetails(roomType) : $"ID: {id}");
        return NoContent();
    }

    private static string FormatRoomTypeDetails(RoomTypeDto rt)
    {
        var lines = new List<string>
        {
            $"ID: {rt.Id}",
            $"Название: {rt.Name}",
            $"Цена за ночь: {rt.PricePerNight:N2}₽",
            $"Доп. питомец: {rt.PricePerAdditionalPet:N2}₽",
            $"Макс. вместимость: {rt.MaxCapacity}",
            $"Активен: {(rt.IsActive ? "Да" : "Нет")}",
        };

        if (rt.SquareMeters.HasValue)
            lines.Add($"Площадь: {rt.SquareMeters}м²");

        if (!string.IsNullOrWhiteSpace(rt.Description))
            lines.Add($"Описание: {rt.Description}");

        if (rt.Features != null && rt.Features.Count > 0)
            lines.Add($"Особенности: {string.Join(", ", rt.Features)}");

        return string.Join("\n", lines);
    }
}
