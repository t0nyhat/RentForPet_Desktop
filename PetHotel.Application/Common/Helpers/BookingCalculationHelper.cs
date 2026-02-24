using PetHotel.Domain.Entities;
using PetHotel.Domain.Enums;

namespace PetHotel.Application.Common.Helpers;

/// <summary>
/// Вспомогательный класс для расчета периодов бронирования
/// в зависимости от режима (дни/ночи).
/// </summary>
public static class BookingCalculationHelper
{
    /// <summary>
    /// Рассчитать количество единиц бронирования (дней или ночей)
    /// в зависимости от настроек системы.
    /// </summary>
    /// <param name="checkInDate">Дата заезда.</param>
    /// <param name="checkOutDate">Дата выезда.</param>
    /// <param name="settings">Настройки системы бронирования.</param>
    /// <returns>Количество единиц (дней или ночей).</returns>
    public static int CalculateUnits(DateTime checkInDate, DateTime checkOutDate, BookingSettings settings)
    {
        return settings.CalculationMode == BookingCalculationMode.Days
        ? CalculateDays(checkInDate, checkOutDate)
        : CalculateNights(checkInDate, checkOutDate);
    }

    /// <summary>
    /// Расчет по дням (текущий режим):
    /// Формула: (CheckOut - CheckIn).Days + 1
    /// Пример: 15.11 - 17.11 = 3 дня (15, 16, 17).
    /// </summary>
    /// <returns></returns>
    public static int CalculateDays(DateTime checkInDate, DateTime checkOutDate)
    {
        return (checkOutDate.Date - checkInDate.Date).Days + 1;
    }

    /// <summary>
    /// Расчет по ночам (режим гостиниц):
    /// Формула: (CheckOut - CheckIn).Days
    /// Пример: 15.11 - 17.11 = 2 ночи (ночь 15-16, ночь 16-17).
    /// </summary>
    /// <returns></returns>
    public static int CalculateNights(DateTime checkInDate, DateTime checkOutDate)
    {
        return (checkOutDate.Date - checkInDate.Date).Days;
    }

    /// <summary>
    /// Получить минимальный период бронирования в зависимости от режима.
    /// </summary>
    /// <returns></returns>
    public static int GetMinimumPeriod(BookingCalculationMode mode)
    {
        return mode == BookingCalculationMode.Days ? 2 : 1;
    }

    /// <summary>
    /// Проверить, что даты формируют последовательные сегменты
    /// с учетом режима расчета.
    /// </summary>
    /// <param name="previousCheckOut">Дата выезда из предыдущего сегмента.</param>
    /// <param name="currentCheckIn">Дата заезда в текущий сегмент.</param>
    /// <param name="mode">Режим расчета.</param>
    /// <returns>True, если сегменты последовательны.</returns>
    public static bool AreSegmentsSequential(DateTime previousCheckOut, DateTime currentCheckIn, BookingCalculationMode mode)
    {
        if (mode == BookingCalculationMode.Days)
        {
            // В режиме дней: следующий сегмент начинается на следующий день
            // Например: сегмент1 (15-17), сегмент2 должен начаться с 18
            return currentCheckIn.Date == previousCheckOut.Date.AddDays(1);
        }
        else
        {
            // В режиме ночей: следующий сегмент может начаться в тот же день
            // Например: сегмент1 (15-17), сегмент2 может начаться с 17
            return currentCheckIn.Date == previousCheckOut.Date ||
            currentCheckIn.Date == previousCheckOut.Date.AddDays(1);
        }
    }

    /// <summary>
    /// Проверить, пересекаются ли два периода бронирования
    /// с учетом режима расчета.
    /// </summary>
    /// <returns></returns>
    public static bool DoPeriodsOverlap(
    DateTime checkIn1, DateTime checkOut1,
    DateTime checkIn2, DateTime checkOut2,
    BookingCalculationMode mode)
    {
        if (mode == BookingCalculationMode.Days)
        {
            // В режиме дней: обе даты включительно заняты
            // Пересечение: checkIn1 <= checkOut2 && checkOut1 >= checkIn2
            return checkIn1.Date <= checkOut2.Date && checkOut1.Date >= checkIn2.Date;
        }
        else
        {
            // В режиме ночей: день выезда освобождается
            // Пересечение более строгое: checkIn1 < checkOut2 && checkOut1 > checkIn2
            return checkIn1.Date < checkOut2.Date && checkOut1.Date > checkIn2.Date;
        }
    }

    /// <summary>
    /// Получить текстовое название единицы измерения.
    /// </summary>
    /// <returns></returns>
    public static string GetUnitName(BookingCalculationMode mode, int count)
    {
        if (mode == BookingCalculationMode.Days)
        {
            return count == 1 ? "день" : count < 5 ? "дня" : "дней";
        }
        else
        {
            return count == 1 ? "ночь" : count < 5 ? "ночи" : "ночей";
        }
    }
}
