import { useMemo } from "react";
import { AdminBooking } from "./AdminPendingBookings";
import { bookingStatusTheme, resolveBookingStatus } from "../../constants/bookingStatusTheme";
import { XMarkIcon } from "@heroicons/react/24/outline";
import useLocale from "../../hooks/useLocale";
import { useTranslation } from "react-i18next";

type BookingDayModalProps = {
  isOpen: boolean;
  date: Date | null;
  bookings: AdminBooking[];
  onClose: () => void;
  onBookingClick?: (booking: AdminBooking) => void;
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
    console.warn("[DayModal] parseDateKey: invalid date parts", {
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

const BookingDayModal = ({
  isOpen,
  date,
  bookings,
  onClose,
  onBookingClick,
}: BookingDayModalProps) => {
  const { locale } = useLocale();
  const { t } = useTranslation();

  const currency = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: locale === "en-US" ? "USD" : "RUB",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale]
  );

  // Determine event type for each booking
  const getBookingType = (booking: AdminBooking): "checkIn" | "checkOut" | "staying" => {
    if (!date) {
      return "staying";
    }
    const dayKey = toDateKey(date);

    let isCheckIn = false;
    let isCheckOut = false;

    // For composite bookings check segments
    if (booking.isComposite && booking.childBookings) {
      booking.childBookings.forEach((segment) => {
        const segCheckIn = parseDateKey(segment.checkInDate);
        const segCheckOut = parseDateKey(segment.checkOutDate);
        if (!segCheckIn || !segCheckOut) {
          return;
        }

        const segCheckInKey = toDateKey(segCheckIn);
        const segCheckOutKey = toDateKey(segCheckOut);

        if (dayKey === segCheckInKey) {
          isCheckIn = true;
        }
        if (dayKey === segCheckOutKey) {
          isCheckOut = true;
        }
      });
    } else {
      const checkIn = parseDateKey(booking.checkInDate);
      const checkOut = parseDateKey(booking.checkOutDate);
      if (!checkIn || !checkOut) {
        return "staying";
      }

      const checkInKey = toDateKey(checkIn);
      const checkOutKey = toDateKey(checkOut);

      if (dayKey === checkInKey) {
        isCheckIn = true;
      }
      if (dayKey === checkOutKey) {
        isCheckOut = true;
      }
    }

    const result = isCheckIn ? "checkIn" : isCheckOut ? "checkOut" : "staying";
    return result;
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      weekday: "long",
    });
  };

  const renderBookingCard = (booking: AdminBooking, type: "checkIn" | "checkOut" | "staying") => {
    const statusKey = resolveBookingStatus(booking.status);
    const statusTheme = bookingStatusTheme[statusKey];
    const statusClass =
      statusTheme?.scheduleClass ?? "bg-slate-200 border-slate-300 text-slate-600";

    const clientName = booking.client
      ? `${booking.client.lastName} ${booking.client.firstName}`
      : t("admin:dayModal.unknownClient");

    const roomLabel = booking.assignedRoom
      ? `№ ${booking.assignedRoom.roomNumber} (${booking.assignedRoom.roomTypeName})`
      : booking.roomTypeName
        ? `${booking.roomTypeName} (${t("admin:dayModal.notAssignedParens")})`
        : t("admin:dayModal.notAssigned");

    const checkInDate = parseDateKey(booking.checkInDate);
    const checkOutDate = parseDateKey(booking.checkOutDate);

    // For composite bookings collect pets from all segments
    const displayPets =
      booking.isComposite && booking.childBookings
        ? booking.childBookings
            .flatMap((seg) => seg.pets || [])
            .filter((pet, index, self) => self.findIndex((p) => p.id === pet.id) === index) // remove duplicates
        : booking.pets || [];

    const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
      // Stop propagation so click on card doesn't close modal via overlay
      e.stopPropagation();
      if (onBookingClick) {
        onBookingClick(booking);
      }
    };

    return (
      <div
        key={booking.id}
        onClick={handleCardClick}
        className={`group relative overflow-hidden rounded-lg border-2 ${statusClass} shadow-sm transition-all hover:shadow-md cursor-pointer w-full ${
          onBookingClick ? "hover:scale-[1.01]" : ""
        }`}
      >
        <div className="p-2">
          {/* Header with badges and price */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                <span
                  className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusTheme?.badgeClass ?? "bg-slate-200 text-slate-700"}`}
                >
                  {statusTheme?.label ?? booking.status}
                </span>
                {type === "checkIn" && (
                  <span className="rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {t("admin:dayModal.checkIn")}
                  </span>
                )}
                {type === "checkOut" && (
                  <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {t("admin:dayModal.checkOut")}
                  </span>
                )}
                {type === "staying" && (
                  <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {t("admin:dayModal.inHotel")}
                  </span>
                )}
              </div>
              <h4 className="text-sm font-bold text-slate-900 truncate">{clientName}</h4>
              {booking.client?.phone && (
                <p className="text-[10px] text-slate-600 mt-0.5">{booking.client.phone}</p>
              )}
            </div>
            <div className="text-right shrink-0 bg-white/60 rounded px-1.5 py-1 border border-slate-200">
              <p className="text-xs font-bold text-slate-900">
                {currency.format(booking.totalPrice)}
              </p>
              {booking.paidAmount > 0 && (
                <p className="text-[9px] text-slate-600">
                  {t("admin:dayModal.paid")} {currency.format(booking.paidAmount)}
                </p>
              )}
            </div>
          </div>

          {/* Pets list without photos */}
          {displayPets.length > 0 && (
            <div className="mb-2">
              <p className="text-[10px] font-semibold text-slate-700 mb-1.5 text-center">
                {t("admin:bookingDayModal.petsCount", { count: displayPets.length })}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {displayPets.map((pet) => (
                  <div
                    key={pet.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/90 px-2 py-1.5 border border-slate-200"
                  >
                    <span className="text-sm" aria-hidden="true">
                      🐾
                    </span>
                    <span className="text-[10px] font-semibold text-slate-900">{pet.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Room and period information */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
            <div className="bg-slate-50/50 rounded px-1.5 py-1">
              <p className="text-[9px] text-slate-500 mb-0.5 font-medium">
                {t("admin:bookingDayModal.room")}
              </p>
              <p className="text-xs font-bold text-slate-900">{roomLabel}</p>
            </div>
            <div className="bg-slate-50/50 rounded px-1.5 py-1">
              <p className="text-[9px] text-slate-500 mb-0.5 font-medium">
                {t("admin:bookingDayModal.period")}
              </p>
              <p className="text-xs font-bold text-slate-900">
                {checkInDate?.toLocaleDateString(locale, {
                  day: "2-digit",
                  month: "short",
                })}{" "}
                —{" "}
                {checkOutDate?.toLocaleDateString(locale, {
                  day: "2-digit",
                  month: "short",
                })}
              </p>
            </div>
          </div>

          {/* Composite booking */}
          {booking.isComposite && (
            <div className="mt-1.5 flex items-center justify-center">
              <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-bold text-white">
                {t("admin:bookingDayModal.composite")}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen || !date) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Close modal only if click was exactly on overlay, not on content
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    // Stop event propagation so click on content doesn't close modal
    e.stopPropagation();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-3 backdrop-blur-sm"
      onClick={handleOverlayClick}
    >
      <div
        className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl"
        onClick={handleContentClick}
      >
        <button
          type="button"
          className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          onClick={onClose}
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        <div className="pr-8 mb-4">
          <h3 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            {t("admin:bookingDayModal.bookingsOnDate", { date: formatDate(date) })}
          </h3>
          <p className="mt-0.5 text-xs text-slate-600">
            {t("admin:bookingDayModal.totalBookings")}{" "}
            <span className="font-semibold">{bookings.length}</span>
          </p>
        </div>

        {bookings.length === 0 ? (
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-6 py-12 text-center">
            <div className="text-4xl mb-2">📅</div>
            <p className="text-sm text-slate-600 font-medium">
              {t("admin:bookingDayModal.noBookings")}
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-3">
            {bookings.map((booking) => {
              const bookingType = getBookingType(booking);
              return (
                <div
                  key={booking.id}
                  className="w-full md:w-[calc(50%-0.375rem)] lg:w-[calc(33.333%-0.5rem)] max-w-sm"
                >
                  {renderBookingCard(booking, bookingType)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingDayModal;
