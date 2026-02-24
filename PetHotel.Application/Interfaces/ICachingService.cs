namespace PetHotel.Application.Interfaces;

/// <summary>
/// Сервис кэширования для часто используемых данных.
/// </summary>
public interface ICachingService
{
    /// <summary>
    /// Получить значение из кэша.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    Task<T?> GetAsync<T>(string key) where T : class;

    /// <summary>
    /// Установить значение в кэш.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    Task SetAsync<T>(string key, T value, TimeSpan? expiration = null) where T : class;

    /// <summary>
    /// Удалить значение из кэша.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    Task RemoveAsync(string key);

    /// <summary>
    /// Удалить все значения с заданным префиксом.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    Task RemoveByPrefixAsync(string prefix);

    /// <summary>
    /// Проверить существование ключа в кэше.
    /// </summary>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    Task<bool> ExistsAsync(string key);
}
