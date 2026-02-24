using PetHotel.Application.DTOs.Payments;
using PetHotel.Application.DTOs.Pets;
using PetHotel.Application.DTOs.Rooms;
using PetHotel.Application.DTOs.RoomTypes;
using PetHotel.Application.DTOs.Services;
using PetHotel.Domain.Enums;

namespace PetHotel.Application.DTOs.Bookings;

public class BookingDto
{
    public Guid Id { get; set; }
    public Guid ClientId { get; set; }
    public Guid RoomTypeId { get; set; }
    public Guid? AssignedRoomId { get; set; }
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
    public int NumberOfNights { get; set; } // вычисляемое
    public int NumberOfPets { get; set; }
    public BookingStatus Status { get; set; }
    public decimal BasePrice { get; set; }
    public decimal AdditionalPetsPrice { get; set; }
    public decimal ServicesPrice { get; set; }
    public decimal TotalPrice { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal LoyaltyDiscountPercent { get; set; }
    public decimal DiscountAmount { get; set; }
    public decimal PaidAmount { get; set; } // Сумма оплаченных платежей
    public decimal RemainingAmount { get; set; } // Оставшаяся сумма к оплате
    public string? SpecialRequests { get; set; }
    public DateTime CreatedAt { get; set; }
    public bool PaymentApproved { get; set; }
    public decimal RequiredPrepaymentAmount { get; set; }
    public bool PrepaymentCancelled { get; set; }

    // Отслеживание раннего выезда
    public bool IsEarlyCheckout { get; set; } // Был ли выезд раньше запланированного
    public DateTime? OriginalCheckOutDate { get; set; } // Изначальная дата выезда (до изменения)

    // Зачисление остатка в доход
    public bool OverpaymentConvertedToRevenue { get; set; } // Был ли остаток зачислен в доход
    public decimal? RevenueConversionAmount { get; set; } // Сумма, зачисленная в доход
    public string? RevenueConversionComment { get; set; } // Комментарий о зачислении в доход

    // Составные бронирования
    public bool IsComposite { get; set; }
    public Guid? ParentBookingId { get; set; }
    public int? SegmentOrder { get; set; }
    public List<BookingDto> ChildBookings { get; set; } = new(); // Сегменты для составного бронирования

    // Navigation
    public RoomTypeDto? RoomType { get; set; }
    public string? RoomTypeName { get; set; } // Для удобства на фронтенде
    public RoomDto? AssignedRoom { get; set; } // Назначенный номер (может быть null)
    public BookingClientDto? Client { get; set; }
    public List<PetDto> Pets { get; set; } = new();
    public List<BookingServiceDto> Services { get; set; } = new();
    public List<PaymentDto> Payments { get; set; } = new();
}
