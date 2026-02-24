using AutoMapper;
using PetHotel.Application.Common.Exceptions;
using PetHotel.Application.DTOs.Pets;
using PetHotel.Application.Interfaces;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Interfaces;

namespace PetHotel.Application.Services;

public class PetService : IPetService
{
    private readonly IPetRepository _petRepository;
    private readonly IClientRepository _clientRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public PetService(
    IPetRepository petRepository,
    IClientRepository clientRepository,
    IUnitOfWork unitOfWork,
    IMapper mapper)
    {
        _petRepository = petRepository;
        _clientRepository = clientRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<IEnumerable<PetDto>> GetClientPetsAsync(Guid clientId)
    {
        var pets = await _petRepository.GetByClientIdAsync(clientId);
        return _mapper.Map<IEnumerable<PetDto>>(pets);
    }

    public async Task<PetDto> GetPetByIdAsync(Guid id, Guid clientId)
    {
        var pet = await _petRepository.GetByIdAndClientIdAsync(id, clientId);

        if (pet == null)
            throw new NotFoundException("Питомец", id);

        return _mapper.Map<PetDto>(pet);
    }

    public async Task<PetDto> CreatePetAsync(CreatePetRequest request, Guid clientId)
    {
        // Проверяем, что клиент существует
        var clientExists = await _clientRepository.ExistsAsync(clientId);
        if (!clientExists)
            throw new NotFoundException("Клиент", clientId);

        var pet = _mapper.Map<Pet>(request);
        pet.ClientId = clientId;

        await _petRepository.AddAsync(pet);
        await _unitOfWork.SaveChangesAsync();

        return _mapper.Map<PetDto>(pet);
    }

    public async Task<PetDto> UpdatePetAsync(Guid id, UpdatePetRequest request, Guid clientId)
    {
        var pet = await _petRepository.GetByIdAndClientIdAsync(id, clientId);

        if (pet == null)
            throw new NotFoundException("Питомец", id);

        _mapper.Map(request, pet);

        await _petRepository.UpdateAsync(pet);
        await _unitOfWork.SaveChangesAsync();

        return _mapper.Map<PetDto>(pet);
    }

    public async Task DeletePetAsync(Guid id, Guid clientId)
    {
        var pet = await _petRepository.GetByIdAndClientIdAsync(id, clientId);

        if (pet == null)
            throw new NotFoundException("Питомец", id);

        await DeletePetInternalAsync(pet);
    }

    public async Task DeletePetForAdminAsync(Guid id)
    {
        var pet = await _petRepository.GetByIdAsync(id);

        if (pet == null)
            throw new NotFoundException("Питомец", id);

        await DeletePetInternalAsync(pet);
    }

    private async Task DeletePetInternalAsync(Pet pet)
    {
        // Проверяем, нет ли активных бронирований
        var hasActiveBookings = await _petRepository.HasActiveBookingsAsync(pet.Id);

        if (hasActiveBookings)
            throw new BadRequestException("Невозможно удалить питомца с активными бронированиями");

        // Мягкое удаление
        pet.IsActive = false;
        await _petRepository.UpdateAsync(pet);
        await _unitOfWork.SaveChangesAsync();
    }
}
