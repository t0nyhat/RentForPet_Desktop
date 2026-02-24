using Microsoft.AspNetCore.Mvc;
using PetHotel.Application.DTOs.Pets;
using PetHotel.Application.Interfaces;

namespace PetHotel.API.Controllers;

public class PetsController : BaseApiController
{
    private readonly IPetService _petService;

    public PetsController(IPetService petService)
    {
        _petService = petService;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<PetDto>>> GetMyPets()
    {
        var clientId = GetClientId();
        var pets = await _petService.GetClientPetsAsync(clientId);
        return Ok(pets);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<PetDto>> GetPet(Guid id)
    {
        var clientId = GetClientId();
        var pet = await _petService.GetPetByIdAsync(id, clientId);
        return Ok(pet);
    }

    [HttpPost]
    public async Task<ActionResult<PetDto>> CreatePet([FromBody] CreatePetRequest request)
    {
        var clientId = GetClientId();
        var pet = await _petService.CreatePetAsync(request, clientId);
        return CreatedAtAction(nameof(GetPet), new { id = pet.Id }, pet);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult<PetDto>> UpdatePet(Guid id, [FromBody] UpdatePetRequest request)
    {
        var clientId = GetClientId();
        var pet = await _petService.UpdatePetAsync(id, request, clientId);
        return Ok(pet);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeletePet(Guid id)
    {
        if (IsAdmin())
        {
            await _petService.DeletePetForAdminAsync(id);
        }
        else
        {
            var clientId = GetClientId();
            await _petService.DeletePetAsync(id, clientId);
        }

        return NoContent();
    }
}
