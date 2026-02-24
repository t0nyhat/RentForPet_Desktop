import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminBooking } from "./AdminPendingBookings";
import {
  bookingStatusTheme,
  resolveBookingStatus,
  type BookingStatusKey,
} from "../../constants/bookingStatusTheme";
import {
  ClockIcon,
  ShieldCheckIcon,
  BanknotesIcon,
  CheckCircleIcon,
  HomeModernIcon,
  ArrowRightOnRectangleIcon,
  XMarkIcon,
  ArrowPathRoundedSquareIcon,
} from "@heroicons/react/24/outline";

type BookingCalendarProps = {
  bookings: AdminBooking[];
  onDayClick: (date: Date, dayBookings: AdminBooking[]) => void;
};

const toDateKey = (date: Date) => {
  // Normalize date in UTC for correct comparison
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateKey = (value: string) => {
  if (!value) return null;
  // Extract only date from ISO string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss...)
  const datePart = value.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  if ([year, month, day].some((part) => Number.isNaN(part))) {
    console.warn("[Calendar] parseDateKey: invalid date parts", {
      value,
      datePart,
      year,
      month,
      day,
    });
    return null;
  }
  // Create date in UTC for correct comparison
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
};

const startOfDay = (date: Date) => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

// Function to get status icon
const getStatusIcon = (statusKey: BookingStatusKey) => {
  const iconClass = "h-3 w-3";
  switch (statusKey) {
    case "Pending":
      return <ClockIcon className={iconClass} />;
    case "WaitingForPaymentApproval":
      return <ShieldCheckIcon className={iconClass} />;
    case "AwaitingPayment":
      return <BanknotesIcon className={iconClass} />;
    case "PaymentPending":
      return <ClockIcon className={iconClass} />;
    case "Confirmed":
      return <CheckCircleIcon className={iconClass} />;
    case "CheckedIn":
      return <HomeModernIcon className={iconClass} />;
    case "CheckedOut":
      return <ArrowRightOnRectangleIcon className={iconClass} />;
    case "Cancelled":
      return <XMarkIcon className={iconClass} />;
    case "AwaitingRefund":
      return <ArrowPathRoundedSquareIcon className={iconClass} />;
    default:
      return <ClockIcon className={iconClass} />;
  }
};

const addMonths = (date: Date, count: number) => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + count);
  return newDate;
};

const BookingCalendar = ({ bookings, onDayClick }: BookingCalendarProps) => {
  const { t } = useTranslation(["admin"]);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Get localized month names and weekday names from translations
  const monthNames = t("admin:calendar.months", { returnObjects: true }) as string[];
  const weekDays = t("admin:calendar.weekDays", { returnObjects: true }) as string[];

  // Group bookings by days
  const bookingsByDay = useMemo(() => {
    const map = new Map<string, AdminBooking[]>();

    bookings.forEach((booking) => {
      // Skip cancelled bookings
      const statusKey = resolveBookingStatus(booking.status);
      if (statusKey === "Cancelled") {
        return;
      }

      // Skip composite booking segments - they will be shown via parent booking
      if (booking.parentBookingId) {
        return;
      }

      const checkInDate = parseDateKey(booking.checkInDate);
      const checkOutDate = parseDateKey(booking.checkOutDate);

      if (!checkInDate || !checkOutDate) {
        return;
      }

      // For composite bookings process each segment
      if (booking.isComposite && booking.childBookings) {
        booking.childBookings.forEach((segment) => {
          const segCheckIn = parseDateKey(segment.checkInDate);
          const segCheckOut = parseDateKey(segment.checkOutDate);
          if (!segCheckIn || !segCheckOut) {
            return;
          }

          // Add booking for each day of the period
          let current = new Date(segCheckIn);
          const end = new Date(segCheckOut);
          while (current <= end) {
            const dayKey = toDateKey(current);
            if (!map.has(dayKey)) {
              map.set(dayKey, []);
            }
            // Use parent booking for display
            map.get(dayKey)!.push(booking);
            // Move to next day in UTC
            current = new Date(current);
            current.setUTCDate(current.getUTCDate() + 1);
          }
        });
      } else {
        // For regular bookings
        let current = new Date(checkInDate);
        const end = new Date(checkOutDate);
        while (current <= end) {
          const dayKey = toDateKey(current);
          if (!map.has(dayKey)) {
            map.set(dayKey, []);
          }
          map.get(dayKey)!.push(booking);
          // Move to next day in UTC
          current = new Date(current);
          current.setUTCDate(current.getUTCDate() + 1);
        }
      }
    });

    return map;
  }, [bookings]);

  // Get bookings for a specific day
  const getDayBookings = (date: Date): AdminBooking[] => {
    const dayKey = toDateKey(date);
    const dayBookings = bookingsByDay.get(dayKey) || [];
    return dayBookings;
  };

  // Determine day type (check-in, check-out, staying)
  const getDayBookingTypes = (date: Date, dayBookings: AdminBooking[]) => {
    const dayKey = toDateKey(date);
    const types = {
      checkIn: false,
      checkOut: false,
      staying: false,
    };

    dayBookings.forEach((booking) => {
      // For composite bookings check segments
      if (booking.isComposite && booking.childBookings) {
        booking.childBookings.forEach((segment) => {
          const segCheckIn = parseDateKey(segment.checkInDate);
          const segCheckOut = parseDateKey(segment.checkOutDate);
          if (!segCheckIn || !segCheckOut) return;

          const segCheckInKey = toDateKey(segCheckIn);
          const segCheckOutKey = toDateKey(segCheckOut);

          if (dayKey === segCheckInKey) {
            types.checkIn = true;
          }
          if (dayKey === segCheckOutKey) {
            types.checkOut = true;
          }
          if (dayKey > segCheckInKey && dayKey < segCheckOutKey) {
            types.staying = true;
          }
        });
      } else {
        const checkIn = parseDateKey(booking.checkInDate);
        const checkOut = parseDateKey(booking.checkOutDate);
        if (!checkIn || !checkOut) return;

        const checkInKey = toDateKey(checkIn);
        const checkOutKey = toDateKey(checkOut);

        if (dayKey === checkInKey) {
          types.checkIn = true;
        }
        if (dayKey === checkOutKey) {
          types.checkOut = true;
        }
        if (dayKey > checkInKey && dayKey < checkOutKey) {
          types.staying = true;
        }
      }
    });

    return types;
  };

  const monthMetadata = useMemo(() => {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const monthDays = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0
    ).getDate();
    const startWeekDay = (firstDay.getDay() + 6) % 7; // Monday first
    const days: Array<Date | null> = [];

    for (let i = 0; i < startWeekDay; i++) {
      days.push(null);
    }
    for (let day = 1; day <= monthDays; day++) {
      // Create date in UTC for correct comparison
      const date = new Date(
        Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth(), day)
      );
      days.push(date);
    }
    return { days };
  }, [currentMonth]);

  const handleDayClick = (day: Date) => {
    const dayBookings = getDayBookings(day);
    onDayClick(day, dayBookings);
  };

  const changeMonth = (delta: number) => {
    setCurrentMonth(addMonths(currentMonth, delta));
  };

  const goToToday = () => {
    setCurrentMonth(new Date());
  };

  const renderDay = (day: Date | null, index: number) => {
    if (!day) {
      return <div key={`empty-${index}`} className="min-h-0" />;
    }

    const dayBookings = getDayBookings(day);
    const bookingTypes = getDayBookingTypes(day, dayBookings);
    const today = startOfDay(new Date());
    const isToday = startOfDay(day).getTime() === today.getTime();
    const isPast = day < today;

    // Determine highlight color based on booking types
    let bgColor = "bg-white";
    let borderColor = "border-slate-200";
    let textColor = "text-slate-700";

    if (dayBookings.length > 0) {
      if (bookingTypes.checkIn && bookingTypes.checkOut) {
        // Both check-in and check-out on same day
        bgColor = "bg-gradient-to-br from-blue-100 to-emerald-100";
        borderColor = "border-blue-400";
      } else if (bookingTypes.checkIn) {
        // Check-in
        bgColor = "bg-blue-50";
        borderColor = "border-blue-300";
      } else if (bookingTypes.checkOut) {
        // Check-out
        bgColor = "bg-emerald-50";
        borderColor = "border-emerald-300";
      } else if (bookingTypes.staying) {
        // Staying at hotel
        bgColor = "bg-amber-50";
        borderColor = "border-amber-300";
      }
    }

    if (isToday) {
      borderColor = "border-blue-600 border-2";
    }

    if (isPast) {
      textColor = "text-slate-400";
    }

    // Get pet and room info for all bookings
    const bookingInfo = dayBookings.map((booking) => {
      const roomNumber = booking.assignedRoom?.roomNumber || "—";
      const pets =
        booking.isComposite && booking.childBookings
          ? booking.childBookings.flatMap((seg) => seg.pets || [])
          : booking.pets || [];

      // Remove duplicate pets
      const uniquePets = pets.filter(
        (pet, index, self) => self.findIndex((p) => p.id === pet.id) === index
      );

      return {
        booking,
        roomNumber,
        pets: uniquePets,
      };
    });

    return (
      <button
        key={toDateKey(day)}
        type="button"
        onClick={() => handleDayClick(day)}
        className={`min-h-0 h-full w-full rounded-lg border-2 ${borderColor} ${bgColor} ${textColor} p-1 sm:p-1.5 text-left transition-shadow hover:shadow-md flex flex-col gap-0.5 overflow-hidden ${
          dayBookings.length > 0 ? "cursor-pointer" : ""
        }`}
      >
        <div className="flex items-center justify-between shrink-0">
          <span className={`text-[10px] sm:text-xs font-bold ${isToday ? "text-blue-600" : ""}`}>
            {day.getDate()}
          </span>
          {dayBookings.length > 0 && (
            <span className="rounded-full bg-blue-600 px-0.5 sm:px-1 py-0.5 text-[8px] sm:text-[9px] font-bold text-white">
              {dayBookings.length}
            </span>
          )}
        </div>

        {dayBookings.length > 0 ? (
          <div
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-0.5 pr-0.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-slate-400"
            onClick={(e) => {
              // Ensure click on scrollable area also opens modal
              e.stopPropagation();
              handleDayClick(day);
            }}
          >
            {bookingInfo.map((info, idx) => {
              const statusKey = resolveBookingStatus(info.booking.status);
              const statusTheme = bookingStatusTheme[statusKey];
              const statusLabel = statusTheme?.label || info.booking.status;
              const statusBadgeClass = statusTheme?.badgeClass || "bg-slate-100 text-slate-700";

              // Combine all pet names
              const petNames = info.pets.length > 0 ? info.pets.map((p) => p.name).join(", ") : "—";

              return (
                <div
                  key={idx}
                  className="flex items-center gap-0.5 sm:gap-1 text-[8px] sm:text-[9px] leading-tight px-0.5 sm:px-1 py-0.5 rounded border border-slate-200/50 bg-white/50 hover:bg-white/80 transition-colors"
                  title={`№${info.roomNumber} ${petNames} - ${statusLabel}`}
                  onClick={(e) => {
                    // Ensure click on booking item also opens modal
                    e.stopPropagation();
                    handleDayClick(day);
                  }}
                >
                  <span className="font-bold text-slate-900 shrink-0 hidden sm:inline">
                    №{info.roomNumber}
                  </span>
                  <span className="font-bold text-slate-900 shrink-0 sm:hidden">
                    {info.roomNumber}
                  </span>
                  {info.pets.length > 0 && (
                    <span className="text-slate-700 font-medium truncate min-w-0 flex-1">
                      {petNames}
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center justify-center shrink-0 rounded ${statusBadgeClass}`}
                    title={statusLabel}
                  >
                    {getStatusIcon(statusKey)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {dayBookings.length > 0 &&
          (() => {
            // Count number of each event type
            let checkInCount = 0;
            let checkOutCount = 0;
            let stayingCount = 0;

            const dayKey = toDateKey(day);

            dayBookings.forEach((booking) => {
              let isCheckIn = false;
              let isCheckOut = false;
              let isStaying = false;

              // For composite bookings check segments
              if (booking.isComposite && booking.childBookings) {
                booking.childBookings.forEach((segment) => {
                  const segCheckIn = parseDateKey(segment.checkInDate);
                  const segCheckOut = parseDateKey(segment.checkOutDate);
                  if (!segCheckIn || !segCheckOut) return;

                  const segCheckInKey = toDateKey(segCheckIn);
                  const segCheckOutKey = toDateKey(segCheckOut);

                  if (dayKey === segCheckInKey) {
                    isCheckIn = true;
                  }
                  if (dayKey === segCheckOutKey) {
                    isCheckOut = true;
                  }
                  if (dayKey > segCheckInKey && dayKey < segCheckOutKey) {
                    isStaying = true;
                  }
                });
              } else {
                const checkIn = parseDateKey(booking.checkInDate);
                const checkOut = parseDateKey(booking.checkOutDate);
                if (!checkIn || !checkOut) return;

                const checkInKey = toDateKey(checkIn);
                const checkOutKey = toDateKey(checkOut);

                if (dayKey === checkInKey) {
                  isCheckIn = true;
                }
                if (dayKey === checkOutKey) {
                  isCheckOut = true;
                }
                if (dayKey > checkInKey && dayKey < checkOutKey) {
                  isStaying = true;
                }
              }

              if (isCheckIn) checkInCount++;
              if (isCheckOut) checkOutCount++;
              if (isStaying && !isCheckIn && !isCheckOut) stayingCount++;
            });

            const stats = [];
            if (checkInCount > 0) {
              stats.push(
                <span
                  key="checkin"
                  className="text-[7px] sm:text-[8px] font-semibold text-blue-600"
                >
                  <span className="hidden sm:inline">{t("admin:calendar.checkInLabel")}</span>
                  <span className="sm:hidden">↓ </span>
                  {checkInCount}
                </span>
              );
            }
            if (stayingCount > 0) {
              stats.push(
                <span
                  key="staying"
                  className="text-[7px] sm:text-[8px] font-semibold text-amber-600"
                >
                  <span className="hidden sm:inline">{t("admin:calendar.stayLabel")}</span>
                  <span className="sm:hidden">● </span>
                  {stayingCount}
                </span>
              );
            }
            if (checkOutCount > 0) {
              stats.push(
                <span
                  key="checkout"
                  className="text-[7px] sm:text-[8px] font-semibold text-emerald-600"
                >
                  <span className="hidden sm:inline">{t("admin:calendar.checkOutLabel")}</span>
                  <span className="sm:hidden">↑ </span>
                  {checkOutCount}
                </span>
              );
            }

            return stats.length > 0 ? (
              <div
                className="flex flex-wrap gap-0.5 sm:gap-1 shrink-0 mt-auto items-center"
                onClick={(e) => {
                  // Ensure click on stats also opens modal
                  e.stopPropagation();
                  handleDayClick(day);
                }}
              >
                {stats}
              </div>
            ) : null;
          })()}
      </button>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header with navigation */}
      <div className="mb-2 sm:mb-4 flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="rounded-lg border border-slate-200 bg-white px-2 sm:px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-brand hover:bg-brand hover:text-white"
        >
          <svg
            className="h-3 w-3 sm:h-4 sm:w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div className="flex items-center gap-1.5 sm:gap-3">
          <h3 className="text-sm sm:text-lg font-bold text-slate-900">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
          <button
            type="button"
            onClick={goToToday}
            className="rounded-lg border border-brand bg-brand px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-white transition hover:bg-brand/90"
          >
            {t("admin:calendar.today")}
          </button>
        </div>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="rounded-lg border border-slate-200 bg-white px-2 sm:px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-brand hover:bg-brand hover:text-white"
        >
          <svg
            className="h-3 w-3 sm:h-4 sm:w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Week days header */}
      <div className="mb-1 sm:mb-2 grid grid-cols-7 gap-1 sm:gap-2 text-center text-[10px] sm:text-xs font-semibold uppercase text-slate-500 shrink-0">
        {weekDays.map((day) => (
          <div key={day} className="py-0.5 sm:py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 min-h-0 grid grid-cols-7 gap-1 sm:gap-2 auto-rows-fr">
        {monthMetadata.days.map((day, index) => renderDay(day, index))}
      </div>

      {/* Legend */}
      <div className="mt-2 sm:mt-4 flex flex-wrap items-center gap-2 sm:gap-4 rounded-lg border border-slate-100 bg-slate-50/50 p-2 sm:p-3 text-[10px] sm:text-xs shrink-0">
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded border-2 border-blue-600 bg-white shrink-0" />
          <span className="font-medium text-slate-700">{t("admin:calendar.today")}</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded bg-blue-50 border border-blue-300 shrink-0" />
          <span className="font-medium text-slate-700">{t("admin:calendar.checkIn")}</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded bg-emerald-50 border border-emerald-300 shrink-0" />
          <span className="font-medium text-slate-700">{t("admin:calendar.checkOut")}</span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded bg-amber-50 border border-amber-300 shrink-0" />
          <span className="font-medium text-slate-700 hidden sm:inline">
            {t("admin:calendar.inHotelFull")}
          </span>
          <span className="font-medium text-slate-700 sm:hidden">
            {t("admin:calendar.inHotelShort")}
          </span>
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <span className="h-2.5 w-2.5 sm:h-3 sm:w-3 rounded bg-gradient-to-br from-blue-100 to-emerald-100 border border-blue-400 shrink-0" />
          <span className="font-medium text-slate-700 hidden sm:inline">
            {t("admin:calendar.checkInAndOut")}
          </span>
          <span className="font-medium text-slate-700 sm:hidden">
            {t("admin:calendar.checkInAndOutShort")}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BookingCalendar;
