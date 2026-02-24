namespace PetHotel.Domain.Enums;

public enum BookingStatus
{
    Pending = 0, // Ожидает подтверждения администратором
    WaitingForPaymentApproval = 1, // Ожидает разрешения на оплату от администратора
    AwaitingPayment = 2, // Ожидает оплату от клиента
    PaymentPending = 3, // Оплата на проверке у администратора
    Confirmed = 4, // Подтверждено (оплата подтверждена)
    CheckedIn = 5, // Питомец заселен
    CheckedOut = 6, // Питомец выселен
    Cancelled = 7 // Отменено
}
