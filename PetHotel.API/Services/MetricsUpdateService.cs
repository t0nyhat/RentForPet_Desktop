using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using PetHotel.Domain.Interfaces;
using PetHotel.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace PetHotel.API.Services;

/// <summary>
/// Фоновый сервис для обновления gauge метрик (активные бронирования, пользователи и т.д.)
/// </summary>
public class MetricsUpdateService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<MetricsUpdateService> _logger;
    private readonly TimeSpan _updateInterval = TimeSpan.FromMinutes(5); // Обновляем каждые 5 минут

    public MetricsUpdateService(IServiceProvider serviceProvider, ILogger<MetricsUpdateService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await UpdateMetricsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating metrics");
            }

            await Task.Delay(_updateInterval, stoppingToken);
        }
    }

    private async Task UpdateMetricsAsync()
    {
        using var scope = _serviceProvider.CreateScope();
        var bookingRepository = scope.ServiceProvider.GetRequiredService<IBookingRepository>();
        var userRepository = scope.ServiceProvider.GetRequiredService<IUserRepository>();
        var petRepository = scope.ServiceProvider.GetRequiredService<IPetRepository>();

        try
        {
            // Обновляем количество активных бронирований
            var allBookings = await bookingRepository.GetAllAsync();
            var activeBookings = allBookings.Count(b =>
            b.Status == BookingStatus.Confirmed ||
            b.Status == BookingStatus.CheckedIn);
            BusinessMetrics.ActiveBookings.Set(activeBookings);

            // Обновляем общее количество питомцев
            var allPets = await petRepository.GetAllAsync();
            var totalPets = allPets.Count();
            BusinessMetrics.TotalPets.Set(totalPets);

            // Примечание: для активных пользователей нужна дополнительная логика
            // если есть поле LastLoginTime в User
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error calculating metrics");
        }
    }
}
