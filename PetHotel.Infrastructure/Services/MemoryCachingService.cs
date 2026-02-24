using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using PetHotel.Application.Interfaces;

namespace PetHotel.Infrastructure.Services;

/// <summary>
/// Реализация кэширования на основе In-Memory кэша.
/// </summary>
public class MemoryCachingService : ICachingService
{
    private readonly IMemoryCache _memoryCache;
    private readonly ILogger<MemoryCachingService> _logger;
    private readonly ConcurrentDictionary<string, byte> _keyRegistry;
    private const int DefaultExpirationMinutes = 30;

    public MemoryCachingService(IMemoryCache memoryCache, ILogger<MemoryCachingService> logger)
    {
        _memoryCache = memoryCache;
        _logger = logger;
        _keyRegistry = new ConcurrentDictionary<string, byte>();
    }

    public Task<T?> GetAsync<T>(string key) where T : class
    {
        try
        {
            if (_memoryCache.TryGetValue(key, out T? value))
            {
                _logger.LogDebug("Cache HIT for key: {Key}", key);
                return Task.FromResult(value);
            }

            _logger.LogDebug("Cache MISS for key: {Key}", key);
            return Task.FromResult<T?>(null);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting cached value for key {Key}", key);
            return Task.FromResult<T?>(null);
        }
    }

    public Task SetAsync<T>(string key, T value, TimeSpan? expiration = null) where T : class
    {
        try
        {
            var cacheExpiration = expiration ?? TimeSpan.FromMinutes(DefaultExpirationMinutes);

            var cacheEntryOptions = new MemoryCacheEntryOptions
            {
                AbsoluteExpirationRelativeToNow = cacheExpiration,
                SlidingExpiration = TimeSpan.FromMinutes(cacheExpiration.TotalMinutes / 2),
                Priority = CacheItemPriority.Normal
            };

            cacheEntryOptions.RegisterPostEvictionCallback((k, v, r, s) =>
            {
                _keyRegistry.TryRemove(k.ToString()!, out _);
                _logger.LogDebug("Cache entry evicted: {Key}, Reason: {Reason}", k, r);
            });

            _memoryCache.Set(key, value, cacheEntryOptions);
            _keyRegistry.TryAdd(key, 0);

            _logger.LogDebug("Cache SET for key: {Key}, Expiration: {Expiration}", key, cacheExpiration);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error setting cached value for key {Key}", key);
        }

        return Task.CompletedTask;
    }

    public Task RemoveAsync(string key)
    {
        try
        {
            _memoryCache.Remove(key);
            _keyRegistry.TryRemove(key, out _);
            _logger.LogDebug("Cache REMOVE for key: {Key}", key);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing cached value for key {Key}", key);
        }

        return Task.CompletedTask;
    }

    public Task RemoveByPrefixAsync(string prefix)
    {
        try
        {
            var keysToRemove = _keyRegistry.Keys.Where(k => k.StartsWith(prefix)).ToList();

            foreach (var key in keysToRemove)
            {
                _memoryCache.Remove(key);
                _keyRegistry.TryRemove(key, out _);
            }

            _logger.LogDebug("Cache REMOVE by prefix: {Prefix}, Removed {Count} keys", prefix, keysToRemove.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error removing cached values by prefix {Prefix}", prefix);
        }

        return Task.CompletedTask;
    }

    public Task<bool> ExistsAsync(string key)
    {
        try
        {
            var exists = _memoryCache.TryGetValue(key, out _);
            return Task.FromResult(exists);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error checking existence of key {Key}", key);
            return Task.FromResult(false);
        }
    }
}
