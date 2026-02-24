using PetHotel.Application.DTOs.Settings;

namespace PetHotel.Application.Interfaces;

/// <summary>
/// Сервис для управления настройками системы бронирования.
/// </summary>
public interface IBookingSettingsService
{
    /// <summary>
    /// Получить текущие настройки бронирования.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    Task<BookingSettingsDto> GetSettingsAsync();

    /// <summary>
    /// Обновить настройки бронирования
    /// Разрешено только при отсутствии активных бронирований.
    /// </summary>
    /// <param name="dto">Новые настройки.</param>
    /// <returns>Обновленные настройки.</returns>
    /// <exception cref="BadRequestException">Если существуют активные бронирования.</exception>
    Task<BookingSettingsDto> UpdateSettingsAsync(UpdateBookingSettingsDto dto);

    /// <summary>
    /// Проверить, можно ли изменить настройки (нет активных бронирований).
    /// </summary>
    /// <returns>True, если можно изменить настройки.</returns>
    Task<bool> CanChangeSettingsAsync();
}
