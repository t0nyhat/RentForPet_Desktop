using Prometheus;

namespace PetHotel.API.Services;

/// <summary>
/// Бизнес-метрики для мониторинга PetHotel.
/// </summary>
public static class BusinessMetrics
{
    // Метрики бронирований
    public static readonly Counter BookingsCreated = Metrics
    .CreateCounter("pethotel_bookings_created_total",
    "Total number of bookings created");

    public static readonly Counter BookingsCancelled = Metrics
    .CreateCounter("pethotel_bookings_cancelled_total",
    "Total number of bookings cancelled",
    new CounterConfiguration { LabelNames = new[] { "reason" } });

    public static readonly Counter BookingsConfirmed = Metrics
    .CreateCounter("pethotel_bookings_confirmed_total",
    "Total number of bookings confirmed");

    public static readonly Counter BookingsCheckedIn = Metrics
    .CreateCounter("pethotel_bookings_checked_in_total",
    "Total number of bookings checked in");

    public static readonly Counter BookingsCheckedOut = Metrics
    .CreateCounter("pethotel_bookings_checked_out_total",
    "Total number of bookings checked out");

    public static readonly Gauge ActiveBookings = Metrics
    .CreateGauge("pethotel_active_bookings",
    "Number of active bookings (confirmed, checked in)");

    public static readonly Histogram BookingDuration = Metrics
    .CreateHistogram("pethotel_booking_duration_days",
    "Duration of bookings in days",
    new HistogramConfiguration
    {
        Buckets = new[] { 1.0, 3.0, 7.0, 14.0, 30.0, 60.0, 90.0 }
    });

    public static readonly Histogram BookingAmount = Metrics
    .CreateHistogram("pethotel_booking_amount",
    "Booking total amount",
    new HistogramConfiguration
    {
        Buckets = new[] { 100.0, 500.0, 1000.0, 2500.0, 5000.0, 10000.0, 25000.0, 50000.0 }
    });

    // Метрики пользователей
    public static readonly Counter UsersRegistered = Metrics
    .CreateCounter("pethotel_users_registered_total",
    "Total number of registered users");

    public static readonly Counter UsersLoggedIn = Metrics
    .CreateCounter("pethotel_users_logged_in_total",
    "Total number of user logins");

    public static readonly Counter UsersLoginFailed = Metrics
    .CreateCounter("pethotel_users_login_failed_total",
    "Total number of failed login attempts",
    new CounterConfiguration { LabelNames = new[] { "reason" } });

    public static readonly Gauge ActiveUsers = Metrics
    .CreateGauge("pethotel_active_users",
    "Number of active users (logged in within last hour)");

    // Метрики безопасности
    public static readonly Counter UnauthorizedRequests = Metrics
    .CreateCounter("pethotel_security_unauthorized_total",
    "Total unauthorized requests",
    new CounterConfiguration { LabelNames = new[] { "endpoint", "method" } });

    public static readonly Counter ForbiddenRequests = Metrics
    .CreateCounter("pethotel_security_forbidden_total",
    "Total forbidden requests",
    new CounterConfiguration { LabelNames = new[] { "endpoint", "method" } });

    public static readonly Counter RateLimitExceeded = Metrics
    .CreateCounter("pethotel_security_rate_limit_exceeded_total",
    "Total rate limit exceeded requests",
    new CounterConfiguration { LabelNames = new[] { "endpoint", "client_ip" } });

    // Метрики питомцев
    public static readonly Counter PetsRegistered = Metrics
    .CreateCounter("pethotel_pets_registered_total",
    "Total number of pets registered");

    public static readonly Gauge TotalPets = Metrics
    .CreateGauge("pethotel_total_pets",
    "Total number of pets in the system");

    // Метрики услуг
    public static readonly Counter ServicesBooked = Metrics
    .CreateCounter("pethotel_services_booked_total",
    "Total number of services booked",
    new CounterConfiguration { LabelNames = new[] { "service_type" } });

    public static readonly Histogram ServiceAmount = Metrics
    .CreateHistogram("pethotel_service_amount",
    "Service booking amount",
    new HistogramConfiguration
    {
        Buckets = new[] { 50.0, 100.0, 250.0, 500.0, 1000.0, 2500.0, 5000.0 }
    });
}
