namespace PetHotel.Domain.Enums;

public enum PaymentMethod
{
    Card = 0, // Банковская карта
    Cash = 1, // Наличные
    Online = 2, // Онлайн оплата
    QrCode = 3, // QR код
    PhoneTransfer = 4 // Перевод по номеру телефона
}
