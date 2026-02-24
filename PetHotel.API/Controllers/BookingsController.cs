using System;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PetHotel.Application.DTOs.Bookings;
using PetHotel.Application.DTOs.Services;
using PetHotel.Application.DTOs.Payments;
using PetHotel.Application.Interfaces;
using PetHotel.Application.Services;
using PetHotel.Domain.Entities;
using PetHotel.Domain.Interfaces;
using PetHotel.API.Services;

namespace PetHotel.API.Controllers;

public class BookingsController : BaseApiController
{
    private readonly IBookingService _bookingService;
    private readonly BookingOptionsService _bookingOptionsService;
    private readonly IBookingRepository _bookingRepository;
    private readonly IClientRepository _clientRepository;
    private readonly IRepository<AdditionalService> _serviceRepository;
    private readonly IBookingServiceRepository _bookingServiceRepository;
    private readonly IUnitOfWork _unitOfWork;

    public BookingsController(
    IBookingService bookingService,
    BookingOptionsService bookingOptionsService,
    IBookingRepository bookingRepository,
    IClientRepository clientRepository,
    IRepository<AdditionalService> serviceRepository,
    IBookingServiceRepository bookingServiceRepository,
    IUnitOfWork unitOfWork)
    {
        _bookingService = bookingService;
        _bookingOptionsService = bookingOptionsService;
        _bookingRepository = bookingRepository;
        _clientRepository = clientRepository;
        _serviceRepository = serviceRepository;
        _bookingServiceRepository = bookingServiceRepository;
        _unitOfWork = unitOfWork;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<BookingDto>>> GetMyBookings()
    {
        var clientId = GetClientId();
        var bookings = await _bookingService.GetClientBookingsAsync(clientId);
        return Ok(bookings);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<BookingDto>> GetBooking(Guid id)
    {
        var clientId = GetClientId();
        var booking = await _bookingService.GetBookingByIdAsync(id, clientId);
        return Ok(booking);
    }

    /// <summary>
    /// Создает бронирование (простое или составное с переездами).
    /// </summary>
    /// <remarks>
    /// Простое бронирование (один номер на весь период):
    /// {"roomTypeId":"guid","checkInDate":"2024-01-01","checkOutDate":"2024-01-10","petIds":["guid1","guid2"]}
    ///
    /// Составное бронирование (с переездами между номерами):
    /// {"petIds":["guid1","guid2"],"segments":[{"roomTypeId":"guid1","checkInDate":"2024-01-01","checkOutDate":"2024-01-05"},{"roomTypeId":"guid2","checkInDate":"2024-01-05","checkOutDate":"2024-01-10"}]}.
    /// </remarks>
    /// <returns>A <see cref="Task"/> representing the asynchronous operation.</returns>
    [HttpPost]
    public async Task<ActionResult<BookingDto>> CreateBooking([FromBody] CreateBookingRequest request)
    {
        try
        {
            var clientId = GetClientId();
            var booking = await _bookingService.CreateBookingAsync(request, clientId);

            // Метрики
            BusinessMetrics.BookingsCreated.Inc();
            if (booking.TotalPrice > 0)
            {
                BusinessMetrics.BookingAmount.Observe((double)booking.TotalPrice);
            }
            if (booking.NumberOfNights > 0)
            {
                BusinessMetrics.BookingDuration.Observe(booking.NumberOfNights);
            }

            return CreatedAtAction(nameof(GetBooking), new { id = booking.Id }, booking);
        }
        catch (Exception ex)
        {
            // Логируем полную ошибку для диагностики
            return StatusCode(500, new { error = "Ошибка при создании бронирования", message = ex.Message, stackTrace = ex.StackTrace });
        }
    }

    [HttpPost("available")]
    public async Task<ActionResult<IEnumerable<RoomAvailabilityDto>>> GetAvailableRooms([FromBody] RoomAvailabilityRequest request)
    {
        var clientId = GetClientId();
        var availableRooms = await _bookingService.GetAvailableRoomsAsync(request, clientId);
        return Ok(availableRooms);
    }

    [HttpGet("{id}/receipt")]
    public async Task<ActionResult<ReceiptDto>> GetReceipt(Guid id)
    {
        var receipt = await _bookingService.GetReceiptAsync(id, GetClientId(), IsAdmin());
        return Ok(receipt);
    }

    [HttpPut("{id}/discount")]
    public async Task<ActionResult<BookingDto>> UpdateDiscount(Guid id, [FromBody] UpdateBookingDiscountRequest request)
    {
        var booking = await _bookingRepository.GetByIdAsync(id, includeDetails: true) ?? await _bookingRepository.GetByIdWithDetailsAsync(id);
        if (booking == null)
            return NotFound(new { error = "Бронирование не найдено" });

        booking.DiscountPercent = NormalizeDiscount(request.DiscountPercent);
        await RecalculateBookingPriceAsync(booking);
        await _unitOfWork.SaveChangesAsync();

        var updated = await _bookingService.GetBookingByIdAsync(id, booking.ClientId);
        return Ok(updated);
    }

    [HttpPost("options")]
    public async Task<ActionResult<BookingOptionsResponseDto>> GetBookingOptions([FromBody] BookingOptionsRequestDto request)
    {
        try
        {
            Guid? clientId = null;
            if (IsAdmin())
            {
                clientId = request.ClientId.HasValue && request.ClientId.Value != Guid.Empty
                ? request.ClientId
                : null;
            }
            else
            {
                try
                {
                    clientId = GetClientId();
                }
                catch (UnauthorizedAccessException ex)
                {
                    // Логируем ошибку для диагностики
                    return StatusCode(403, new { error = "Доступ запрещен", message = ex.Message });
                }
            }

            var discountPercent = clientId.HasValue ? await GetClientDiscountPercentAsync(clientId.Value) : 0m;
            var options = await _bookingOptionsService.FindBookingOptionsAsync(
            request.CheckInDate,
            request.CheckOutDate,
            request.NumberOfPets,
            discountPercent);
            return Ok(options);
        }
        catch (Exception ex)
        {
            // Логируем ошибку для диагностики
            return StatusCode(500, new { error = "Внутренняя ошибка сервера", message = ex.Message });
        }
    }

    [HttpPost("{id}/cancel")]
    public async Task<ActionResult> CancelBooking(Guid id)
    {
        var clientId = GetClientId();
        await _bookingService.CancelBookingAsync(id, clientId);

        // Метрики
        BusinessMetrics.BookingsCancelled.WithLabels("client").Inc();

        return NoContent();
    }

    [HttpGet("room/{roomId}/calendar")]
    public async Task<ActionResult<IEnumerable<RoomBookingCalendarDto>>> GetRoomCalendar(Guid roomId, [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var startDate = from?.Date ?? DateTime.Now.Date;
        var endDate = to?.Date ?? startDate.AddDays(60);

        var calendar = await _bookingService.GetRoomCalendarAsync(roomId, startDate, endDate);
        return Ok(calendar);
    }

    [HttpPost("{bookingId}/services")]
    public async Task<ActionResult<BookingServiceDto>> AddServiceToBooking(Guid bookingId, [FromBody] AddServiceToBookingRequest request)
    {
        try
        {
            // Проверяем, что бронирование существует
            var booking = await _bookingRepository.GetByIdAsync(bookingId);
            if (booking == null)
                return NotFound(new { error = "Бронирование не найдено" });

            // Запрещаем добавление услуг после выселения или отмены
            if (booking.Status == Domain.Enums.BookingStatus.CheckedOut)
                return BadRequest(new { error = "Нельзя добавлять услуги к завершенному бронированию" });

            if (booking.Status == Domain.Enums.BookingStatus.Cancelled)
                return BadRequest(new { error = "Нельзя добавлять услуги к отмененному бронированию" });

            // Проверяем доступ: администратор может управлять любыми бронированиями
            if (!IsAdmin())
            {
                var clientId = GetClientId();
                if (booking.ClientId != clientId)
                    return Forbid();
            }

            // Проверяем, что услуга существует
            var service = await _serviceRepository.GetByIdAsync(request.ServiceId);
            if (service == null || !service.IsActive)
                return NotFound(new { error = "Услуга не найдена" });

            // Создаем запись BookingService
            var bookingService = new Domain.Entities.BookingService
            {
                Id = Guid.NewGuid(),
                BookingId = bookingId,
                BookingPetId = request.BookingPetId,
                ServiceId = request.ServiceId,
                Quantity = request.Quantity,
                Price = service.Price * request.Quantity,
                Date = request.Date,
                Status = "Scheduled",
                CreatedAt = DateTime.Now
            };

            await _bookingServiceRepository.AddAsync(bookingService);
            await _unitOfWork.SaveChangesAsync();

            // Метрики
            BusinessMetrics.ServicesBooked.WithLabels(service.ServiceType.ToString()).Inc();
            if (bookingService.Price > 0)
            {
                BusinessMetrics.ServiceAmount.Observe((double)bookingService.Price);
            }

            // Пересчитываем стоимость бронирования после сохранения
            await RecalculateBookingPriceAsync(booking);
            await _unitOfWork.SaveChangesAsync();

            var dto = new BookingServiceDto
            {
                Id = bookingService.Id,
                BookingId = bookingService.BookingId,
                BookingPetId = bookingService.BookingPetId,
                ServiceId = bookingService.ServiceId,
                Quantity = bookingService.Quantity,
                Price = bookingService.Price,
                Date = bookingService.Date,
                Status = bookingService.Status,
                Service = new AdditionalServiceDto
                {
                    Id = service.Id,
                    Name = service.Name,
                    Description = service.Description,
                    Price = service.Price,
                    ServiceType = service.ServiceType,
                    Unit = service.Unit,
                    IsActive = service.IsActive,
                    CreatedAt = service.CreatedAt
                }
            };

            return Ok(dto);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpDelete("{bookingId}/services/{serviceId}")]
    public async Task<ActionResult> RemoveServiceFromBooking(Guid bookingId, Guid serviceId)
    {
        try
        {
            var booking = await _bookingRepository.GetByIdAsync(bookingId);
            if (booking == null)
                return NotFound(new { error = "Бронирование не найдено" });

            // Проверяем доступ: администратор может управлять любыми бронированиями
            if (!IsAdmin())
            {
                var clientId = GetClientId();
                if (booking.ClientId != clientId)
                    return Forbid();
            }

            var bookingService = await _bookingServiceRepository.GetByIdAsync(serviceId);
            if (bookingService == null || bookingService.BookingId != bookingId)
                return NotFound(new { error = "Услуга не найдена в бронировании" });

            await _bookingServiceRepository.DeleteAsync(serviceId);
            await _unitOfWork.SaveChangesAsync();

            // Пересчитываем стоимость бронирования после сохранения
            await RecalculateBookingPriceAsync(booking);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    private async Task RecalculateBookingPriceAsync(Booking booking)
    {
        // Получаем все услуги для бронирования
        var services = await _bookingServiceRepository.GetByBookingIdAsync(booking.Id);
        booking.ServicesPrice = services.Sum(s => s.Price);

        // Пересчитываем общую стоимость строго по сохранённому значению скидки бронирования.
        // Это позволяет явно установить скидку 0% из модалки и не подменять её автоматически
        // скидкой лояльности клиента.
        var discountPercent = NormalizeDiscount(booking.DiscountPercent);
        var subtotal = booking.BasePrice + booking.AdditionalPetsPrice + booking.ServicesPrice;
        var discounted = ApplyDiscount(subtotal, discountPercent);
        booking.DiscountPercent = discountPercent;
        booking.DiscountAmount = Math.Round(subtotal - discounted, 2);
        booking.TotalPrice = discounted;

        await _bookingRepository.UpdateAsync(booking);
    }

    private async Task<decimal> GetClientDiscountPercentAsync(Guid clientId)
    {
        var client = await _clientRepository.GetByIdAsync(clientId);
        return NormalizeDiscount(client?.LoyaltyDiscountPercent ?? 0);
    }

    private static decimal ApplyDiscount(decimal amount, decimal discountPercent)
    {
        if (amount <= 0)
            return 0;
        var normalized = NormalizeDiscount(discountPercent);
        if (normalized <= 0)
            return Math.Round(amount, 2);
        var discounted = amount * (1 - normalized / 100m);
        return Math.Round(discounted, 2);
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
