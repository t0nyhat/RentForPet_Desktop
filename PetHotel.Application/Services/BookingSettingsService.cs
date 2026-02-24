using AutoMapper;
using PetHotel.Application.Common.Exceptions;
using PetHotel.Application.DTOs.Settings;
using PetHotel.Application.Interfaces;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;
using PetHotel.Domain.Interfaces;

namespace PetHotel.Application.Services;

/// <summary>
/// Сервис для управления настройками системы бронирования.
/// </summary>
public class BookingSettingsService : IBookingSettingsService
{
    private readonly IBookingSettingsRepository _settingsRepository;
    private readonly IBookingRepository _bookingRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IMapper _mapper;

    private static readonly Guid SettingsSingletonId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    public BookingSettingsService(
    IBookingSettingsRepository settingsRepository,
    IBookingRepository bookingRepository,
    IUnitOfWork unitOfWork,
    IMapper mapper)
    {
        _settingsRepository = settingsRepository;
        _bookingRepository = bookingRepository;
        _unitOfWork = unitOfWork;
        _mapper = mapper;
    }

    public async Task<BookingSettingsDto> GetSettingsAsync()
    {
        var settings = await _settingsRepository.GetSingletonAsync();

        if (settings == null)
        {
            // Если настроек нет, создаем дефолтные
            settings = new BookingSettings
            {
                Id = SettingsSingletonId,
                CalculationMode = BookingCalculationMode.Days,
                CheckInTime = new TimeSpan(15, 0, 0),
                CheckOutTime = new TimeSpan(12, 0, 0),
                IsSingleton = true
            };

            await _settingsRepository.AddAsync(settings);
            await _unitOfWork.SaveChangesAsync();
        }

        return MapToDto(settings);
    }

    public async Task<BookingSettingsDto> UpdateSettingsAsync(UpdateBookingSettingsDto dto)
    {
        // Проверяем, можно ли изменить настройки
        if (!await CanChangeSettingsAsync())
        {
            throw new BadRequestException(
            "Невозможно изменить настройки, пока существуют активные бронирования. " +
            "Дождитесь завершения всех активных бронирований или отмените их.");
        }

        var settings = await _settingsRepository.GetSingletonAsync();

        if (settings == null)
        {
            settings = new BookingSettings
            {
                Id = SettingsSingletonId,
                IsSingleton = true
            };

            await _settingsRepository.AddAsync(settings);
        }

        // Парсим время (поддерживаем форматы HH:mm и HH:mm:ss)
        var checkInTime = ParseTimeSpan(dto.CheckInTime);
        var checkOutTime = ParseTimeSpan(dto.CheckOutTime);

        // Обновляем настройки
        settings.CalculationMode = dto.CalculationMode;
        settings.CheckInTime = checkInTime;
        settings.CheckOutTime = checkOutTime;

        await _unitOfWork.SaveChangesAsync();

        return MapToDto(settings);
    }

    public async Task<bool> CanChangeSettingsAsync()
    {
        // Проверяем, есть ли активные бронирования
        // Активные = все статусы кроме Cancelled и CheckedOut
        var hasActiveBookings = await _bookingRepository.HasActiveBookingsAsync();
        return !hasActiveBookings;
    }

    private static BookingSettingsDto MapToDto(BookingSettings settings)
    {
        return new BookingSettingsDto
        {
            Id = settings.Id,
            CalculationMode = settings.CalculationMode,
            CheckInTime = settings.CheckInTime.ToString(@"hh\:mm"),
            CheckOutTime = settings.CheckOutTime.ToString(@"hh\:mm")
        };
    }

    /// <summary>
    /// Парсит строку времени в TimeSpan (поддерживает форматы HH:mm и HH:mm:ss).
    /// </summary>
    private static TimeSpan ParseTimeSpan(string timeString)
    {
        if (string.IsNullOrWhiteSpace(timeString))
            throw new ArgumentException("Время не может быть пустым", nameof(timeString));

        // Если формат HH:mm, добавляем :00 для секунд
        if (timeString.Split(':').Length == 2)
        {
            timeString = $"{timeString}:00";
        }

        if (TimeSpan.TryParse(timeString, out var timeSpan))
        {
            return timeSpan;
        }

        throw new ArgumentException($"Неверный формат времени: {timeString}. Ожидается формат HH:mm или HH:mm:ss", nameof(timeString));
    }
}
