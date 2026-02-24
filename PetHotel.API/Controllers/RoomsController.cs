using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PetHotel.Application.DTOs.Rooms;
using PetHotel.Application.Interfaces;
using PetHotel.API.Services;

namespace PetHotel.API.Controllers;

public class RoomsController : BaseApiController
{
    private readonly IRoomService _roomService;
    private readonly AuditService _audit;

    public RoomsController(IRoomService roomService, AuditService audit)
    {
        _roomService = roomService;
        _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<RoomDto>>> GetAllRooms()
    {
        var rooms = await _roomService.GetAllRoomsAsync();
        return Ok(rooms);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<RoomDto>> GetRoom(Guid id)
    {
        var room = await _roomService.GetRoomByIdAsync(id);
        return Ok(room);
    }

    [HttpGet("available")]
    public async Task<ActionResult<IEnumerable<RoomDto>>> GetAvailableRooms(
    [FromQuery] Guid roomTypeId,
    [FromQuery] DateTime checkIn,
    [FromQuery] DateTime checkOut)
    {
        var rooms = await _roomService.GetAvailableRoomsAsync(roomTypeId, checkIn, checkOut);
        return Ok(rooms);
    }

    [HttpGet("available-range")]
    public async Task<ActionResult<IEnumerable<RoomDto>>> GetAvailableRoomsForRange(
    [FromQuery] DateTime checkIn,
    [FromQuery] DateTime checkOut,
    [FromQuery] int? numberOfPets = null)
    {
        var rooms = await _roomService.GetAvailableRoomsAsync(checkIn, checkOut, numberOfPets);
        return Ok(rooms);
    }

    [HttpPost]
    public async Task<ActionResult<RoomDto>> CreateRoom([FromBody] CreateRoomRequest request)
    {
        var room = await _roomService.CreateRoomAsync(request);
        await _audit.LogAsync("СОЗДАНИЕ НОМЕРА",
            $"Номер создан: {request.RoomNumber}",
            FormatRoomDetails(room));
        return CreatedAtAction(nameof(GetRoom), new { id = room.Id }, room);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<RoomDto>> UpdateRoom(Guid id, [FromBody] CreateRoomRequest request)
    {
        var room = await _roomService.UpdateRoomAsync(id, request);
        await _audit.LogAsync("ОБНОВЛЕНИЕ НОМЕРА",
            $"Номер обновлён: {request.RoomNumber}",
            FormatRoomDetails(room));
        return Ok(room);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteRoom(Guid id)
    {
        RoomDto? room = null;
        try { room = await _roomService.GetRoomByIdAsync(id); } catch { /* best effort */ }

        await _roomService.DeleteRoomAsync(id);

        await _audit.LogAsync("УДАЛЕНИЕ НОМЕРА",
            room != null ? $"Номер удалён: {room.RoomNumber}" : $"Номер удалён",
            room != null ? FormatRoomDetails(room) : $"ID: {id}");
        return NoContent();
    }

    private static string FormatRoomDetails(RoomDto r)
    {
        var lines = new List<string>
        {
            $"ID: {r.Id}",
            $"Номер: {r.RoomNumber}",
            $"Тип: {r.RoomTypeName}",
            $"Активен: {(r.IsActive ? "Да" : "Нет")}",
        };

        if (r.Floor.HasValue)
            lines.Add($"Этаж: {r.Floor}");

        if (!string.IsNullOrWhiteSpace(r.SpecialNotes))
            lines.Add($"Заметки: {r.SpecialNotes}");

        return string.Join("\n", lines);
    }
}
