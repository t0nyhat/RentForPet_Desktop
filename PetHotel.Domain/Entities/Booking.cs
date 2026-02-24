using PetHotel.Domain.Common;
using PetHotel.Domain.Enums;

namespace PetHotel.Domain.Entities;

public class Booking : BaseEntity
{
    public Guid ClientId { get; set; }
    public Guid RoomTypeId { get; set; } // Тип номера, выбранный клиентом
    public Guid? AssignedRoomId { get; set; } // Назначенный конкретный номер (заполняется админом)
    public DateTime CheckInDate { get; set; }
    public DateTime CheckOutDate { get; set; }
    public int NumberOfPets { get; set; }
    public BookingStatus Status { get; set; }
    public decimal BasePrice { get; set; }
    public decimal AdditionalPetsPrice { get; set; }
    public decimal ServicesPrice { get; set; }
    public decimal TotalPrice { get; set; }
    public decimal DiscountPercent { get; set; }
    public decimal DiscountAmount { get; set; }
    public string? SpecialRequests { get; set; }
    public bool PaymentApproved { get; set; } = false; // Разрешена ли оплата администратором
    public decimal RequiredPrepaymentAmount { get; set; } // Требуемая сумма предоплаты
    public bool PrepaymentCancelled { get; set; } = false; // Отменена ли предоплата администратором

    // Отслеживание раннего выезда
    public bool IsEarlyCheckout { get; set; } = false; // Был ли выезд раньше запланированного
    public DateTime? OriginalCheckOutDate { get; set; } // Изначальная дата выезда (до изменения при раннем выезде)

    // Зачисление остатка в доход
    public bool OverpaymentConvertedToRevenue { get; set; } = false; // Был ли остаток зачислен в доход
    public decimal? RevenueConversionAmount { get; set; } // Сумма, зачисленная в доход
    public string? RevenueConversionComment { get; set; } // Комментарий о зачислении в доход

    // Составные бронирования (с переездами между номерами)
    public Guid? ParentBookingId { get; set; } // Ссылка на родительское бронирование для сегментов
    public bool IsComposite { get; set; } // Является ли это составным бронированием (родительским)
    public int? SegmentOrder { get; set; } // Порядковый номер сегмента (для дочерних бронирований)

    // Navigation properties
    public Client Client { get; set; } = null!;
    public RoomType RoomType { get; set; } = null!;
    public Room? AssignedRoom { get; set; } // Может быть null до назначения
    public Booking? ParentBooking { get; set; } // Родительское бронирование
    public ICollection<Booking> ChildBookings { get; set; } = new List<Booking>(); // Дочерние бронирования (сегменты)
    public ICollection<BookingPet> BookingPets { get; set; } = new List<BookingPet>();
    public ICollection<BookingService> BookingServices { get; set; } = new List<BookingService>();
    public ICollection<Payment> Payments { get; set; } = new List<Payment>();
}
