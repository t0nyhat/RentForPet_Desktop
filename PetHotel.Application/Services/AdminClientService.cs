using System;
using AutoMapper;
using PetHotel.Application.DTOs.Admin;
using PetHotel.Application.Common.Exceptions;
using PetHotel.Application.Interfaces;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using PetHotel.Domain.Interfaces;

namespace PetHotel.Application.Services;

public class AdminClientService : IAdminClientService
{
    private readonly IClientRepository _clientRepository;
    private readonly IUserRepository _userRepository;
    private readonly IPetRepository _petRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    public AdminClientService(
    IClientRepository clientRepository,
    IUserRepository userRepository,
    IPetRepository petRepository,
    IUnitOfWork unitOfWork,
    IMapper mapper)
    {
        _clientRepository = clientRepository;
        _userRepository = userRepository;
        _petRepository = petRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<IEnumerable<AdminClientDto>> GetClientsAsync()
    {
        var clients = await _clientRepository.GetAllWithDetailsAsync();
        return _mapper.Map<IEnumerable<AdminClientDto>>(clients);
    }

    public async Task<AdminClientDto> GetClientByIdAsync(Guid id)
    {
        var client = await _clientRepository.GetByIdAsync(id);
        if (client == null)
            throw new NotFoundException($"Клиент с id {id} не найден");

        return _mapper.Map<AdminClientDto>(client);
    }

    public async Task<AdminClientDto> CreateClientAsync(CreateClientRequest request)
    {
        var email = string.IsNullOrWhiteSpace(request.Email)
            ? $"client-{Guid.NewGuid():N}@no-login.local"
            : request.Email.Trim();

        // Проверяем дубликат только для введенного email
        if (!string.IsNullOrWhiteSpace(request.Email))
        {
            var existingUser = await _userRepository.GetByEmailAsync(email);
            if (existingUser != null)
                throw new BadRequestException($"Пользователь с email {email} уже существует");
        }

        // Всегда создаем только системного пользователя без доступа к входу
        var user = new User
        {
            Email = email,
            PasswordHash = string.Empty,
            Role = UserRole.Client,
            IsActive = false,
            EmailConfirmed = false
        };

        await _userRepository.AddAsync(user);

        var client = new Client
        {
            UserId = user.Id,
            FirstName = request.FirstName,
            LastName = request.LastName,
            Phone = request.Phone?.Trim() ?? string.Empty,
            Address = request.Address,
            EmergencyContact = request.EmergencyContact,
            InternalNotes = string.IsNullOrWhiteSpace(request.InternalNotes) ? null : request.InternalNotes,
            LoyaltyDiscountPercent = NormalizeDiscount(request.LoyaltyDiscountPercent)
        };

        await _clientRepository.AddAsync(client);
        await _unitOfWork.SaveChangesAsync();

        return _mapper.Map<AdminClientDto>(client);
    }

    public async Task<AdminClientDto> UpdateClientAsync(Guid id, UpdateClientRequest request)
    {
        var client = await _clientRepository.GetByIdAsync(id);
        if (client == null)
            throw new NotFoundException($"Клиент с id {id} не найден");

        client.FirstName = request.FirstName;
        client.LastName = request.LastName;
        client.Phone = request.Phone?.Trim() ?? string.Empty;
        client.Address = request.Address;
        client.EmergencyContact = request.EmergencyContact;
        client.InternalNotes = string.IsNullOrWhiteSpace(request.InternalNotes) ? null : request.InternalNotes;
        client.LoyaltyDiscountPercent = NormalizeDiscount(request.LoyaltyDiscountPercent);

        await _clientRepository.UpdateAsync(client);
        await _unitOfWork.SaveChangesAsync();

        return _mapper.Map<AdminClientDto>(client);
    }

    public async Task DeleteClientAsync(Guid id)
    {
        var client = await _clientRepository.GetByIdAsync(id);
        if (client == null)
            throw new NotFoundException($"Клиент с id {id} не найден");

        // Проверяем, есть ли активные бронирования
        // TODO: Добавить проверку активных бронирований когда будет доступен метод

        // Сначала удаляем связанного пользователя, чтобы освободить email
        var user = await _userRepository.GetByIdAsync(client.UserId);
        if (user != null)
        {
            await _userRepository.DeleteAsync(user.Id);
        }

        // Затем удаляем клиента
        await _clientRepository.DeleteAsync(client.Id);

        await _unitOfWork.SaveChangesAsync();
    }

    public async Task<AdminPetDto> CreatePetForClientAsync(Guid clientId, CreatePetForClientRequest request)
    {
        // Проверяем, существует ли клиент
        var client = await _clientRepository.GetByIdAsync(clientId);
        if (client == null)
            throw new NotFoundException($"Клиент с id {clientId} не найден");

        var pet = new Pet
        {
            ClientId = clientId,
            Name = request.Name,
            Species = request.Species,
            Breed = request.Breed,
            BirthDate = request.BirthDate,
            Gender = request.Gender,
            Weight = request.Weight,
            Color = request.Color,
            Microchip = request.Microchip,
            SpecialNeeds = request.SpecialNeeds,
            IsActive = true,
            InternalNotes = string.IsNullOrWhiteSpace(request.InternalNotes) ? null : request.InternalNotes
        };

        await _petRepository.AddAsync(pet);
        await _unitOfWork.SaveChangesAsync();

        await _unitOfWork.SaveChangesAsync();

        return _mapper.Map<AdminPetDto>(pet);
    }

    public async Task<AdminPetDto> UpdatePetForClientAsync(Guid clientId, Guid petId, UpdatePetForClientRequest request)
    {
        var pet = await _petRepository.GetByIdAsync(petId);
        if (pet == null || pet.ClientId != clientId)
            throw new NotFoundException($"Питомец с id {petId} у клиента {clientId} не найден");

        pet.Name = request.Name;
        pet.Species = request.Species;
        pet.Breed = request.Breed;
        pet.BirthDate = request.BirthDate;
        pet.Gender = request.Gender;
        pet.Weight = request.Weight;
        pet.Color = request.Color;
        pet.Microchip = request.Microchip;
        pet.SpecialNeeds = request.SpecialNeeds;
        pet.InternalNotes = string.IsNullOrWhiteSpace(request.InternalNotes) ? null : request.InternalNotes;

        await _petRepository.UpdateAsync(pet);
        await _unitOfWork.SaveChangesAsync();

        return _mapper.Map<AdminPetDto>(pet);
    }

    public async Task UpdateClientNotesAsync(Guid id, string? notes)
    {
        var client = await _clientRepository.GetByIdAsync(id);
        if (client == null)
            throw new NotFoundException($"Клиент с id {id} не найден");

        client.InternalNotes = string.IsNullOrWhiteSpace(notes) ? null : notes;
        await _clientRepository.UpdateAsync(client);
        await _unitOfWork.SaveChangesAsync();
    }

    public async Task UpdatePetNotesAsync(Guid clientId, Guid petId, string? notes)
    {
        var pet = await _petRepository.GetByIdAsync(petId);
        if (pet == null || pet.ClientId != clientId)
            throw new NotFoundException($"Питомец с id {petId} у клиента {clientId} не найден");

        pet.InternalNotes = string.IsNullOrWhiteSpace(notes) ? null : notes;
        await _petRepository.UpdateAsync(pet);
        await _unitOfWork.SaveChangesAsync();
    }

    private static decimal NormalizeDiscount(decimal value)
    {
        if (value < 0)
            return 0;
        if (value > 100)
            return 100;
        return Math.Round(value, 2);
    }
}
