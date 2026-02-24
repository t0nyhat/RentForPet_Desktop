import React, { useEffect, useMemo, useRef, useState, useCallback, memo } from "react";
import { useTranslation } from "react-i18next";
import DateInput from "../DateInput";
import { useAuth } from "../../context/AuthContext";
import { getCurrentZoomFactor } from "../../context/ZoomContext";
import {
  bookingStatusTheme,
  resolveBookingStatus,
  getBookingStatusLabel,
} from "../../constants/bookingStatusTheme";
import { AdminBooking } from "./AdminPendingBookings";
import ManualCompositeBookingModal from "./ManualCompositeBookingModal";
import { lazy, Suspense } from "react";
import useLocale from "../../hooks/useLocale";

const UnifiedBookingModal = lazy(() => import("../UnifiedBookingModal"));
import AlertModal from "../AlertModal";
import { BookingSettings, BookingCalculationMode } from "../../types/booking";
import BookingCalendar from "./BookingCalendar";
import BookingDayModal from "./BookingDayModal";

type Room = {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  roomTypeName: string;
  floor?: number | null;
  specialNotes?: string | null;
  isActive: boolean;
};

type DateRange = {
  from: Date;
  to: Date;
};

type AdminScheduleProps = {
  rooms: Room[];
  bookings: AdminBooking[];
  allBookings?: AdminBooking[]; // All bookings for calendar
  range: DateRange;
  loading: boolean;
  onRangeChange: (range: DateRange) => void;
  onRefresh: () => void;
  onConfirmBooking?: (bookingId: string) => Promise<void>;
  onCancelBooking?: (bookingId: string) => Promise<void>;
  onCheckInBooking?: (bookingId: string) => Promise<void>;
  onCheckOutBooking?: (bookingId: string) => Promise<void>;
  onUpdateDates?: (bookingId: string, checkInDate: string, checkOutDate: string) => Promise<void>;
  onAssignRoom?: (bookingId: string, roomId: string) => Promise<void>;
  onUpdateRoomAndDates?: (
    bookingId: string,
    roomId: string,
    checkInDate: string,
    checkOutDate: string
  ) => Promise<void>;
};

const MS_IN_DAY = 1000 * 60 * 60 * 24;

// Sizes for different display modes
const SCALE_PRESETS = {
  compact: {
    dayWidth: 50,
    dayWidthMobile: 40,
    rowHeight: 40,
    rowHeightMobile: 36,
    groupHeaderHeight: 32,
    groupHeaderHeightMobile: 28,
    headerHeight: 36,
    headerHeightMobile: 32,
    containerMaxHeight: 420,
    fontSize: "text-[7px]",
    dateFont: "text-[8px]",
    dateFontMobile: "text-[7px]",
    roomFont: "text-[11px]",
    roomFontMobile: "text-[10px]",
    iconSize: "h-2.5 w-2.5",
    iconSizeMobile: "h-2 w-2",
    barPadding: "px-1 py-0.5",
    barGap: "gap-0.5",
    columnWidth: 100,
    columnWidthMobile: 80,
  },
  normal: {
    dayWidth: 80,
    dayWidthMobile: 60,
    rowHeight: 64,
    rowHeightMobile: 52,
    groupHeaderHeight: 44,
    groupHeaderHeightMobile: 36,
    headerHeight: 48,
    headerHeightMobile: 40,
    containerMaxHeight: 580,
    fontSize: "text-[9px]",
    dateFont: "text-[11px]",
    dateFontMobile: "text-[9px]",
    roomFont: "text-sm",
    roomFontMobile: "text-xs",
    iconSize: "h-3.5 w-3.5",
    iconSizeMobile: "h-3 w-3",
    barPadding: "px-1.5 py-0.5",
    barGap: "gap-0.5",
    columnWidth: 180,
    columnWidthMobile: 100,
  },
  comfortable: {
    dayWidth: 90,
    dayWidthMobile: 70,
    rowHeight: 72,
    rowHeightMobile: 60,
    groupHeaderHeight: 48,
    groupHeaderHeightMobile: 40,
    headerHeight: 52,
    headerHeightMobile: 44,
    containerMaxHeight: 620,
    fontSize: "text-[10px]",
    dateFont: "text-xs",
    dateFontMobile: "text-[10px]",
    roomFont: "text-[15px]",
    roomFontMobile: "text-sm",
    iconSize: "h-4 w-4",
    iconSizeMobile: "h-3.5 w-3.5",
    barPadding: "px-2 py-1",
    barPaddingMobile: "px-1.5 py-0.5",
    barGap: "gap-1",
    columnWidth: 180,
    columnWidthMobile: 110,
  },
} as const;

type ScaleMode = keyof typeof SCALE_PRESETS;

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const toDateInputValue = (date: Date) => date.toISOString().split("T")[0];

const parseIsoDay = (value: string | Date) => {
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = value.getUTCMonth();
    const day = value.getUTCDate();
    const date = new Date(Date.UTC(year, month, day));
    const dayNumber = Math.floor(date.getTime() / MS_IN_DAY);
    return { dayNumber, date };
  }

  const [datePart = ""] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const y = year ?? 1970;
  const m = (month ?? 1) - 1;
  const d = day ?? 1;
  const date = new Date(Date.UTC(y, m, d));
  const dayNumber = Math.floor(date.getTime() / MS_IN_DAY);
  return { dayNumber, date };
};

const normalizeRange = (range: DateRange) => {
  const fromInfo = parseIsoDay(range.from);
  const toInfo = parseIsoDay(range.to);
  const from = fromInfo.date;
  const to = toInfo.dayNumber <= fromInfo.dayNumber ? addDays(from, 6) : toInfo.date;
  return { from, to };
};

const parseDateInput = (value: string) => parseIsoDay(value).date;

const fromDayNumber = (dayNumber: number) => new Date(dayNumber * MS_IN_DAY);

// Memoized component for individual booking bar
// Re-renders only when its own props change
type BookingBarProps = {
  booking: AdminBooking;
  parentBooking?: AdminBooking;
  leftOffset: number;
  barWidth: number;
  rowHeight: number;
  scale: (typeof SCALE_PRESETS)[keyof typeof SCALE_PRESETS];
  currency: Intl.NumberFormat;
  hoveredCompositeBookingId: string | null;
  selectedBookingIds: string[];
  isDragging: boolean;
  isSuccessfullyUpdated: boolean;
  scaleMode: ScaleMode;
  onBookingClick: (booking: AdminBooking) => void;
  onMouseDown: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  createMode: boolean;
  mergeMode: boolean;
  locale: string;
  clientLabel: string;
  compositeBookingTitle: string;
  paidLabel: string;
};

const BookingBar = memo<BookingBarProps>(
  ({
    booking,
    parentBooking,
    leftOffset,
    barWidth,
    rowHeight,
    scale,
    currency,
    hoveredCompositeBookingId,
    selectedBookingIds,
    isDragging,
    isSuccessfullyUpdated,
    scaleMode,
    onBookingClick,
    onMouseDown,
    onMouseEnter,
    onMouseLeave,
    createMode,
    mergeMode,
    locale,
    clientLabel,
    compositeBookingTitle,
    paidLabel,
  }) => {
    const checkInInfo = parseIsoDay(booking.checkInDate);
    const checkOutInfo = parseIsoDay(booking.checkOutDate);
    const displayBooking = parentBooking || booking;
    const statusKey = resolveBookingStatus(displayBooking.status);
    const statusTheme = bookingStatusTheme[statusKey];
    const statusClass =
      statusTheme?.scheduleClass ?? "bg-slate-200 border-slate-300 text-slate-600";
    const statusLabel = getBookingStatusLabel(statusKey);
    const clientName = displayBooking.client
      ? `${displayBooking.client.firstName} ${displayBooking.client.lastName}`
      : clientLabel;

    const compositeParentId = parentBooking
      ? parentBooking.id
      : booking.isComposite
        ? booking.id
        : null;
    const isHighlighted = compositeParentId && hoveredCompositeBookingId === compositeParentId;

    // Calculate payment progress
    const totalPrice = parentBooking ? parentBooking.totalPrice : booking.totalPrice;
    const paidAmount = parentBooking ? parentBooking.paidAmount : booking.paidAmount;
    const paymentProgress = totalPrice > 0 ? Math.min((paidAmount / totalPrice) * 100, 100) : 0;
    const isFullyPaid = paymentProgress >= 100;
    const isPartiallyPaid = paymentProgress > 0 && paymentProgress < 100;

    return (
      <button
        type="button"
        onClick={() => onBookingClick(parentBooking || booking)}
        onMouseDown={onMouseDown}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{
          position: "absolute",
          left: `${leftOffset + 2}px`,
          top: "4px",
          width: `${barWidth - 4}px`,
          height: `${rowHeight - 8}px`,
          opacity: isDragging ? 0.3 : 1,
          cursor: isDragging
            ? "grabbing"
            : createMode || mergeMode
              ? "pointer"
              : booking.isComposite
                ? "pointer"
                : "grab",
        }}
        className={`pointer-events-auto flex flex-col justify-start ${scale.barGap} rounded-lg border ${scale.barPadding} pb-2.5 text-left text-xs shadow-sm transition-all hover:z-20 hover:shadow-md focus:outline-none focus:ring-1 focus:ring-brand overflow-hidden relative ${statusClass} ${booking.isComposite ? "ring-2 ring-amber-400 ring-offset-1" : ""} ${isHighlighted ? "ring-4 ring-amber-500 shadow-lg scale-[1.02] z-30" : ""} ${selectedBookingIds.includes(booking.id) ? "ring-4 ring-blue-500 shadow-lg z-30" : ""} ${isSuccessfullyUpdated ? "ring-2 ring-green-500" : ""}`}
      >
        {/* Green checkmark for successful update */}
        {isSuccessfullyUpdated && (
          <div className="absolute -top-1 -right-1 z-50 flex items-center justify-center rounded-full bg-green-500 p-0.5 shadow-lg animate-in fade-in zoom-in duration-200">
            <svg
              className="h-3 w-3 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        )}
        <div className="flex items-center justify-between gap-1 min-h-0">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className={`font-semibold truncate ${scale.fontSize} leading-tight`}>
              {clientName}
            </span>
            {booking.isComposite && (
              <span
                className={`shrink-0 rounded bg-amber-500 px-0.5 py-0 ${scale.fontSize} font-bold text-white leading-none`}
                title={compositeBookingTitle}
              >
                {scaleMode === "compact" ? "↔" : "🔄"}
              </span>
            )}
          </div>
          <span
            className={`rounded bg-white/60 px-1 py-0 ${scale.fontSize} font-bold uppercase tracking-wider text-slate-600 shrink-0`}
          >
            {statusLabel}
          </span>
        </div>
        <div
          className={`flex items-center justify-between gap-1 ${scale.fontSize} text-slate-600 leading-tight min-h-0`}
        >
          <span className="truncate">
            {checkInInfo.date.toLocaleDateString(locale, {
              day: "2-digit",
              month: "short",
            })}{" "}
            —{" "}
            {checkOutInfo.date.toLocaleDateString(locale, {
              day: "2-digit",
              month: "short",
            })}
          </span>
          <span
            className={`rounded bg-white/70 px-1 py-0 ${scale.fontSize} font-bold text-slate-700 whitespace-nowrap shrink-0`}
          >
            {currency.format(parentBooking ? parentBooking.totalPrice : booking.totalPrice)}
          </span>
        </div>
        {displayBooking.pets && displayBooking.pets.length > 0 && (
          <div
            className={`flex flex-wrap gap-0.5 ${scale.fontSize} text-slate-500 leading-tight min-h-0`}
          >
            {displayBooking.pets?.slice(0, 3).map((pet) => (
              <span
                key={pet.id}
                className="rounded bg-white/60 px-1 py-0 font-medium text-slate-600"
              >
                {pet.name}
              </span>
            ))}
            {displayBooking.pets.length > 3 && (
              <span className="text-slate-400">+{displayBooking.pets.length - 3}</span>
            )}
          </div>
        )}

        {/* Payment progress bar */}
        {paymentProgress > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10 overflow-hidden rounded-b-lg">
            <div
              className={`h-full transition-all ${isFullyPaid ? "bg-emerald-500" : isPartiallyPaid ? "bg-amber-500" : "bg-slate-400"
                }`}
              style={{ width: `${paymentProgress}%` }}
              title={`${paidLabel}: ${currency.format(paidAmount)} / ${currency.format(totalPrice)} (${Math.round(paymentProgress)}%)`}
            />
          </div>
        )}
      </button>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for optimization
    // Returns true if props have NOT changed (component should NOT re-render)
    return (
      prevProps.booking.id === nextProps.booking.id &&
      prevProps.booking.checkInDate === nextProps.booking.checkInDate &&
      prevProps.booking.checkOutDate === nextProps.booking.checkOutDate &&
      prevProps.booking.status === nextProps.booking.status &&
      prevProps.booking.totalPrice === nextProps.booking.totalPrice &&
      prevProps.booking.paidAmount === nextProps.booking.paidAmount &&
      prevProps.leftOffset === nextProps.leftOffset &&
      prevProps.barWidth === nextProps.barWidth &&
      prevProps.isDragging === nextProps.isDragging &&
      prevProps.isSuccessfullyUpdated === nextProps.isSuccessfullyUpdated &&
      prevProps.hoveredCompositeBookingId === nextProps.hoveredCompositeBookingId &&
      prevProps.selectedBookingIds === nextProps.selectedBookingIds &&
      prevProps.scaleMode === nextProps.scaleMode &&
      prevProps.createMode === nextProps.createMode &&
      prevProps.mergeMode === nextProps.mergeMode &&
      prevProps.locale === nextProps.locale &&
      prevProps.paidLabel === nextProps.paidLabel
    );
  }
);

BookingBar.displayName = "BookingBar";

const AdminSchedule = ({
  rooms,
  bookings,
  allBookings,
  range,
  loading,
  onRangeChange,
  onRefresh,
  onConfirmBooking,
  onCancelBooking,
  onCheckInBooking,
  onCheckOutBooking,
  onUpdateDates,
  onAssignRoom,
  onUpdateRoomAndDates,
}: AdminScheduleProps) => {
  const { t } = useTranslation(["admin", "common"]);
  const { locale } = useLocale();
  const { authFetch } = useAuth();

  // Helper function to get unit name (day/days or night/nights)
  const getUnitName = useCallback(
    (units: number, isNightsMode: boolean): string => {
      if (isNightsMode) {
        return t("admin:common.nightsPlural", { count: units });
      } else {
        return t("admin:common.daysPlural", { count: units });
      }
    },
    [t]
  );

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

  // Booking settings (Days vs Nights mode)
  const [bookingSettings, setBookingSettings] = useState<BookingSettings | null>(null);

  // Counter for forcing re-render after operations (merge, etc.)
  const [refreshCounter, forceUpdate] = useState(0);

  // Create bookings "signature" for tracking changes
  // Include loading to recalculate after loading completes
  const bookingsSignature = useMemo(() => {
    const sig = bookings
      .map((b) => `${b.id}:${b.status}:${b.parentBookingId || ""}:${b.isComposite}`)
      .sort()
      .join("|");
    return `${sig}:loading=${loading}`;
  }, [bookings, loading]);

  // Previous bookings signature
  const prevBookingsSignatureRef = useRef(bookingsSignature);

  // Update counter when bookings signature changes
  useEffect(() => {
    if (bookingsSignature !== prevBookingsSignatureRef.current) {
      prevBookingsSignatureRef.current = bookingsSignature;
      forceUpdate((n) => n + 1);
    }
  }, [bookingsSignature]);

  // Fetch booking settings on mount
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
      } catch (err) {
        console.error("Error fetching booking settings:", err);
      }
    };
    fetchSettings();
  }, [authFetch]);

  // Removed optimistic updates - waiting for server confirmation before rendering

  const normalizedRange = useMemo(() => normalizeRange(range), [range]);
  const rangeDayNumbers = useMemo(() => {
    const startInfo = parseIsoDay(normalizedRange.from);
    const endInfo = parseIsoDay(normalizedRange.to);
    const startDay = startInfo.dayNumber;
    const endDay = endInfo.dayNumber;
    const count = Math.max(1, endDay - startDay + 1);
    return { startDay, endDay, count };
  }, [normalizedRange]);

  const days = useMemo(
    () =>
      Array.from({ length: rangeDayNumbers.count }, (_, index) =>
        fromDayNumber(rangeDayNumbers.startDay + index)
      ),
    [rangeDayNumbers]
  );

  const roomsWithBookings = useMemo(() => {
    const known = new Map<string, Room>();
    // First add all rooms from props
    rooms.forEach((room) => known.set(room.id, room));

    // Then add rooms from bookings if not already in list
    bookings.forEach((booking) => {
      if (booking.assignedRoom && !known.has(booking.assignedRoom.id)) {
        known.set(booking.assignedRoom.id, {
          id: booking.assignedRoom.id,
          roomNumber: booking.assignedRoom.roomNumber,
          roomTypeId: booking.assignedRoom.roomTypeId,
          roomTypeName: booking.assignedRoom.roomTypeName,
          floor: booking.assignedRoom.floor,
          specialNotes: booking.assignedRoom.specialNotes,
          isActive: booking.assignedRoom.isActive,
        });
      }
    });

    return Array.from(known.values()).sort((a, b) =>
      a.roomNumber.localeCompare(b.roomNumber, "ru-RU")
    );
  }, [rooms, bookings]);

  // Group rooms by type
  const roomsByType = useMemo(() => {
    const groups = new Map<string, Room[]>();
    roomsWithBookings.forEach((room) => {
      if (!groups.has(room.roomTypeName)) {
        groups.set(room.roomTypeName, []);
      }
      groups.get(room.roomTypeName)!.push(room);
    });
    // Sort groups by type name
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], "ru-RU"));
  }, [roomsWithBookings]);

  // State for tracking expanded/collapsed groups (all expanded by default)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (roomType: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(roomType)) {
        next.delete(roomType);
      } else {
        next.add(roomType);
      }
      return next;
    });
  };

  // Optimistic update: store temporary booking changes
  const [optimisticUpdates, setOptimisticUpdates] = useState<
    Map<string, { roomId?: string; checkInDate?: string; checkOutDate?: string }>
  >(new Map());

  // State for tracking successful updates (to show green checkmark)
  const [successfulUpdates, setSuccessfulUpdates] = useState<Set<string>>(new Set());

  // Function to apply optimistic updates to a booking
  const applyOptimisticUpdate = useMemo(() => {
    return (booking: AdminBooking): AdminBooking => {
      const update = optimisticUpdates.get(booking.id);
      if (!update) return booking;

      return {
        ...booking,
        assignedRoomId: update.roomId ?? booking.assignedRoomId,
        checkInDate: update.checkInDate ?? booking.checkInDate,
        checkOutDate: update.checkOutDate ?? booking.checkOutDate,
      };
    };
  }, [optimisticUpdates]);

  const bookingsByRoom = useMemo(() => {
    const map = new Map<string, AdminBooking[]>();

    bookings.forEach((booking) => {
      // Apply optimistic updates
      const updatedBooking = applyOptimisticUpdate(booking);

      // Skip segments - they will be shown via childBookings of parent booking
      if (updatedBooking.parentBookingId) {
        return;
      }

      // For simple bookings - show as is
      if (!updatedBooking.isComposite) {
        const roomId = updatedBooking.assignedRoomId;
        if (roomId) {
          if (!map.has(roomId)) {
            map.set(roomId, []);
          }
          map.get(roomId)!.push(updatedBooking);
        }
      } else {
        // For composite bookings - show each segment on corresponding room
        if (updatedBooking.childBookings && updatedBooking.childBookings.length > 0) {
          updatedBooking.childBookings.forEach((segment) => {
            // Apply optimistic updates to segment
            const updatedSegment = applyOptimisticUpdate(segment);
            const roomId = updatedSegment.assignedRoomId;
            if (roomId) {
              if (!map.has(roomId)) {
                map.set(roomId, []);
              }
              // Create virtual booking for segment with parent info
              const segmentWithParent = {
                ...updatedSegment,
                // Store reference to parent booking for display
                parentBooking: updatedBooking,
                isComposite: true, // Mark as part of composite booking
              };
              map.get(roomId)!.push(segmentWithParent);
            }
          });
        }
      }
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, applyOptimisticUpdate, bookingsSignature]);

  // Sync vertical scroll of left fixed column and right scrollable content
  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScroll = useRef(false);
  const [viewMode, setViewMode] = useState<"gantt" | "calendar">("gantt");

  useEffect(() => {
    const right = rightScrollRef.current;
    const left = leftScrollRef.current;

    // Re-attach scroll syncing only when the Gantt view is mounted
    if (viewMode !== "gantt" || !right || !left) {
      return undefined;
    }

    const onRightScroll = () => {
      if (isSyncingScroll.current) return;
      isSyncingScroll.current = true;
      left.scrollTop = right.scrollTop;
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    };

    const onLeftScroll = () => {
      if (isSyncingScroll.current) return;
      isSyncingScroll.current = true;
      right.scrollTop = left.scrollTop;
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    };

    right.addEventListener("scroll", onRightScroll, { passive: true });
    left.addEventListener("scroll", onLeftScroll, { passive: true });

    return () => {
      right.removeEventListener("scroll", onRightScroll);
      left.removeEventListener("scroll", onLeftScroll);
    };
  }, [viewMode]);

  const shiftRange = (daysShift: number) => {
    onRangeChange({
      from: addDays(normalizedRange.from, daysShift),
      to: addDays(normalizedRange.to, daysShift),
    });
  };

  const handleInputChange = (key: keyof DateRange, value: string) => {
    const date = parseDateInput(value);
    if (Number.isNaN(date.getTime())) return;
    const nextRange = { ...normalizedRange, [key]: date };
    onRangeChange(normalizeRange(nextRange));
  };

  const [scaleMode, setScaleMode] = useState<ScaleMode>("normal");
  const scale = SCALE_PRESETS[scaleMode];

  // Responsive sizes based on screen size
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth < 640
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const DAY_WIDTH =
    isMobile && "dayWidthMobile" in scale
      ? (scale as (typeof SCALE_PRESETS)[ScaleMode]).dayWidthMobile
      : scale.dayWidth;
  const ROW_HEIGHT =
    isMobile && "rowHeightMobile" in scale
      ? (scale as (typeof SCALE_PRESETS)[ScaleMode]).rowHeightMobile
      : scale.rowHeight;
  const GROUP_HEADER_HEIGHT =
    isMobile && "groupHeaderHeightMobile" in scale
      ? (scale as (typeof SCALE_PRESETS)[ScaleMode]).groupHeaderHeightMobile
      : scale.groupHeaderHeight;
  const HEADER_HEIGHT =
    isMobile && "headerHeightMobile" in scale
      ? (scale as (typeof SCALE_PRESETS)[ScaleMode]).headerHeightMobile
      : scale.headerHeight;
  const COLUMN_WIDTH = isMobile ? scale.columnWidthMobile : scale.columnWidth;

  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [hoveredCompositeBookingId, setHoveredCompositeBookingId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedDayBookings, setSelectedDayBookings] = useState<AdminBooking[]>([]);
  const statusKey = selectedBooking ? resolveBookingStatus(selectedBooking.status) : null;
  void statusKey;

  // Manual Booking Modes
  const [createMode, setCreateMode] = useState(false);
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [selectedSegments, setSelectedSegments] = useState<
    Array<{
      roomId: string;
      roomNumber: string;
      roomTypeId: string;
      roomTypeName: string;
      from: Date;
      to: Date;
      price: number;
    }>
  >([]);
  const [pendingSelection, setPendingSelection] = useState<{
    roomId: string;
    roomNumber: string;
    roomTypeId: string;
    roomTypeName: string;
    date: Date;
  } | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);

  // Alert modal state
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    message: string;
    type?: "info" | "success" | "warning" | "error";
  }>({
    isOpen: false,
    message: "",
    type: "info",
  });

  // Drag & Drop state
  const [draggedBooking, setDraggedBooking] = useState<{
    booking: AdminBooking;
    roomId: string;
    startX: number;
    startY: number;
    originalLeft: number;
    originalTop: number;
    originalRoomIndex: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const dragContainerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const lastDragEndTimeRef = useRef(0);

  // Horizontal/vertical mouse scroll (background dragging + inertia)
  const panScrollStartRef = useRef<{
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  // Two last frames for velocity calculation (prev → last)
  const panMoveHistoryRef = useRef<
    | [
      prev: { scrollLeft: number; scrollTop: number; t: number },
      last: { scrollLeft: number; scrollTop: number; t: number },
    ]
    | null
  >(null);
  const inertiaRafRef = useRef<number | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const focusDateRequestRef = useRef<Date | null>(null);
  const FRICTION = 0.92;
  const MIN_VELOCITY = 0.3;

  useEffect(() => {
    if (viewMode !== "gantt") return;
    const right = rightScrollRef.current;
    const onMove = (e: MouseEvent) => {
      const start = panScrollStartRef.current;
      if (!start || !right) return;
      const dx = start.x - e.clientX;
      const dy = start.y - e.clientY;
      right.scrollLeft = start.scrollLeft + dx;
      right.scrollTop = start.scrollTop + dy;
      const now = Date.now();
      const point = { scrollLeft: right.scrollLeft, scrollTop: right.scrollTop, t: now };
      const hist = panMoveHistoryRef.current;
      if (!hist) {
        panMoveHistoryRef.current = [point, point];
      } else {
        panMoveHistoryRef.current = [hist[1], point];
      }
    };
    const onUp = () => {
      panScrollStartRef.current = null;
      setIsPanning(false);

      if (!rightScrollRef.current) return;
      const hist = panMoveHistoryRef.current;
      panMoveHistoryRef.current = null;

      let vx = 0;
      let vy = 0;
      if (hist) {
        const [prev, last] = hist;
        const dt = last.t - prev.t;
        if (dt > 0) {
          vx = (last.scrollLeft - prev.scrollLeft) / dt;
          vy = (last.scrollTop - prev.scrollTop) / dt;
          const boost = 1.2;
          vx *= boost;
          vy *= boost;
        }
      }

      let lastT = performance.now();
      const tick = (now: number) => {
        if (!rightScrollRef.current) return;
        const r = rightScrollRef.current;
        const dt = Math.min(now - lastT, 50);
        lastT = now;
        const maxLeft = r.scrollWidth - r.clientWidth;
        const maxTop = r.scrollHeight - r.clientHeight;

        r.scrollLeft = Math.max(0, Math.min(maxLeft, r.scrollLeft + vx * dt));
        r.scrollTop = Math.max(0, Math.min(maxTop, r.scrollTop + vy * dt));

        vx *= FRICTION;
        vy *= FRICTION;

        const stop = Math.abs(vx) < MIN_VELOCITY && Math.abs(vy) < MIN_VELOCITY;
        if (stop) return;
        inertiaRafRef.current = requestAnimationFrame(tick);
      };

      if (inertiaRafRef.current !== null) {
        cancelAnimationFrame(inertiaRafRef.current);
      }
      inertiaRafRef.current = requestAnimationFrame(tick);
    };
    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseup", onUp);
    document.addEventListener("mouseleave", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("mouseleave", onUp);
      if (inertiaRafRef.current !== null) {
        cancelAnimationFrame(inertiaRafRef.current);
        inertiaRafRef.current = null;
      }
    };
  }, [viewMode]);

  // Reset pan state when range changes to avoid stale drag state after quick actions
  useEffect(() => {
    panScrollStartRef.current = null;
    panMoveHistoryRef.current = null;
    setIsPanning(false);
    if (inertiaRafRef.current !== null) {
      cancelAnimationFrame(inertiaRafRef.current);
      inertiaRafRef.current = null;
    }
  }, [normalizedRange.from, normalizedRange.to]);

  // Apply requested horizontal focus after range update (used by "Today" button)
  useEffect(() => {
    const targetDate = focusDateRequestRef.current;
    const container = rightScrollRef.current;
    if (!targetDate || !container) return;

    const targetInfo = parseIsoDay(targetDate);
    const index = targetInfo.dayNumber - rangeDayNumbers.startDay;
    if (index < 0 || index >= rangeDayNumbers.count) {
      focusDateRequestRef.current = null;
      return;
    }

    const targetLeft = index * DAY_WIDTH;
    container.scrollLeft = Math.max(0, targetLeft - DAY_WIDTH * 2);
    focusDateRequestRef.current = null;
  }, [
    normalizedRange.from,
    normalizedRange.to,
    rangeDayNumbers.startDay,
    rangeDayNumbers.count,
    DAY_WIDTH,
  ]);

  const handleGanttPaneMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest?.("button")) return;
    const el = rightScrollRef.current;
    if (!el) return;
    panScrollStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
    setIsPanning(true);
    e.preventDefault();
  }, []);

  const handleCellClick = (room: Room, date: Date) => {
    if (!createMode) return;

    if (pendingSelection) {
      if (pendingSelection.roomId === room.id) {
        // Complete selection
        const from = pendingSelection.date < date ? pendingSelection.date : date;
        const to = pendingSelection.date < date ? date : pendingSelection.date;

        setSelectedSegments([
          ...selectedSegments,
          {
            roomId: room.id,
            roomNumber: room.roomNumber,
            roomTypeId: room.roomTypeId,
            roomTypeName: room.roomTypeName,
            from,
            to,
            price: 0,
          },
        ]);
        setPendingSelection(null);
      } else {
        // Start new selection in different room
        setPendingSelection({
          roomId: room.id,
          roomNumber: room.roomNumber,
          roomTypeId: room.roomTypeId,
          roomTypeName: room.roomTypeName,
          date,
        });
      }
    } else {
      // Start selection
      setPendingSelection({
        roomId: room.id,
        roomNumber: room.roomNumber,
        roomTypeId: room.roomTypeId,
        roomTypeName: room.roomTypeName,
        date,
      });
    }
  };

  const removeSegment = (index: number) => {
    setSelectedSegments(selectedSegments.filter((_, i) => i !== index));
  };

  const handleBookingSelection = useCallback(
    (bookingId: string) => {
      if (!mergeMode) return;

      setSelectedBookingIds((prev) => {
        if (prev.includes(bookingId)) {
          return prev.filter((id) => id !== bookingId);
        } else {
          return [...prev, bookingId];
        }
      });
    },
    [mergeMode]
  );

  const mergeBookings = async () => {
    if (selectedBookingIds.length < 2) {
      setAlertModal({
        isOpen: true,
        message: t("admin:schedule.selectMinTwo"),
        type: "warning",
      });
      return;
    }

    try {
      const res = await authFetch("/api/admin/bookings/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingIds: selectedBookingIds }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || t("admin:schedule.errorMerging"));
      }

      setSelectedBookingIds([]);
      setMergeMode(false);

      // Give server time to complete transaction
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Update key - request new data
      onRefresh();

      // Wait for data to load and force re-render
      setTimeout(() => {
        forceUpdate((n) => n + 1);
      }, 1000);
    } catch (err) {
      setAlertModal({
        isOpen: true,
        message: (err as Error).message,
        type: "error",
      });
    }
  };

  const handleBookingClick = useCallback(
    (booking: AdminBooking) => {
      // Ignore clicks immediately after drag
      if (Date.now() - lastDragEndTimeRef.current < 200) {
        return;
      }

      if (mergeMode) {
        // In merge mode, toggle selection
        handleBookingSelection(booking.id);
      } else {
        // Normal mode, show details
        setSelectedBooking(booking);
      }
    },
    [mergeMode, handleBookingSelection]
  );

  // Helper function to get current CSS zoom factor
  const getZoomFactor = useCallback(() => {
    const zoomStr = document.body.style.zoom;
    if (!zoomStr) return 1;
    const zoom = parseFloat(zoomStr);
    return isNaN(zoom) || zoom === 0 ? 1 : zoom;
  }, []);

  // Drag & Drop handlers
  const handleBookingMouseDown = useCallback(
    (
      e: React.MouseEvent<HTMLButtonElement>,
      booking: AdminBooking,
      roomId: string,
      roomIndex: number
    ) => {
      // Ignore if in create/merge mode or if not left click
      if (createMode || mergeMode || e.button !== 0) return;

      // Prevent dragging composite bookings
      if (booking.isComposite) return;

      // Prevent dragging checked-out bookings
      const statusKey = resolveBookingStatus(booking.status);
      if (statusKey === "CheckedOut" || statusKey === "CheckedIn") return;

      // Prevent default click behavior
      e.preventDefault();
      e.stopPropagation();

      const rect = e.currentTarget.getBoundingClientRect();
      const containerEl = dragContainerRef.current;
      if (!containerEl) return;
      const containerRect = containerEl.getBoundingClientRect();

      // Calculate absolute position of element relative to container including scroll
      const scrollTop = containerEl.scrollTop;
      const scrollLeft = containerEl.scrollLeft;

      const absoluteLeft = rect.left - containerRect.left + scrollLeft;
      const absoluteTop = rect.top - containerRect.top + scrollTop;

      setDraggedBooking({
        booking,
        roomId,
        startX: e.pageX,
        startY: e.pageY,
        originalLeft: absoluteLeft,
        originalTop: absoluteTop,
        originalRoomIndex: roomIndex,
        currentX: e.pageX,
        currentY: e.pageY,
      });
    },
    [createMode, mergeMode]
  );

  // Handlers for hover events (memoized to prevent unnecessary re-renders)
  const handleBookingMouseEnter = useCallback((compositeParentId: string | null) => {
    if (compositeParentId) {
      setHoveredCompositeBookingId(compositeParentId);
    }
  }, []);

  const handleBookingMouseLeave = useCallback(() => {
    setHoveredCompositeBookingId(null);
  }, []);

  // Global mouse handlers for drag
  useEffect(() => {
    if (!draggedBooking) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!draggedBooking || !dragContainerRef.current) return;

      // Check that left mouse button is still pressed
      // If button is released, stop processing movement
      if ((e.buttons & 1) === 0) {
        return;
      }

      const deltaX = Math.abs(e.pageX - draggedBooking.startX);
      const deltaY = Math.abs(e.pageY - draggedBooking.startY);

      // Consider it a drag if moved more than 5 pixels
      if (deltaX > 5 || deltaY > 5) {
        isDraggingRef.current = true;
      }

      // Update cursor and position
      document.body.style.cursor = "grabbing";

      setDraggedBooking((prev) =>
        prev
          ? {
            ...prev,
            currentX: e.pageX,
            currentY: e.pageY,
          }
          : null
      );
    };

    const handleMouseUp = async (e: MouseEvent) => {
      if (!draggedBooking || !dragContainerRef.current) return;

      document.body.style.cursor = "";

      const deltaX = e.pageX - draggedBooking.startX;
      const deltaY = e.pageY - draggedBooking.startY;

      const isNightsMode = bookingSettings?.calculationMode === BookingCalculationMode.Nights;

      // In Nights mode use half-day step for visual snapping
      // dayShift will be in half-days, need to recalculate to days
      const snapStep = isNightsMode ? DAY_WIDTH / 2 : DAY_WIDTH;
      const dayShiftInHalfDays = Math.round(deltaX / snapStep);
      const dayShift = isNightsMode ? Math.round(dayShiftInHalfDays / 2) : dayShiftInHalfDays;

      // Calculate room shift (vertical)
      const rowShift = Math.round(deltaY / ROW_HEIGHT);

      const wasDragging = isDraggingRef.current;

      // Mark end of drag if there was actual dragging
      if (wasDragging) {
        lastDragEndTimeRef.current = Date.now();
      }
      isDraggingRef.current = false;

      // Only update if there was actual movement
      if ((dayShift !== 0 || rowShift !== 0) && wasDragging) {
        try {
          // Get all visible rooms in the same order as rendering
          const allVisibleRooms: { room: Room; index: number }[] = [];
          let currentIndex = 0;

          roomsByType.forEach(([roomType, rooms]) => {
            if (!collapsedGroups.has(roomType)) {
              rooms.forEach((room) => {
                allVisibleRooms.push({ room, index: currentIndex });
                currentIndex++;
              });
            }
          });

          // Calculate new room (if there is vertical movement)
          let targetRoom: Room | null = null;
          if (rowShift !== 0) {
            const originalIndex = draggedBooking.originalRoomIndex;
            const newIndex = originalIndex + rowShift;

            if (newIndex >= 0 && newIndex < allVisibleRooms.length) {
              const targetRoomData = allVisibleRooms[newIndex];
              const candidateRoom = targetRoomData.room;

              // Check that target room is of the same type as booking
              if (
                candidateRoom.roomTypeId === draggedBooking.booking.roomTypeId &&
                candidateRoom.isActive &&
                candidateRoom.id !== draggedBooking.roomId
              ) {
                targetRoom = candidateRoom;
              }
            }
          }

          // Calculate new dates (if there is horizontal movement)
          // IMPORTANT: Don't change dates if there was a vertical movement attempt to another room type,
          // but target room was not found (targetRoom === null). This prevents accidental
          // date changes when trying to move booking to another room type.
          let newCheckInStr: string | null = null;
          let newCheckOutStr: string | null = null;
          if (dayShift !== 0) {
            // If there was vertical movement but target room was not found,
            // this means attempt to move to another room type - don't change dates
            if (rowShift !== 0 && targetRoom === null) {
              // Ignore date change on failed attempt to move to another room type
              newCheckInStr = null;
              newCheckOutStr = null;
            } else {
              const checkInInfo = parseIsoDay(draggedBooking.booking.checkInDate);
              const checkOutInfo = parseIsoDay(draggedBooking.booking.checkOutDate);

              const newCheckInDate = fromDayNumber(checkInInfo.dayNumber + dayShift);
              const newCheckOutDate = fromDayNumber(checkOutInfo.dayNumber + dayShift);

              newCheckInStr = toDateInputValue(newCheckInDate);
              newCheckOutStr = toDateInputValue(newCheckOutDate);
            }
          }

          // Apply optimistic update immediately
          setOptimisticUpdates((prev) => {
            const next = new Map(prev);
            const update: { roomId?: string; checkInDate?: string; checkOutDate?: string } = {};
            if (targetRoom) {
              update.roomId = targetRoom.id;
            }
            if (newCheckInStr && newCheckOutStr) {
              update.checkInDate = newCheckInStr;
              update.checkOutDate = newCheckOutStr;
            }
            if (Object.keys(update).length > 0) {
              next.set(draggedBooking.booking.id, update);
            }
            return next;
          });

          // If both room and dates change simultaneously - use combined endpoint
          if (targetRoom && newCheckInStr && newCheckOutStr && onUpdateRoomAndDates) {
            await onUpdateRoomAndDates(
              draggedBooking.booking.id,
              targetRoom.id,
              newCheckInStr,
              newCheckOutStr
            );
            // Mark as successful update
            setSuccessfulUpdates((prev) => new Set(prev).add(draggedBooking.booking.id));
          } else {
            // Otherwise use separate endpoints
            // First update room (if there is vertical movement)
            if (targetRoom && onAssignRoom) {
              await onAssignRoom(draggedBooking.booking.id, targetRoom.id);
              setSuccessfulUpdates((prev) => new Set(prev).add(draggedBooking.booking.id));
            } else if (rowShift !== 0) {
              console.warn(
                "⚠️ Vertical movement but target room is invalid or onAssignRoom is not provided",
                {
                  rowShift,
                  targetRoom,
                  hasOnAssignRoom: !!onAssignRoom,
                }
              );
            }

            // Then update dates (if there is horizontal movement)
            if (newCheckInStr && newCheckOutStr && onUpdateDates) {
              await onUpdateDates(draggedBooking.booking.id, newCheckInStr, newCheckOutStr);
              setSuccessfulUpdates((prev) => new Set(prev).add(draggedBooking.booking.id));
            }
          }

          // DON'T call onRefresh() immediately - optimistic update already shows changes
          // Parent component will update data after receiving API response via React Query or other mechanism
        } catch (err) {
          console.error("Error updating booking:", err);
          // On error rollback optimistic update
          setOptimisticUpdates((prev) => {
            const next = new Map(prev);
            next.delete(draggedBooking.booking.id);
            return next;
          });
          setAlertModal({
            isOpen: true,
            message: (err as Error).message || t("admin:schedule.errorMoving"),
            type: "error",
          });
          // On error don't call onRefresh since data hasn't changed
        }
      }

      // Reset draggedBooking - bar will stay at new position thanks to optimistic update
      setDraggedBooking(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
    };
  }, [
    draggedBooking,
    DAY_WIDTH,
    ROW_HEIGHT,
    roomsByType,
    collapsedGroups,
    onUpdateDates,
    onAssignRoom,
    onUpdateRoomAndDates,
    onRefresh,
    bookingSettings?.calculationMode,
    getZoomFactor,
    t,
  ]);

  // Block background scrolling when side panel is open
  useEffect(() => {
    const { body } = document;
    const originalOverflow = body.style.overflow;
    if (selectedBooking) {
      body.style.overflow = "hidden";
    }
    return () => {
      body.style.overflow = originalOverflow;
    };
  }, [selectedBooking]);

  useEffect(() => {
    if (!selectedBooking) {
      return;
    }
    const inRangeBooking = bookings.find((booking) => booking.id === selectedBooking.id);
    const sourceBooking =
      inRangeBooking ?? allBookings?.find((booking) => booking.id === selectedBooking.id) ?? null;

    if (!sourceBooking || resolveBookingStatus(sourceBooking.status) === "Cancelled") {
      setSelectedBooking(null);
      return;
    }

    const nextBooking = applyOptimisticUpdate(sourceBooking);

    const makeSignature = (booking: AdminBooking) =>
      [
        booking.id,
        booking.status,
        booking.checkInDate,
        booking.checkOutDate,
        booking.assignedRoomId ?? "",
        booking.totalPrice,
        booking.paidAmount,
        booking.remainingAmount,
        (booking.childBookings ?? [])
          .map(
            (segment) =>
              `${segment.id}:${segment.checkInDate}:${segment.checkOutDate}:${segment.assignedRoomId ?? ""}`
          )
          .join("|"),
      ].join("::");

    if (makeSignature(nextBooking) !== makeSignature(selectedBooking)) {
      setSelectedBooking(nextBooking);
    }
  }, [bookings, allBookings, selectedBooking, applyOptimisticUpdate]);

  // Clear optimistic updates and successful updates after receiving data from server
  useEffect(() => {
    if (successfulUpdates.size === 0) return undefined;

    // Check that all successful updates are present in current data
    const allBookingIds = new Set(bookings.map((b) => b.id));
    const stillSuccessful = Array.from(successfulUpdates).filter((id) => allBookingIds.has(id));

    // If all successful updates are present in data, clear after 2 seconds (to show checkmark)
    if (stillSuccessful.length > 0) {
      const timer = setTimeout(() => {
        setOptimisticUpdates((prev) => {
          const next = new Map(prev);
          stillSuccessful.forEach((id) => next.delete(id));
          return next;
        });
        setSuccessfulUpdates((prev) => {
          const next = new Set(prev);
          stillSuccessful.forEach((id) => next.delete(id));
          return next;
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [bookings, successfulUpdates]);

  // Available rooms for assignment (same type as booking)
  return (
    <section className="flex flex-1 min-h-0 flex-col rounded-3xl border border-slate-200 bg-white p-4 shadow-sm overflow-hidden">
      {/* Single toolbar: view, scale, legend, refresh, compact; when gantt: date, nav, actions */}
      <div className="rounded-xl border border-slate-100 bg-slate-50/30 p-2 sm:p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* View: Schedule | Calendar */}
          <div className="flex items-center gap-0.5 sm:gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("gantt")}
              className={`inline-flex items-center gap-0.5 sm:gap-1 rounded-md px-1.5 sm:px-2.5 py-1 text-[10px] sm:text-xs font-medium transition ${viewMode === "gantt"
                ? "bg-brand text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
                }`}
              title={t("admin:schedule.gantt")}
            >
              <svg
                className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
              <span>{t("admin:schedule.gantt")}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`inline-flex items-center gap-0.5 sm:gap-1 rounded-md px-1.5 sm:px-2.5 py-1 text-[10px] sm:text-xs font-medium transition ${viewMode === "calendar"
                ? "bg-brand text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
                }`}
              title={t("admin:schedule.calendar")}
            >
              <svg
                className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span>{t("admin:schedule.calendar")}</span>
            </button>
          </div>
          {/* Scale combobox */}
          <label className="inline-flex items-center gap-1.5">
            <span className="text-[10px] sm:text-xs font-medium text-slate-500 whitespace-nowrap">
              {t("admin:schedule.size")}
            </span>
            <select
              value={scaleMode}
              onChange={(e) => setScaleMode(e.target.value as ScaleMode)}
              title={t("admin:schedule.size")}
              className="h-8 min-w-[7rem] rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[10px] sm:text-xs font-medium text-slate-700 transition focus:border-brand focus:ring-1 focus:ring-brand focus:outline-none cursor-pointer"
            >
              <option value="compact">{t("admin:schedule.compact")}</option>
              <option value="normal">{t("admin:schedule.normal")}</option>
              <option value="comfortable">{t("admin:schedule.comfortable")}</option>
            </select>
          </label>

          {/* Gantt: date range, nav, actions */}
          {viewMode === "gantt" && (
            <>
              <div className="h-6 w-px bg-slate-200 flex-shrink-0 mx-0.5" aria-hidden="true" />
              {/* Date Range Picker */}
              <div className="flex items-center gap-1 sm:gap-2">
                <div className="flex items-center gap-1 sm:gap-1.5 rounded-lg border border-slate-200 bg-white px-1.5 sm:px-2 py-1 sm:py-1.5">
                  <svg
                    className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <DateInput
                    id="schedule-from"
                    value={toDateInputValue(normalizedRange.from)}
                    onChange={(v) => handleInputChange("from", v)}
                    className="w-[75px] sm:w-[110px] border-0 bg-transparent p-0 text-[9px] sm:text-xs font-medium text-slate-700 focus:outline-none focus:ring-0"
                  />
                </div>
                <span className="text-[9px] sm:text-xs text-slate-400">—</span>
                <div className="flex items-center gap-1 sm:gap-1.5 rounded-lg border border-slate-200 bg-white px-1.5 sm:px-2 py-1 sm:py-1.5">
                  <svg
                    className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <DateInput
                    id="schedule-to"
                    value={toDateInputValue(normalizedRange.to)}
                    onChange={(v) => handleInputChange("to", v)}
                    className="w-[75px] sm:w-[110px] border-0 bg-transparent p-0 text-[9px] sm:text-xs font-medium text-slate-700 focus:outline-none focus:ring-0"
                  />
                </div>
              </div>

              <div
                className="hidden sm:block h-6 w-px bg-slate-200 flex-shrink-0"
                aria-hidden="true"
              />

              {/* Navigation Controls */}
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={() => shiftRange(-7)}
                  className="inline-flex items-center gap-0.5 sm:gap-1 rounded-lg border border-slate-200 bg-white px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-slate-600 transition hover:border-brand hover:bg-brand hover:text-white"
                  title={t("admin:schedule.prevWeek")}
                >
                  <svg
                    className="h-2.5 w-2.5 sm:h-3 sm:w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  {t("admin:schedule.weekShort")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const spanDays = Math.max(1, rangeDayNumbers.count);
                    focusDateRequestRef.current = today;
                    onRangeChange({ from: today, to: addDays(today, spanDays - 1) });
                  }}
                  className="inline-flex items-center gap-0.5 sm:gap-1 rounded-lg border border-brand bg-brand px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold text-white transition hover:bg-brand/90"
                >
                  <svg
                    className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>{t("admin:schedule.today")}</span>
                </button>
                <button
                  type="button"
                  onClick={() => shiftRange(7)}
                  className="inline-flex items-center gap-0.5 sm:gap-1 rounded-lg border border-slate-200 bg-white px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-slate-600 transition hover:border-brand hover:bg-brand hover:text-white"
                  title={t("admin:schedule.nextWeek")}
                >
                  {t("admin:schedule.weekShort")}
                  <svg
                    className="h-2.5 w-2.5 sm:h-3 sm:w-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>

              {/* Divider */}
              <div className="hidden sm:block h-6 w-px bg-slate-200"></div>

              <div
                className="hidden sm:block h-6 w-px bg-slate-200 flex-shrink-0"
                aria-hidden="true"
              />

              {/* Quick Actions: expand range to all non-cancelled bookings (with accommodation) */}
              <button
                type="button"
                onClick={() => {
                  const source = (allBookings ?? bookings).filter(
                    (b) =>
                      (b.numberOfNights ?? 0) > 0 && resolveBookingStatus(b.status) !== "Cancelled"
                  );
                  if (!source.length) return;
                  let minDate: Date | null = null;
                  let maxDate: Date | null = null;
                  source.forEach((b) => {
                    const checkIn = new Date(b.checkInDate);
                    const checkOut = new Date(b.checkOutDate);
                    checkIn.setHours(0, 0, 0, 0);
                    checkOut.setHours(23, 59, 59, 999);
                    if (minDate == null || checkIn < minDate) minDate = checkIn;
                    if (maxDate == null || checkOut > maxDate) maxDate = checkOut;
                  });
                  if (minDate && maxDate) onRangeChange({ from: minDate, to: maxDate });
                }}
                disabled={!(allBookings?.length ?? bookings.length)}
                className="inline-flex items-center gap-1 sm:gap-1.5 rounded-lg border border-slate-200 bg-white px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium text-slate-600 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
              >
                <svg
                  className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                  />
                </svg>
                <span>{t("admin:schedule.allBookings")}</span>
              </button>

              <div
                className="hidden sm:block h-6 w-px bg-slate-200 flex-shrink-0"
                aria-hidden="true"
              />
              <div className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    if (createMode) {
                      setCreateMode(false);
                      setSelectedSegments([]);
                      setPendingSelection(null);
                    } else {
                      setCreateMode(true);
                      setMergeMode(false);
                      setSelectedBookingIds([]);
                    }
                  }}
                  title={t("admin:schedule.createHint")}
                  className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-lg border px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium transition ${createMode
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
                    }`}
                >
                  {createMode ? (
                    <svg
                      className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 11v6m-3-3h6"
                      />
                    </svg>
                  )}
                  <span>
                    {createMode
                      ? t("admin:schedule.cancelAction")
                      : t("admin:schedule.createBooking")}
                  </span>
                </button>
                <div
                  className={`pointer-events-none absolute left-1/2 top-full z-40 mt-2 w-56 -translate-x-1/2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] sm:text-xs font-medium text-blue-900 shadow-lg transition ${createMode ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}
                >
                  {t("admin:schedule.createHint")}
                </div>
              </div>

              {createMode && selectedSegments.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(true)}
                  className="inline-flex items-center gap-1 sm:gap-1.5 rounded-lg border border-blue-600 bg-blue-600 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  <span>
                    {t("admin:schedule.process")} ({selectedSegments.length})
                  </span>
                  <span className="sm:hidden">✓ ({selectedSegments.length})</span>
                </button>
              )}

              <div className="relative group">
                <button
                  type="button"
                  onClick={() => {
                    if (mergeMode) {
                      setMergeMode(false);
                      setSelectedBookingIds([]);
                    } else {
                      setMergeMode(true);
                      setCreateMode(false);
                      setSelectedSegments([]);
                      setPendingSelection(null);
                    }
                  }}
                  title={t("admin:schedule.mergeHint")}
                  className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-lg border px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-medium transition ${mergeMode
                    ? "border-green-500 bg-green-50 text-green-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-brand hover:text-brand"
                    }`}
                >
                  {mergeMode ? (
                    <svg
                      className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-3 w-3 sm:h-3.5 sm:w-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9h8" />
                    </svg>
                  )}
                  <span>
                    {mergeMode ? t("admin:schedule.cancelAction") : t("admin:schedule.mergeBookings")}
                  </span>
                </button>
                <div
                  className={`pointer-events-none absolute left-0 top-full z-40 mt-2 w-64 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] sm:text-xs font-medium text-emerald-900 shadow-lg transition ${mergeMode ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}
                >
                  {t("admin:schedule.mergeHint")}
                </div>
              </div>

              {mergeMode && selectedBookingIds.length >= 2 && (
                <button
                  type="button"
                  onClick={mergeBookings}
                  className="inline-flex items-center gap-1 sm:gap-1.5 rounded-lg border border-green-600 bg-green-600 px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-bold text-white shadow-sm hover:bg-green-700"
                >
                  <span>
                    {t("admin:schedule.merge")} ({selectedBookingIds.length})
                  </span>
                  <span className="sm:hidden">✓ ({selectedBookingIds.length})</span>
                </button>
              )}

            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex-1 min-h-0 relative">
        {viewMode === "calendar" ? (
          <div className="h-full overflow-auto">
            <BookingCalendar
              bookings={allBookings || bookings}
              onDayClick={(date, dayBookings) => {
                setSelectedDay(date);
                setSelectedDayBookings(dayBookings);
              }}
            />
          </div>
        ) : (
          <div className="h-full overflow-hidden rounded-2xl border border-slate-100">
            <div className="flex h-full min-h-0">
              {/* Left fixed column (does not participate in horizontal scroll) */}
              <div
                className="sticky left-0 top-0 z-10 flex h-full shrink-0 flex-col bg-white"
                style={{ width: COLUMN_WIDTH }}
              >
                {/* Left column header */}
                <div
                  className={`sticky top-0 z-10 border-r-2 border-slate-300 bg-white px-2 sm:px-3 shadow-sm flex items-center ${isMobile && "roomFontMobile" in scale ? (scale as (typeof SCALE_PRESETS)[ScaleMode]).roomFontMobile : scale.roomFont} font-semibold`}
                  style={{ height: HEADER_HEIGHT }}
                >
                  {t("admin:schedule.room")}
                </div>
                {/* Vertically scrollable part with room names */}
                <div
                  ref={leftScrollRef}
                  className="flex-1 overflow-y-auto overflow-x-hidden pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                >
                  {roomsByType.map(([roomType, rooms]) => {
                    const isCollapsed = collapsedGroups.has(roomType);
                    return (
                      <div key={roomType}>
                        {/* Group header */}
                        <button
                          type="button"
                          onClick={() => toggleGroup(roomType)}
                          className="flex w-full items-center justify-between bg-blue-50 px-2 sm:px-3 hover:bg-blue-100 transition"
                          style={{ height: GROUP_HEADER_HEIGHT }}
                        >
                          <div className="flex items-center gap-1 sm:gap-2">
                            <svg
                              className={`${isMobile && "iconSizeMobile" in scale ? (scale as (typeof SCALE_PRESETS)[ScaleMode]).iconSizeMobile : scale.iconSize} text-slate-600 transition-transform ${isCollapsed ? "" : "rotate-90"}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2.5}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                            <span
                              className={`${isMobile && "roomFontMobile" in scale ? (scale as (typeof SCALE_PRESETS)[ScaleMode]).roomFontMobile : scale.roomFont} font-bold text-slate-900`}
                            >
                              {roomType}
                            </span>
                          </div>
                          <span
                            className={`rounded-full bg-white border border-slate-300 px-1.5 sm:px-2 py-0.5 ${scale.fontSize} font-bold text-slate-600`}
                          >
                            {rooms.length}
                          </span>
                        </button>

                        {/* Rooms in group */}
                        {!isCollapsed &&
                          rooms.map((room) => (
                            <div
                              key={room.id}
                              className="flex flex-col justify-center bg-slate-50 px-2 sm:px-3 pl-4 sm:pl-8 border-r-2 border-b border-slate-300 shadow-sm"
                              style={{ width: COLUMN_WIDTH, height: ROW_HEIGHT }}
                            >
                              <div className="flex items-center gap-1 sm:gap-1.5">
                                <span
                                  className={`${isMobile && "roomFontMobile" in scale ? (scale as (typeof SCALE_PRESETS)[ScaleMode]).roomFontMobile : scale.roomFont} font-semibold text-slate-900`}
                                >
                                  <span className="hidden sm:inline">№ </span>
                                  {room.roomNumber}
                                </span>
                              </div>
                              {room.floor != null && (
                                <div
                                  className={`mt-0.5 sm:mt-1 flex items-center gap-1 sm:gap-1.5 ${scale.fontSize} text-slate-600`}
                                >
                                  <span className="rounded-md bg-white/80 px-1 sm:px-1.5 py-0.5 font-medium text-slate-700">
                                    <span className="hidden sm:inline">
                                      {t("admin:schedule.floor")}:{" "}
                                    </span>
                                    {room.floor}
                                  </span>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right part: horizontally/vertically scrollable grid */}
              <div
                ref={(el) => {
                  rightScrollRef.current = el;
                  dragContainerRef.current = el;
                }}
                onMouseDown={handleGanttPaneMouseDown}
                className={`h-full min-h-0 grow overflow-auto select-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] ${isPanning ? "cursor-grabbing" : "cursor-grab"}`}
              >
                {/* Header with days */}
                <div
                  className={`sticky top-0 z-30 grid bg-white ${scale.fontSize} font-semibold uppercase tracking-wide text-slate-500 shadow-sm`}
                  style={{
                    gridTemplateColumns: `repeat(${rangeDayNumbers.count}, ${DAY_WIDTH}px)`,
                    height: HEADER_HEIGHT,
                  }}
                >
                  {days.map((day) => (
                    <div
                      key={day.toISOString()}
                      className="border-l border-b border-slate-200 bg-white px-0.5 sm:px-1 text-center h-full flex flex-col items-center justify-center"
                    >
                      <span
                        className={`block font-bold text-slate-700 ${isMobile && "dateFontMobile" in scale ? (scale as (typeof SCALE_PRESETS)[ScaleMode]).dateFontMobile : scale.dateFont}`}
                      >
                        {day.toLocaleDateString(locale, { day: "2-digit" })}
                      </span>
                      <span className={`block ${scale.fontSize} font-medium text-slate-500`}>
                        {day.toLocaleDateString(locale, { month: "short" })}
                      </span>
                      <span
                        className={`hidden sm:block ${scale.fontSize} uppercase text-slate-400`}
                      >
                        {day.toLocaleDateString(locale, { weekday: "short" })}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Rows with booking bars */}
                {(() => {
                  let globalRoomIndex = 0;
                  return roomsByType.map(([roomType, rooms]) => {
                    const isCollapsed = collapsedGroups.has(roomType);
                    const groupRoomsStart = globalRoomIndex;
                    if (!isCollapsed) {
                      globalRoomIndex += rooms.length;
                    }
                    return (
                      <div key={`group-${roomType}`}>
                        {/* Group header in right part */}
                        <div
                          className="relative bg-blue-50"
                          style={{ height: GROUP_HEADER_HEIGHT }}
                        >
                          <div
                            className="grid h-full"
                            style={{
                              gridTemplateColumns: `repeat(${rangeDayNumbers.count}, ${DAY_WIDTH}px)`,
                            }}
                          >
                            {days.map((day) => (
                              <div
                                key={day.toISOString()}
                                className="border-l border-slate-200 bg-blue-50"
                              />
                            ))}
                          </div>
                        </div>

                        {/* Rooms in group */}
                        {!isCollapsed &&
                          rooms.map((room, roomIdxInGroup) => {
                            const roomBookings = bookingsByRoom.get(room.id) ?? [];
                            const roomIndex = groupRoomsStart + roomIdxInGroup;
                            return (
                              <div
                                key={room.id}
                                className="relative"
                                style={{ height: ROW_HEIGHT }}
                              >
                                {/* days grid background */}
                                <div
                                  className={`grid h-full ${createMode ? "cursor-pointer" : "pointer-events-none"}`}
                                  style={{
                                    gridTemplateColumns: `repeat(${rangeDayNumbers.count}, ${DAY_WIDTH}px)`,
                                  }}
                                >
                                  {days.map((day) => {
                                    const isPendingStart =
                                      pendingSelection?.roomId === room.id &&
                                      pendingSelection.date.getTime() === day.getTime();

                                    return (
                                      <div
                                        key={day.toISOString()}
                                        onClick={() => handleCellClick(room, day)}
                                        className={`border-l border-b border-slate-100 transition-colors ${createMode ? "hover:bg-blue-50" : ""} ${isPendingStart ? "bg-blue-200" : "bg-slate-50/30"}`}
                                      />
                                    );
                                  })}
                                </div>

                                {/* bars layer */}
                                <div className="absolute inset-0 z-10 pointer-events-none">
                                  {/* Selected Segments (Create Mode) */}
                                  {selectedSegments
                                    .filter((s) => s.roomId === room.id)
                                    .map((segment, idx) => {
                                      const checkInInfo = parseIsoDay(segment.from);
                                      const checkOutInfo = parseIsoDay(segment.to);
                                      const isNightsMode =
                                        bookingSettings?.calculationMode ===
                                        BookingCalculationMode.Nights;

                                      // In both modes include checkout day in range (for visualization)
                                      // In Nights mode it will be shown half
                                      const rangeStartDay = rangeDayNumbers.startDay;
                                      const rangeEndDayExclusive = rangeDayNumbers.endDay + 1;
                                      const bookingStartDay = Math.max(
                                        checkInInfo.dayNumber,
                                        rangeStartDay
                                      );
                                      const bookingEndDayExclusive = Math.min(
                                        checkOutInfo.dayNumber + 1,
                                        rangeEndDayExclusive
                                      );

                                      if (bookingEndDayExclusive <= bookingStartDay) return null;

                                      const startIndex = bookingStartDay - rangeStartDay;
                                      const span = bookingEndDayExclusive - bookingStartDay;
                                      let leftOffset = startIndex * DAY_WIDTH;
                                      let barWidth = span * DAY_WIDTH;

                                      // In Nights mode adjust position and width for partial day occupancy
                                      if (isNightsMode) {
                                        const isCheckInDayVisible =
                                          checkInInfo.dayNumber >= rangeStartDay &&
                                          checkInInfo.dayNumber <= rangeDayNumbers.endDay;
                                        const isCheckOutDayVisible =
                                          checkOutInfo.dayNumber >= rangeStartDay &&
                                          checkOutInfo.dayNumber <= rangeDayNumbers.endDay;
                                        const isSameDay =
                                          checkInInfo.dayNumber === checkOutInfo.dayNumber;

                                        if (isSameDay && isCheckInDayVisible) {
                                          // If check-in and check-out same day - show only half day
                                          leftOffset += DAY_WIDTH / 2;
                                          barWidth = DAY_WIDTH / 2;
                                        } else {
                                          // If check-in day is in visible range - start from middle of day
                                          if (isCheckInDayVisible) {
                                            leftOffset += DAY_WIDTH / 2;
                                            barWidth -= DAY_WIDTH / 2;
                                          }

                                          // If check-out day is in visible range - end at middle of day
                                          if (isCheckOutDayVisible && !isSameDay) {
                                            barWidth -= DAY_WIDTH / 2;
                                          }
                                        }

                                        // Ensure width is not negative
                                        if (barWidth < 0) {
                                          barWidth = DAY_WIDTH / 2;
                                        }
                                      }

                                      return (
                                        <div
                                          key={`seg-${idx}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            removeSegment(selectedSegments.indexOf(segment));
                                          }}
                                          style={{
                                            position: "absolute",
                                            left: `${leftOffset + 2}px`,
                                            top: "4px",
                                            width: `${barWidth - 4}px`,
                                            height: `${ROW_HEIGHT - 8}px`,
                                          }}
                                          className={`pointer-events-auto flex cursor-pointer items-center justify-center rounded-lg border border-blue-500 bg-blue-100 text-xs font-bold text-blue-700 shadow-sm transition hover:bg-blue-200 hover:shadow-md z-20`}
                                          title={t("admin:schedule.clickToRemove")}
                                        >
                                          <span className="truncate px-1">
                                            {t("admin:schedule.newSegment")} (
                                            {(() => {
                                              const daysDiff = Math.ceil(
                                                (segment.to.getTime() - segment.from.getTime()) /
                                                (1000 * 60 * 60 * 24)
                                              );
                                              const units = isNightsMode ? daysDiff : daysDiff + 1;
                                              return getUnitName(units, isNightsMode);
                                            })()}
                                            )
                                          </span>
                                        </div>
                                      );
                                    })}
                                  {roomBookings.map((booking) => {
                                    const checkInInfo = parseIsoDay(booking.checkInDate);
                                    const checkOutInfo = parseIsoDay(booking.checkOutDate);
                                    const isNightsMode =
                                      bookingSettings?.calculationMode ===
                                      BookingCalculationMode.Nights;

                                    const rangeStartDay = rangeDayNumbers.startDay;
                                    const rangeEndDayExclusive = rangeDayNumbers.endDay + 1;

                                    let bookingStartDay = Math.max(
                                      checkInInfo.dayNumber,
                                      rangeStartDay
                                    );
                                    let bookingEndDayExclusive = Math.min(
                                      checkOutInfo.dayNumber + 1,
                                      rangeEndDayExclusive
                                    );

                                    if (bookingEndDayExclusive <= bookingStartDay) {
                                      return null;
                                    }

                                    const startIndex = bookingStartDay - rangeStartDay;
                                    const span = bookingEndDayExclusive - bookingStartDay;

                                    // Calculate bar position and width
                                    let leftOffset = startIndex * DAY_WIDTH;
                                    let barWidth = span * DAY_WIDTH;

                                    // In Nights mode adjust position and width for partial day occupancy
                                    if (isNightsMode) {
                                      const isCheckInDayVisible =
                                        checkInInfo.dayNumber >= rangeStartDay &&
                                        checkInInfo.dayNumber <= rangeDayNumbers.endDay;
                                      const isCheckOutDayVisible =
                                        checkOutInfo.dayNumber >= rangeStartDay &&
                                        checkOutInfo.dayNumber <= rangeDayNumbers.endDay;
                                      const isSameDay =
                                        checkInInfo.dayNumber === checkOutInfo.dayNumber;

                                      if (isSameDay && isCheckInDayVisible) {
                                        leftOffset += DAY_WIDTH / 2;
                                        barWidth = DAY_WIDTH / 2;
                                      } else {
                                        if (isCheckInDayVisible) {
                                          leftOffset += DAY_WIDTH / 2;
                                          barWidth -= DAY_WIDTH / 2;
                                        }
                                        if (isCheckOutDayVisible && !isSameDay) {
                                          barWidth -= DAY_WIDTH / 2;
                                        }
                                      }

                                      if (barWidth < 0) {
                                        barWidth = DAY_WIDTH / 2;
                                      }
                                    }

                                    // For composite booking segments use parent data
                                    const parentBooking = (
                                      booking as AdminBooking & { parentBooking?: AdminBooking }
                                    ).parentBooking as AdminBooking | undefined;

                                    const compositeParentId = parentBooking
                                      ? parentBooking.id
                                      : booking.isComposite
                                        ? booking.id
                                        : null;

                                    const isDragging = draggedBooking?.booking.id === booking.id;
                                    const isSuccessfullyUpdated = successfulUpdates.has(booking.id);

                                    return (
                                      <BookingBar
                                        key={`${booking.id}-${refreshCounter}`}
                                        booking={booking}
                                        parentBooking={parentBooking}
                                        leftOffset={leftOffset}
                                        barWidth={barWidth}
                                        rowHeight={ROW_HEIGHT}
                                        scale={scale}
                                        currency={currency}
                                        hoveredCompositeBookingId={hoveredCompositeBookingId}
                                        selectedBookingIds={selectedBookingIds}
                                        isDragging={isDragging}
                                        isSuccessfullyUpdated={isSuccessfullyUpdated}
                                        scaleMode={scaleMode}
                                        onBookingClick={handleBookingClick}
                                        onMouseDown={(e) =>
                                          handleBookingMouseDown(
                                            e,
                                            parentBooking || booking,
                                            room.id,
                                            roomIndex
                                          )
                                        }
                                        onMouseEnter={() =>
                                          handleBookingMouseEnter(compositeParentId)
                                        }
                                        onMouseLeave={handleBookingMouseLeave}
                                        createMode={createMode}
                                        mergeMode={mergeMode}
                                        locale={locale}
                                        clientLabel={t("admin:schedule.client")}
                                        compositeBookingTitle={t("admin:schedule.compositeBooking")}
                                        paidLabel={t("admin:schedule.paid")}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Drag Preview - outside scrollable container with fixed positioning */}
            {draggedBooking &&
              dragContainerRef.current &&
              (() => {
                const isNightsMode =
                  bookingSettings?.calculationMode === BookingCalculationMode.Nights;

                // Calculate current delta from drag state
                const deltaX = draggedBooking.currentX - draggedBooking.startX;
                const deltaY = draggedBooking.currentY - draggedBooking.startY;

                // In Nights mode use half-day step for visual snapping
                // But for date updates we still use whole days
                const snapStep = isNightsMode ? DAY_WIDTH / 2 : DAY_WIDTH;
                const dayShift = Math.round(deltaX / snapStep);
                const rowShift = Math.round(deltaY / ROW_HEIGHT);

                // Calculate snapped position (snap visually to grid)
                // In Nights mode snap to half-days, in Days mode - to whole days
                const snappedDeltaX = dayShift * snapStep;
                const snappedDeltaY = rowShift * ROW_HEIGHT;

                const containerRect = dragContainerRef.current.getBoundingClientRect();
                const scrollLeft = dragContainerRef.current.scrollLeft;
                const scrollTop = dragContainerRef.current.scrollTop;
                const zoomFactor = Math.max(0.1, getCurrentZoomFactor());

                // Keep original rect-aligned base, but scale drag delta for fixed preview
                // when app zoom is changed via documentElement.style.zoom.
                const baseLeft = containerRect.left + (draggedBooking.originalLeft - scrollLeft);
                const baseTop = containerRect.top + (draggedBooking.originalTop - scrollTop);
                const screenLeft = baseLeft + snappedDeltaX * zoomFactor;
                const screenTop = baseTop + snappedDeltaY * zoomFactor;

                const checkInInfo = parseIsoDay(draggedBooking.booking.checkInDate);
                const checkOutInfo = parseIsoDay(draggedBooking.booking.checkOutDate);

                // Calculate bar width and position according to mode
                const span = Math.max(1, checkOutInfo.dayNumber - checkInInfo.dayNumber + 1);
                let barWidth = span * DAY_WIDTH;

                // In Nights mode adjust only width for partial day occupancy
                // Position (screenLeft) already includes correction since originalLeft comes from already corrected bar
                if (isNightsMode) {
                  const isSameDay = checkInInfo.dayNumber === checkOutInfo.dayNumber;

                  if (isSameDay) {
                    // If check-in and check-out same day - show only half day
                    barWidth = DAY_WIDTH / 2;
                  } else {
                    // Check-in day starts from middle - reduce width
                    barWidth -= DAY_WIDTH / 2;

                    // Check-out day ends at middle - reduce width
                    barWidth -= DAY_WIDTH / 2;
                  }

                  // Ensure width is not negative
                  if (barWidth < 0) {
                    barWidth = DAY_WIDTH / 2;
                  }
                }

                const previewWidth = Math.max(4, barWidth - 4);
                const previewHeight = Math.max(8, ROW_HEIGHT - 8);

                const statusKey = resolveBookingStatus(draggedBooking.booking.status);
                const statusTheme = bookingStatusTheme[statusKey];
                const statusClass =
                  statusTheme?.scheduleClass ?? "bg-slate-200 border-slate-300 text-slate-600";

                return (
                  <div
                    style={{
                      position: "fixed",
                      left: `${screenLeft}px`,
                      top: `${screenTop}px`,
                      width: `${previewWidth}px`,
                      height: `${previewHeight}px`,
                      opacity: 0.7,
                      pointerEvents: "none",
                      zIndex: 1000,
                    }}
                    className={`flex flex-col justify-start ${scale.barGap} rounded-lg border-2 border-dashed ${scale.barPadding} text-left text-xs shadow-lg overflow-hidden ${statusClass}`}
                  >
                    <div className="flex items-center justify-between gap-1 min-h-0">
                      <div className="flex items-center gap-1 min-w-0 flex-1">
                        <span className={`font-semibold truncate ${scale.fontSize} leading-tight`}>
                          {draggedBooking.booking.client
                            ? `${draggedBooking.booking.client.firstName} ${draggedBooking.booking.client.lastName}`
                            : t("admin:schedule.client")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
          </div>
        )}
      </div>
      {/* Unified Booking Modal */}
      {selectedBooking && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-4">
              {t("admin:schedule.loading")}
            </div>
          }
        >
          <UnifiedBookingModal
            booking={selectedBooking}
            isOpen={!!selectedBooking}
            onClose={() => {
              setSelectedBooking(null);
            }}
            onUpdate={onRefresh}
            onConfirm={onConfirmBooking}
            onCheckIn={onCheckInBooking}
            onCheckOut={onCheckOutBooking}
            onCancel={onCancelBooking}
            onUpdateDates={onUpdateDates}
            onAssignRoom={onAssignRoom}
          />
        </Suspense>
      )}

      {/* Manual Booking Modal */}
      <ManualCompositeBookingModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        segments={selectedSegments}
        onSuccess={() => {
          setSelectedSegments([]);
          setPendingSelection(null);
          setCreateMode(false);
          onRefresh();
        }}
        bookingSettings={bookingSettings}
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ isOpen: false, message: "" })}
        message={alertModal.message}
        type={alertModal.type}
      />

      {/* Booking Day Modal */}
      <BookingDayModal
        isOpen={selectedDay !== null}
        date={selectedDay}
        bookings={selectedDayBookings}
        onClose={() => {
          // DON'T close modal if UnifiedBookingModal is open
          if (selectedBooking) {
            return;
          }
          setSelectedDay(null);
          setSelectedDayBookings([]);
        }}
        onBookingClick={(booking) => {
          // DON'T close day modal - it should stay open
          setSelectedBooking(booking);
        }}
      />
    </section>
  );
};

export default AdminSchedule;
