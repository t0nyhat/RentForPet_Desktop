import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarDaysIcon, CurrencyDollarIcon, UserGroupIcon } from "@heroicons/react/24/outline";
import DateRangeCalendar from "../DateRangeCalendar";
import { useQueryApi } from "../../hooks/useQueryApi";
import { BookingSettings, BookingCalculationMode } from "../../types/booking";

type AuthFetch = (input: string | URL, init?: Record<string, unknown>) => Promise<Response>;

type AvailableRoom = {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  floor?: number | null;
  specialNotes?: string | null;
};

type RoomType = {
  id: string;
  name: string;
  pricePerNight: number;
  pricePerAdditionalPet: number;
};

type AdminAvailableRoomsProps = {
  authFetch: AuthFetch;
};

const toISO = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const toDisplay = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
};

const formatRangeLabel = (checkIn: string, checkOut: string) => {
  if (checkIn && checkOut) return `${toDisplay(checkIn)} — ${toDisplay(checkOut)}`;
  if (checkIn) return toDisplay(checkIn);
  return "";
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const AdminAvailableRooms = ({ authFetch }: AdminAvailableRoomsProps) => {
  const { t, i18n } = useTranslation();

  // Helper function to format currency
  const formatCurrency = (amount: number): string => {
    const currencySymbol = i18n.language.startsWith("en") ? "$" : "₽";
    return `${amount.toLocaleString(i18n.language === "en" ? "en-US" : "ru-RU")} ${currencySymbol}`;
  };

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  const tomorrow = useMemo(() => {
    const date = new Date(today);
    date.setDate(date.getDate() + 1);
    return date;
  }, [today]);

  const [checkInDate, setCheckInDate] = useState<string>(toISO(today));
  const [checkOutDate, setCheckOutDate] = useState<string>(toISO(tomorrow));
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => startOfMonth(today));
  const [numberOfPets, setNumberOfPets] = useState<number>(1);
  const [rooms, setRooms] = useState<AvailableRoom[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load room types for price calculation (use /all endpoint for admin to get all types including inactive)
  const { data: roomTypes = [], status: roomTypesStatus } = useQueryApi<RoomType[]>(
    ["room-types", "all"],
    "/api/room-types/all",
    { authorized: true }
  );

  // Load booking settings to determine calculation mode (Days vs Nights)
  const [bookingSettings, setBookingSettings] = useState<BookingSettings | null>(null);
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await authFetch("/api/admin/settings/booking");
        if (res.ok) {
          const settings = await res.json();
          setBookingSettings(settings);
        } else {
          console.error("Failed to fetch booking settings:", res.status);
        }
      } catch (error) {
        console.error("Error fetching booking settings:", error);
      }
    };
    fetchSettings();
  }, [authFetch]);

  // Update calendar month when dates change
  useEffect(() => {
    if (checkInDate) {
      const date = new Date(checkInDate);
      if (!isNaN(date.getTime())) {
        setCalendarMonth(startOfMonth(date));
      }
    }
  }, [checkInDate]);

  // Calculate number of units (days or nights) based on booking settings
  const numberOfUnits = useMemo(() => {
    if (!checkInDate || !checkOutDate) return 0;
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);
    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) return 0;

    const diffDays = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24);

    // If booking settings not loaded yet, default to Days mode
    if (!bookingSettings) {
      return Math.floor(diffDays) + 1;
    }

    if (bookingSettings.calculationMode === BookingCalculationMode.Days) {
      // Days mode: (checkOut - checkIn).Days + 1
      return Math.floor(diffDays) + 1;
    } else {
      // Nights mode: (checkOut - checkIn).Days
      return Math.floor(diffDays);
    }
  }, [checkInDate, checkOutDate, bookingSettings]);

  // Get unit name (day/days or night/nights) using i18n pluralization
  const getUnitName = (count: number) => {
    if (!bookingSettings) {
      return t("admin:common.daysPlural", { count });
    }

    if (bookingSettings.calculationMode === BookingCalculationMode.Days) {
      return t("admin:common.daysPlural", { count });
    } else {
      return t("admin:common.nightsPlural", { count });
    }
  };

  // Calculate price for a room type
  const calculatePrice = (roomTypeId: string, pets: number) => {
    if (numberOfUnits === 0) return 0;

    const roomType = roomTypes.find((rt: RoomType) => rt.id === roomTypeId);
    if (!roomType) {
      // If room type not found, return 0 (price will not be displayed)
      // This can happen if roomTypes are still loading or if there's a mismatch
      return 0;
    }

    const basePrice = roomType.pricePerNight * numberOfUnits;
    const additionalPetsCount = Math.max(0, pets - 1);
    const additionalPetsPrice =
      roomType.pricePerAdditionalPet * additionalPetsCount * numberOfUnits;
    return basePrice + additionalPetsPrice;
  };

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        roomTypeId: string;
        roomTypeName: string;
        rooms: AvailableRoom[];
      }
    >();

    rooms.forEach((room) => {
      const bucket = map.get(room.roomTypeId) ?? {
        roomTypeId: room.roomTypeId,
        roomTypeName: room.roomTypeName,
        rooms: [],
      };
      bucket.rooms.push(room);
      map.set(room.roomTypeId, bucket);
    });

    return Array.from(map.values()).sort((a, b) =>
      a.roomTypeName.localeCompare(b.roomTypeName, "ru-RU")
    );
  }, [rooms]);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      if (!checkInDate || !checkOutDate) {
        throw new Error(t("admin:availableRooms.datesValidation"));
      }

      const parsedCheckIn = new Date(checkInDate);
      const parsedCheckOut = new Date(checkOutDate);

      if (isNaN(parsedCheckIn.getTime()) || isNaN(parsedCheckOut.getTime())) {
        throw new Error(t("admin:availableRooms.invalidDates"));
      }

      if (parsedCheckOut <= parsedCheckIn) {
        throw new Error(t("admin:availableRooms.checkOutBeforeCheckIn"));
      }

      const params = new URLSearchParams();
      params.set("checkIn", parsedCheckIn.toISOString());
      params.set("checkOut", parsedCheckOut.toISOString());
      params.set("numberOfPets", numberOfPets.toString());

      const response = await authFetch(`/api/rooms/available-range?${params.toString()}`);
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error ?? t("admin:availableRooms.loadError"));
      }

      const data = (await response.json()) as AvailableRoom[];
      setRooms(data);
    } catch (err) {
      setRooms([]);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-25 via-white to-emerald-50 p-6 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="space-y-1">
          <h3 className="text-2xl font-bold text-slate-900">{t("admin:availableRooms.title")}</h3>
          <p className="text-sm text-slate-600">{t("admin:availableRooms.subtitle")}</p>
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
            <CalendarDaysIcon className="h-4 w-4 text-brand" />
            <span>{formatRangeLabel(checkInDate, checkOutDate)}</span>
            {numberOfUnits > 0 && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-slate-500">
                  {numberOfUnits} {getUnitName(numberOfUnits)}
                </span>
              </>
            )}
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">
              {numberOfPets} {t("admin:availableRooms.pet", { count: numberOfPets })}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-gradient-to-br from-slate-50 via-white to-brand/5 p-4">
        <label className="group relative flex flex-col gap-1.5">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <CalendarDaysIcon className="h-4 w-4 text-brand" />
            {t("admin:availableRooms.stayDates")}
          </span>
          <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-25 via-white to-emerald-50 p-2 shadow-sm">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-1.5 mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <CalendarDaysIcon className="h-4 w-4 text-emerald-600" />
                <span>{formatRangeLabel(checkInDate, checkOutDate)}</span>
              </div>
              <span className="text-[10px] text-slate-500">
                {t("admin:availableRooms.selectPeriod")}
              </span>
            </div>
            <DateRangeCalendar
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              checkInDate={checkInDate}
              checkOutDate={checkOutDate}
              busyDates={new Set()}
              minDate={today}
              blockBusyDates={false}
              onChange={({ checkInDate: newCheckIn, checkOutDate: newCheckOut }) => {
                setCheckInDate(newCheckIn);
                setCheckOutDate(newCheckOut || "");
              }}
              onInvalidRange={(message) => {
                if (message) {
                  setError(message);
                } else {
                  setError(null);
                }
              }}
            />
          </div>
        </label>

        {/* Number of pets */}
        <div className="mt-3 flex flex-col gap-2">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <UserGroupIcon className="h-4 w-4 text-brand" />
            {t("admin:availableRooms.numberOfPets")}
          </span>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setNumberOfPets(count)}
                className={`group relative flex-1 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all ${
                  numberOfPets === count
                    ? "border-emerald-500 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-md scale-105"
                    : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300/70 hover:bg-emerald-50 hover:scale-105 active:scale-95"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <UserGroupIcon
                    className={`h-4 w-4 ${
                      numberOfPets === count
                        ? "text-white"
                        : "text-slate-400 group-hover:text-emerald-600"
                    }`}
                  />
                  <span>{count}</span>
                </div>
                {numberOfPets === count && (
                  <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[10px] font-bold text-emerald-600 shadow-sm">
                    ✓
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Show button */}
        <div className="mt-3 flex items-center justify-center">
          {loading && (
            <span className="mr-3 flex items-center gap-2 text-xs font-semibold uppercase text-slate-400">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"></span>
              {t("admin:availableRooms.updating")}
            </span>
          )}
          <button
            type="button"
            onClick={load}
            className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
            disabled={loading}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <CalendarDaysIcon className="h-4 w-4" />
              {t("admin:availableRooms.showAvailable")}
            </span>
            <span className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 opacity-0 transition-opacity group-hover:opacity-100"></span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
      )}

      <div className="mt-6">
        {rooms.length === 0 && !loading ? (
          <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-gradient-to-br from-slate-50 to-white px-6 py-12 text-center">
            <CalendarDaysIcon className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-sm font-medium text-slate-500">
              {t("admin:availableRooms.noAvailable")}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {t("admin:availableRooms.tryDifferentPeriod")}
            </p>
          </div>
        ) : roomTypesStatus === "loading" ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center">
            <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-amber-600"></span>
            <p className="mt-4 text-sm font-medium text-slate-500">
              {t("admin:availableRooms.loadingRoomTypes")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => {
              const price = calculatePrice(group.roomTypeId, numberOfPets);
              const roomType = roomTypes.find((rt: RoomType) => rt.id === group.roomTypeId);
              return (
                <div
                  key={group.roomTypeId}
                  className="rounded-2xl border border-slate-100 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h4 className="text-lg font-bold text-slate-900">{group.roomTypeName}</h4>
                      {roomType && price > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 border border-emerald-200">
                            <CurrencyDollarIcon className="h-4 w-4 text-emerald-600" />
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-emerald-700 leading-tight">
                                {formatCurrency(price)}
                              </span>
                              <span className="text-[10px] text-emerald-600 leading-tight">
                                {formatCurrency(roomType.pricePerNight)}/
                                {bookingSettings?.calculationMode === BookingCalculationMode.Nights
                                  ? t("admin:availableRooms.perNight")
                                  : t("admin:availableRooms.perDay")}{" "}
                                · {numberOfUnits} {getUnitName(numberOfUnits)}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-slate-500">
                            ({t("admin:availableRooms.for")} {numberOfPets}{" "}
                            {t("admin:availableRooms.pet", { count: numberOfPets })})
                          </span>
                        </div>
                      )}
                      {!roomType && roomTypesStatus === "success" && (
                        <span className="text-xs text-slate-400 italic">
                          {t("admin:availableRooms.priceUnavailable")}
                        </span>
                      )}
                    </div>
                    <span className="rounded-full bg-gradient-to-r from-brand/10 to-brand/5 px-4 py-1.5 text-xs font-bold text-brand">
                      {group.rooms.length}{" "}
                      {t("admin:availableRooms.room", { count: group.rooms.length })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.rooms
                      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, "ru-RU"))
                      .map((room) => (
                        <div
                          key={room.id}
                          className="group relative rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm transition-all hover:border-brand hover:shadow-md hover:scale-105"
                          title={room.specialNotes ?? undefined}
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <span className="text-brand">№</span>
                            <span className="text-slate-900">{room.roomNumber}</span>
                            {room.floor != null && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="text-xs font-medium text-slate-500">
                                  {t("admin:availableRooms.floor", { floor: room.floor })}
                                </span>
                              </>
                            )}
                          </div>
                          {room.specialNotes && (
                            <div className="absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg group-hover:block z-10 max-w-xs">
                              {room.specialNotes}
                              <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

export default AdminAvailableRooms;
