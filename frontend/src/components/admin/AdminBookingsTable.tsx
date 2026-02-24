import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  bookingStatusTheme,
  resolveBookingStatus,
  type BookingStatusKey,
} from "../../constants/bookingStatusTheme";
import type { AdminBooking } from "./AdminPendingBookings";
import { useAuth } from "../../context/AuthContext";
import { lazy, Suspense } from "react";
import useLocale from "../../hooks/useLocale";
import { useTranslation } from "react-i18next";

const UnifiedBookingModal = lazy(() => import("../UnifiedBookingModal"));
import DateInput from "../DateInput";
import ConfirmModal from "../ConfirmModal";

type AdminBookingsTableProps = {
  bookings: AdminBooking[];
  loading: boolean;
  error?: string | null;
  onRefresh: () => void;
  onConfirm?: (bookingId: string) => Promise<void>;
  onCheckIn?: (bookingId: string) => Promise<void>;
  onCheckOut?: (bookingId: string) => Promise<void>;
  onCancel?: (bookingId: string) => Promise<void>;
  onDelete?: (bookingId: string) => Promise<void>;
  onUpdateDates?: (bookingId: string, checkInDate: string, checkOutDate: string) => Promise<void>;
  onAssignRoom?: (bookingId: string, roomId: string) => Promise<void>;
  quickFilter?: QuickFilter | null;
  statusFilter?: BookingStatusKey | BookingStatusKey[] | null;
  onStatusFilterChange?: (filter: BookingStatusKey[] | null) => void;
};

export type QuickFilter = "checkinToday" | "checkoutToday" | "currentStay";

type ActionType = "confirm" | "check-in" | "check-out" | "cancel" | "delete" | "update";

type AutocompleteOption = {
  value: string;
  label: string;
  sublabel?: string;
};

type AutocompleteFilterProps = {
  label: string;
  placeholder: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: AutocompleteOption[];
};

type SortField = "createdAt" | "checkIn" | "checkOut" | "price" | "client" | "status";
type SortDirection = "asc" | "desc";

const AutocompleteFilter = ({
  label,
  placeholder,
  value,
  onChange,
  options,
}: AutocompleteFilterProps) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const match = value ? options.find((option) => option.value === value) : null;
    setQuery(match?.label ?? "");
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) {
      return options.slice(0, 8);
    }
    return options
      .filter((option) => {
        const base = option.label.toLowerCase();
        const extra = option.sublabel?.toLowerCase() ?? "";
        return base.includes(normalizedQuery) || extra.includes(normalizedQuery);
      })
      .slice(0, 8);
  }, [normalizedQuery, options]);

  const handleSelect = (option: AutocompleteOption) => {
    setQuery(option.label);
    onChange(option.value);
    setOpen(false);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    onChange(null);
    setOpen(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && filtered[0]) {
      event.preventDefault();
      handleSelect(filtered[0]);
    }
    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 text-sm" ref={containerRef}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="relative">
        <input
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
              setOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-rose-500"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
        {open && (
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500">
                {t("admin:bookings.nothingFound")}
              </div>
            ) : (
              filtered.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(option)}
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-brand/5"
                >
                  <span className="font-medium">{option.label}</span>
                  {option.sublabel && (
                    <span className="text-[11px] text-slate-500">{option.sublabel}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const statusOptions: Array<{ key: BookingStatusKey; label: string }> = Object.entries(
  bookingStatusTheme
)
  .filter(([key]) => key !== "AwaitingRefund") // Exclude "AwaitingRefund" from regular status filter (it's a special condition filter)
  .map(([key, theme]) => ({
    key: key as BookingStatusKey,
    label: theme.label,
  }));

const AdminBookingsTable = ({
  bookings,
  loading,
  error,
  onRefresh,
  onConfirm,
  onCheckIn,
  onCheckOut,
  onCancel,
  onDelete,
  onUpdateDates,
  onAssignRoom,
  quickFilter = null,
  statusFilter = null,
  onStatusFilterChange,
}: AdminBookingsTableProps) => {
  useAuth(); // Auth context is used by child components
  const { locale } = useLocale();
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [petFilter, setPetFilter] = useState<string | null>(null);
  const [roomFilter, setRoomFilter] = useState<string | null>(null);
  const [selectedStatuses, setSelectedStatuses] = useState<BookingStatusKey[]>(() => {
    if (!statusFilter) return [];
    return Array.isArray(statusFilter) ? statusFilter : [statusFilter];
  });
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actionState, setActionState] = useState<{ type: ActionType; bookingId: string } | null>(
    null
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [, setExpandedRow] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [showFilters, setShowFilters] = useState(() => {
    // Hide filters on mobile by default
    if (typeof window !== "undefined") {
      return window.innerWidth >= 1024; // lg breakpoint
    }
    return true;
  });
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilter | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    onConfirm: () => void;
    type?: "danger" | "warning";
  } | null>(null);

  // Sync statusFilter prop with selectedStatuses
  useEffect(() => {
    if (statusFilter !== undefined) {
      const newStatuses = !statusFilter
        ? []
        : Array.isArray(statusFilter)
          ? statusFilter
          : [statusFilter];
      // Only update if different to avoid unnecessary re-renders
      setSelectedStatuses((prev) => {
        const prevStr = JSON.stringify([...prev].sort());
        const newStr = JSON.stringify([...newStatuses].sort());
        return prevStr === newStr ? prev : newStatuses;
      });
    }
  }, [statusFilter]);

  // Notify parent when status filter changes (only for manual changes, not prop changes)
  const handleStatusFilterChange = (statuses: BookingStatusKey[]) => {
    setSelectedStatuses(statuses);
    onStatusFilterChange?.(statuses.length > 0 ? statuses : null);
  };

  // Unified button styles
  const btn = {
    base: "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
    outline:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300",
    primary: "bg-brand text-white hover:bg-brand-dark shadow-sm",
    success: "bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm",
    danger: "bg-rose-500 text-white hover:bg-rose-600 shadow-sm",
  } as const;

  // Update selectedBooking when bookings are refreshed
  useEffect(() => {
    if (selectedBooking && bookings.length > 0) {
      const updatedBooking = bookings.find((b) => b.id === selectedBooking.id);
      if (updatedBooking) {
        setSelectedBooking(updatedBooking);
      }
    }
  }, [bookings, selectedBooking]);

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

  // Date parser 'YYYY-MM-DD' to local time (without timezone offset)
  const parseDateOnly = (s: string) => {
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(s);
    if (!m) return new Date(s);
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    return new Date(y, mo - 1, d, 0, 0, 0, 0);
  };
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  useEffect(() => {
    setActiveQuickFilter(quickFilter);
    setCurrentPage(1);
  }, [quickFilter]);

  const normalizedBookings = useMemo(() => {
    return bookings.map((booking) => {
      const statusKey = resolveBookingStatus(booking.status);
      const statusTheme = bookingStatusTheme[statusKey];
      const clientName = booking.client
        ? `${booking.client.lastName} ${booking.client.firstName}`
        : t("admin:bookings.unknownClient");

      const totalSegments =
        booking.isComposite && booking.childBookings && booking.childBookings.length > 0
          ? booking.childBookings.length
          : 0;
      const assignedSegments = booking.isComposite
        ? (booking.childBookings?.filter((segment) => !!segment.assignedRoomId).length ?? 0)
        : booking.assignedRoomId
          ? 1
          : 0;
      const unassignedSegments = booking.isComposite
        ? Math.max(0, totalSegments - assignedSegments)
        : booking.assignedRoomId
          ? 0
          : 1;
      const hasUnassignedRooms = unassignedSegments > 0;

      let roomPrimaryLabel: string;
      let roomMetaLabel: string | null;

      if (booking.isComposite && booking.childBookings && booking.childBookings.length > 0) {
        const firstAssignedRoom = booking.childBookings.find((segment) => segment.assignedRoom);

        roomPrimaryLabel = firstAssignedRoom?.assignedRoom
          ? `${firstAssignedRoom.assignedRoom.roomTypeName} #${firstAssignedRoom.assignedRoom.roomNumber}`
          : booking.roomTypeName;

        roomMetaLabel = t("admin:bookings.segmentsAssignedSummary", {
          assigned: assignedSegments,
          total: totalSegments,
        });
      } else {
        roomPrimaryLabel = booking.assignedRoom
          ? `${booking.assignedRoom.roomTypeName} #${booking.assignedRoom.roomNumber}`
          : booking.roomTypeName;
        roomMetaLabel = booking.assignedRoomId ? null : t("admin:bookings.roomNotAssigned");
      }

      const roomLabel = roomMetaLabel ? `${roomPrimaryLabel} • ${roomMetaLabel}` : roomPrimaryLabel;

      // For composite bookings, collect all pets from segments
      const allPets =
        booking.isComposite && booking.childBookings && booking.childBookings.length > 0
          ? booking.childBookings.flatMap((child) => child.pets || [])
          : booking.pets || [];

      // Remove duplicates by ID
      const uniquePets = Array.from(new Map(allPets.map((pet) => [pet.id, pet])).values());
      const actualPetCount = uniquePets.length;
      const petsList = uniquePets.map((pet) => pet.name).join(", ");

      return {
        ...booking,
        statusKey,
        statusTheme,
        clientName,
        roomLabel,
        roomPrimaryLabel,
        roomMetaLabel,
        assignedSegments,
        totalSegments,
        unassignedSegments,
        hasUnassignedRooms,
        petsList,
        actualPetCount,
        uniquePets,
        createdAtDate: new Date(booking.createdAt),
        checkInDateValue: parseDateOnly(booking.checkInDate),
        checkOutDateValue: parseDateOnly(booking.checkOutDate),
        searchableRoom: booking.assignedRoom
          ? `${booking.assignedRoom.roomTypeName} ${booking.assignedRoom.roomNumber}`.toLowerCase()
          : booking.roomTypeName.toLowerCase(),
        searchablePets: uniquePets.map((pet) => ({
          id: pet.id,
          name: pet.name,
          nameLower: pet.name.toLowerCase(),
        })),
      };
    });
  }, [bookings, t]);

  const clientOptions = useMemo(() => {
    const seen = new Map<string, AutocompleteOption>();
    normalizedBookings.forEach((booking) => {
      if (booking.client) {
        const key = booking.client.id;
        const label = `${booking.client.lastName} ${booking.client.firstName}`.trim();
        const sublabel = booking.client.email ?? booking.client.phone ?? undefined;
        if (!seen.has(key)) {
          seen.set(key, { value: key, label, sublabel });
        }
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [locale, normalizedBookings]);

  const roomOptions = useMemo(() => {
    const seen = new Map<string, AutocompleteOption>();
    normalizedBookings.forEach((booking) => {
      if (booking.assignedRoom) {
        const key = booking.assignedRoom.id;
        const label = `${booking.assignedRoom.roomTypeName} #${booking.assignedRoom.roomNumber}`;
        if (!seen.has(key)) {
          seen.set(key, { value: key, label, sublabel: booking.assignedRoom.roomTypeName });
        }
      }
    });
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [locale, normalizedBookings]);

  const petOptions = useMemo(() => {
    const seen = new Map<string, AutocompleteOption>();
    normalizedBookings.forEach((booking) => {
      booking.pets?.forEach((pet) => {
        if (!seen.has(pet.id)) {
          seen.set(pet.id, {
            value: pet.id,
            label: pet.name,
            sublabel: booking.clientName,
          });
        }
      });
    });
    return Array.from(seen.values()).sort((a, b) => a.label.localeCompare(b.label, locale));
  }, [locale, normalizedBookings]);

  const filteredBookings = useMemo(() => {
    const preparedSearch = search.trim().toLowerCase();
    const fromDate = from ? parseDateOnly(from) : null;
    const toDate = to ? parseDateOnly(to) : null;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    return (
      normalizedBookings
        // Hide child bookings (segments of composite bookings) - show only parent composite or simple bookings
        .filter((booking) => !booking.parentBookingId)
        .filter((booking) => {
          if (selectedStatuses.length > 0) {
            // Special handling for "AwaitingRefund" - it's not a real status but a condition (overpayment)
            const hasAwaitingRefundFilter = selectedStatuses.includes(
              "AwaitingRefund" as BookingStatusKey
            );
            const hasAwaitingPaymentFilter = selectedStatuses.includes(
              "AwaitingPayment" as BookingStatusKey
            );
            const otherStatuses = selectedStatuses.filter(
              (s) => s !== "AwaitingRefund" && s !== "AwaitingPayment"
            );
            const statusKey = booking.statusKey;

            if (hasAwaitingRefundFilter && otherStatuses.length > 0) {
              // If both "AwaitingRefund" and other statuses are selected, show bookings that match either
              // Exclude bookings where remainder is already credited to income
              if ((booking as Record<string, unknown>).overpaymentConvertedToRevenue) {
                // If remainder is credited to income, don't show in "AwaitingRefund" filter
                const matchesOtherStatus =
                  statusKey !== "AwaitingRefund" &&
                  statusKey !== "AwaitingPayment" &&
                  otherStatuses.includes(statusKey);
                if (!matchesOtherStatus) {
                  return false;
                }
              } else {
                // For composite bookings, consider payments of child segments
                // Backend mapping should account for child payments, but if paidAmount = 0, sum manually
                let paidAmount = typeof booking.paidAmount === "number" ? booking.paidAmount : 0;
                if (
                  booking.isComposite &&
                  booking.childBookings &&
                  booking.childBookings.length > 0 &&
                  paidAmount === 0
                ) {
                  // If paidAmount = 0, possibly mapping didn't work, sum child segment payments
                  const childPayments = booking.childBookings.reduce(
                    (sum: number, child: AdminBooking) => {
                      return sum + (typeof child.paidAmount === "number" ? child.paidAmount : 0);
                    },
                    0
                  );
                  paidAmount = childPayments;
                }

                const totalPrice = typeof booking.totalPrice === "number" ? booking.totalPrice : 0;
                const hasOverpayment = paidAmount > totalPrice;
                const isCancelledWithPayment = booking.statusKey === "Cancelled" && paidAmount > 0;
                const isCheckedOutOverpaid = booking.statusKey === "CheckedOut" && hasOverpayment;
                const markedAwaitingRefund = booking.statusKey === "AwaitingRefund";
                const matchesAwaitingRefund =
                  markedAwaitingRefund || isCancelledWithPayment || isCheckedOutOverpaid;
                const matchesOtherStatus =
                  statusKey !== "AwaitingRefund" &&
                  statusKey !== "AwaitingPayment" &&
                  otherStatuses.includes(statusKey);
                if (!matchesAwaitingRefund && !matchesOtherStatus) {
                  return false;
                }
              }
            } else if (hasAwaitingRefundFilter) {
              // Only "AwaitingRefund" is selected - match the logic from AdminDashboard badge count
              // Exclude bookings where remainder is already credited to income
              if ((booking as Record<string, unknown>).overpaymentConvertedToRevenue) {
                return false;
              }

              // For composite bookings, consider payments of child segments
              // Backend mapping should account for child payments, but if paidAmount = 0, sum manually
              let paidAmount = typeof booking.paidAmount === "number" ? booking.paidAmount : 0;
              if (
                booking.isComposite &&
                booking.childBookings &&
                booking.childBookings.length > 0 &&
                paidAmount === 0
              ) {
                // If paidAmount = 0, possibly mapping didn't work, sum child segment payments
                const childPayments = booking.childBookings.reduce(
                  (sum: number, child: AdminBooking) => {
                    return sum + (typeof child.paidAmount === "number" ? child.paidAmount : 0);
                  },
                  0
                );
                paidAmount = childPayments;
              }

              const totalPrice = typeof booking.totalPrice === "number" ? booking.totalPrice : 0;
              const hasOverpayment = paidAmount > totalPrice;
              const isCancelledWithPayment = booking.statusKey === "Cancelled" && paidAmount > 0;
              const isCheckedOutOverpaid = booking.statusKey === "CheckedOut" && hasOverpayment;
              const markedAwaitingRefund = booking.statusKey === "AwaitingRefund";

              // Show bookings that are: explicitly marked, cancelled with payment, or checked out with overpayment
              if (!markedAwaitingRefund && !isCancelledWithPayment && !isCheckedOutOverpaid) {
                return false;
              }
            } else if (hasAwaitingPaymentFilter) {
              // Special handling for "AwaitingPayment" - also include partially paid bookings
              const paidAmount = typeof booking.paidAmount === "number" ? booking.paidAmount : 0;
              const totalPrice = typeof booking.totalPrice === "number" ? booking.totalPrice : 0;
              const remainingAmount =
                typeof (booking as Record<string, unknown>).remainingAmount === "number"
                  ? ((booking as Record<string, unknown>).remainingAmount as number)
                  : totalPrice - paidAmount;

              // Consider bookings with "AwaitingPayment" status
              if (booking.statusKey === "AwaitingPayment") {
                return true;
              }

              // Also consider bookings with partial payment (Confirmed or CheckedIn with remaining amount)
              if (
                (booking.statusKey === "Confirmed" || booking.statusKey === "CheckedIn") &&
                remainingAmount > 0.01
              ) {
                return true;
              }

              // If other statuses are selected along with AwaitingPayment, check them too
              if (
                otherStatuses.length > 0 &&
                statusKey !== "AwaitingRefund" &&
                statusKey !== "AwaitingPayment" &&
                otherStatuses.includes(statusKey)
              ) {
                return true;
              }

              return false;
            } else if (!selectedStatuses.includes(booking.statusKey)) {
              // Regular status filtering
              return false;
            }
          }

          // Quick filters
          if (
            activeQuickFilter === "checkinToday" &&
            !isSameDay(booking.checkInDateValue, todayStart)
          ) {
            return false;
          }

          if (
            activeQuickFilter === "checkoutToday" &&
            !isSameDay(booking.checkOutDateValue, todayStart)
          ) {
            return false;
          }

          if (activeQuickFilter === "currentStay") {
            const isActiveStatus =
              booking.statusKey !== "Cancelled" && booking.statusKey !== "CheckedOut";
            const overlapsToday =
              booking.checkInDateValue <= todayEnd && booking.checkOutDateValue >= todayStart;
            if (!(isActiveStatus && overlapsToday)) {
              return false;
            }
          }

          if (fromDate && booking.checkInDateValue < fromDate) {
            return false;
          }

          if (toDate && booking.checkOutDateValue > toDate) {
            return false;
          }

          const matchesClient = clientFilter ? booking.client?.id === clientFilter : true;
          if (!matchesClient) return false;

          const matchesRoom = roomFilter ? booking.assignedRoom?.id === roomFilter : true;
          if (!matchesRoom) return false;

          const matchesPet = petFilter
            ? booking.searchablePets.some((pet) => pet.id === petFilter)
            : true;
          if (!matchesPet) return false;

          if (!preparedSearch) {
            return true;
          }

          const haystack = [
            booking.clientName,
            booking.client?.email,
            booking.client?.phone,
            booking.roomLabel,
            booking.id,
            booking.petsList,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(preparedSearch);
        })
        .sort((a, b) => {
          let result = 0;
          switch (sortField) {
            case "createdAt":
              result = a.createdAtDate.getTime() - b.createdAtDate.getTime();
              break;
            case "checkIn":
              result = a.checkInDateValue.getTime() - b.checkInDateValue.getTime();
              break;
            case "checkOut":
              result = a.checkOutDateValue.getTime() - b.checkOutDateValue.getTime();
              break;
            case "price":
              result = a.totalPrice - b.totalPrice;
              break;
            case "client":
              result = a.clientName.localeCompare(b.clientName, locale);
              break;
            case "status":
              result = a.statusKey.localeCompare(b.statusKey);
              break;
          }
          return sortDirection === "asc" ? result : -result;
        })
    );
  }, [
    normalizedBookings,
    selectedStatuses,
    search,
    from,
    to,
    clientFilter,
    roomFilter,
    petFilter,
    sortField,
    sortDirection,
    activeQuickFilter,
    locale,
  ]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (search) count++;
    if (clientFilter) count++;
    if (petFilter) count++;
    if (roomFilter) count++;
    if (from) count++;
    if (to) count++;
    if (selectedStatuses.length > 0) count++;
    return count;
  }, [search, clientFilter, petFilter, roomFilter, from, to, selectedStatuses]);

  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredBookings.slice(start, end);
  }, [filteredBookings, currentPage]);

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const unassignedBookingsCount = useMemo(
    () => filteredBookings.filter((booking) => booking.hasUnassignedRooms).length,
    [filteredBookings]
  );
  const unassignedSegmentsCount = useMemo(
    () => filteredBookings.reduce((sum, booking) => sum + booking.unassignedSegments, 0),
    [filteredBookings]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [search, clientFilter, petFilter, roomFilter, selectedStatuses, from, to]);

  const resetFilters = () => {
    setSearch("");
    handleStatusFilterChange([]);
    setFrom("");
    setTo("");
    setClientFilter(null);
    setPetFilter(null);
    setRoomFilter(null);
  };

  const toggleStatus = (status: BookingStatusKey) => {
    const newStatuses = selectedStatuses.includes(status)
      ? selectedStatuses.filter((item) => item !== status)
      : [...selectedStatuses, status];
    handleStatusFilterChange(newStatuses);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const runAction = async (type: ActionType, bookingId: string, run?: () => Promise<void>) => {
    if (!run) return;
    setActionState({ type, bookingId });
    setActionError(null);
    try {
      await run();
      setExpandedRow(null);
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setActionState(null);
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg
          className="h-3.5 w-3.5 text-slate-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
          />
        </svg>
      );
    }
    return sortDirection === "asc" ? (
      <svg className="h-3.5 w-3.5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="h-3.5 w-3.5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-900">
                {t("admin:navigation.allBookings")}
              </h2>
              {!loading && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {filteredBookings.length}
                </span>
              )}
              {!loading && unassignedBookingsCount > 0 && (
                <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                  {t("admin:bookings.unassignedRoomsSummary", {
                    bookings: unassignedBookingsCount,
                    segments: unassignedSegmentsCount,
                  })}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600">{t("admin:bookings.title")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`${btn.base} relative transition-all ${
                showFilters ? "bg-brand text-white hover:bg-brand-dark shadow-sm" : `${btn.outline}`
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              <span className="hidden sm:inline">{t("admin:bookings.filters")}</span>
              <span className="inline sm:hidden">
                {showFilters ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                )}
              </span>
              {activeFiltersCount > 0 && (
                <span
                  className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    showFilters ? "bg-white text-brand" : "bg-brand text-white"
                  }`}
                >
                  {activeFiltersCount}
                </span>
              )}
            </button>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className={`${btn.base} text-rose-600 hover:bg-rose-50`}
              >
                {t("admin:bookings.reset")}
              </button>
            )}
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className={`${btn.base} ${btn.outline}`}
            >
              <svg
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {loading ? t("admin:bookings.refreshing") : t("admin:bookings.refresh")}
            </button>
          </div>
        </div>

        {/* Active filters chips */}
        {activeFiltersCount > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">
              {t("admin:bookings.activeFilters")}:
            </span>
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="group inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand transition hover:bg-brand hover:text-white"
              >
                {t("admin:bookings.search")}: &quot;{search.slice(0, 20)}
                {search.length > 20 ? "..." : ""}&quot;
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
            {clientFilter && (
              <button
                type="button"
                onClick={() => setClientFilter(null)}
                className="group inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700 transition hover:bg-purple-600 hover:text-white"
              >
                {t("admin:bookings.client")}:{" "}
                {clientOptions.find((o) => o.value === clientFilter)?.label}
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
            {petFilter && (
              <button
                type="button"
                onClick={() => setPetFilter(null)}
                className="group inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-600 hover:text-white"
              >
                {t("admin:bookings.pet")}: {petOptions.find((o) => o.value === petFilter)?.label}
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
            {roomFilter && (
              <button
                type="button"
                onClick={() => setRoomFilter(null)}
                className="group inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-600 hover:text-white"
              >
                {t("admin:bookings.room")}: {roomOptions.find((o) => o.value === roomFilter)?.label}
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
            {from && (
              <button
                type="button"
                onClick={() => setFrom("")}
                className="group inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-600 hover:text-white"
              >
                {t("admin:payments.from")}: {from}
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
            {to && (
              <button
                type="button"
                onClick={() => setTo("")}
                className="group inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-600 hover:text-white"
              >
                {t("admin:payments.to")}: {to}
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
            {selectedStatuses.map((status) => {
              const theme = bookingStatusTheme[status];
              if (!theme) return null;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  className={`group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${theme.badgeClass} hover:opacity-80`}
                >
                  {theme.label}
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              );
            })}
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="sm:col-span-2">
                <label className="flex flex-col gap-1.5 text-sm">
                  <span className="text-xs font-medium text-slate-600">
                    {t("admin:bookings.search")}
                  </span>
                  <div className="relative">
                    <svg
                      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder={t("admin:bookings.searchPlaceholder")}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                </label>
              </div>
              <AutocompleteFilter
                label={t("admin:bookings.client")}
                placeholder={t("admin:bookings.selectClient")}
                value={clientFilter}
                onChange={setClientFilter}
                options={clientOptions}
              />
              <AutocompleteFilter
                label={t("admin:bookings.pet")}
                placeholder={t("admin:bookings.selectPet")}
                value={petFilter}
                onChange={setPetFilter}
                options={petOptions}
              />
              <AutocompleteFilter
                label={t("admin:bookings.room")}
                placeholder={t("admin:bookings.selectRoom")}
                value={roomFilter}
                onChange={setRoomFilter}
                options={roomOptions}
              />
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-xs font-medium text-slate-600">
                  {t("admin:bookings.checkInFrom")}
                </span>
                <DateInput
                  value={from}
                  onChange={(v) => setFrom(v)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="text-xs font-medium text-slate-600">
                  {t("admin:bookings.checkOutTo")}
                </span>
                <DateInput
                  value={to}
                  onChange={(v) => setTo(v)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </label>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-slate-600">
                {t("admin:bookings.status.title")}
              </span>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((option) => {
                  const theme = bookingStatusTheme[option.key];
                  const active = selectedStatuses.includes(option.key);
                  return (
                    <button
                      type="button"
                      key={option.key}
                      onClick={() => toggleStatus(option.key)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? `${theme.badgeClass} shadow-sm`
                          : "border border-slate-200 bg-white text-slate-600 hover:border-brand hover:bg-brand/5"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error messages */}
      {(error || actionError) && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
          <svg
            className="h-5 w-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{actionError ?? error}</span>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-20 text-sm text-slate-500">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent"></div>
            <span>{t("admin:bookings.loading")}</span>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <svg
              className="h-12 w-12 text-slate-300"
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
            </svg>
            <div>
              <p className="text-sm font-medium text-slate-900">
                {t("admin:bookings.noBookingsFound")}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {t("admin:bookings.tryChangingFilters")}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="block lg:hidden space-y-3">
              {paginatedBookings.map((booking) => {
                const isProcessing = actionState?.bookingId === booking.id;
                const canConfirm = booking.statusKey === "Pending" && onConfirm;
                const canCheckIn = booking.statusKey === "Confirmed" && onCheckIn;
                const canCheckOut = booking.statusKey === "CheckedIn" && onCheckOut;

                return (
                  <div
                    key={booking.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${booking.statusTheme.badgeClass}`}
                          >
                            {booking.statusTheme.label}
                          </span>
                          <span className="text-xs font-semibold text-slate-900">
                            {currency.format(booking.totalPrice)}
                          </span>
                        </div>
                        <p className="font-semibold text-slate-900 truncate">
                          {booking.clientName}
                        </p>
                        {booking.client?.email && (
                          <p className="text-xs text-slate-500 truncate">{booking.client.email}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedBooking(booking)}
                        className="flex-shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">
                          {t("admin:bookings.roomNumber")}
                        </p>
                        <p className="font-medium text-slate-900">{booking.roomPrimaryLabel}</p>
                        {booking.roomMetaLabel && (
                          <p className="text-xs text-slate-500">{booking.roomMetaLabel}</p>
                        )}
                        {booking.hasUnassignedRooms && (
                          <span className="mt-1 inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                            {t("admin:bookings.unassignedRoomsBadge", {
                              count: booking.unassignedSegments,
                            })}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">{t("admin:bookings.pets")}</p>
                        <p className="font-medium text-slate-900">
                          {booking.actualPetCount} {t("admin:bookings.pets")}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">
                          {t("admin:bookings.checkIn")}
                        </p>
                        <p className="font-medium text-slate-900">
                          {booking.checkInDateValue.toLocaleDateString(locale, {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">
                          {t("admin:bookings.checkOut")}
                        </p>
                        <p className="font-medium text-slate-900">
                          {booking.checkOutDateValue.toLocaleDateString(locale, {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                        {booking.isEarlyCheckout && booking.originalCheckOutDate && (
                          <p className="text-xs text-amber-600 mt-0.5">
                            ⏰ {t("admin:bookings.earlyCheckOut")}{" "}
                            {new Date(booking.originalCheckOutDate).toLocaleDateString(locale, {
                              day: "numeric",
                              month: "short",
                            })}
                            )
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Pets */}
                    {booking.pets && booking.pets.length > 0 && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-1">
                          {booking.pets.slice(0, 3).map((pet) => (
                            <span
                              key={pet.id}
                              className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                            >
                              {pet.name}
                            </span>
                          ))}
                          {booking.pets.length > 3 && (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                              +{booking.pets.length - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setSelectedBooking(booking)}
                        className={`flex-1 ${btn.base} ${btn.outline}`}
                      >
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        {t("admin:bookings.manage")}
                      </button>
                      {canConfirm && (
                        <button
                          type="button"
                          onClick={() =>
                            runAction("confirm", booking.id, () => onConfirm(booking.id))
                          }
                          disabled={isProcessing}
                          className={`flex-1 ${btn.base} ${btn.success}`}
                        >
                          <svg
                            className="h-3.5 w-3.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          {t("admin:bookings.confirm")}
                        </button>
                      )}
                      {canCheckIn && (
                        <button
                          type="button"
                          onClick={() =>
                            runAction("check-in", booking.id, () => onCheckIn(booking.id))
                          }
                          disabled={isProcessing}
                          className={`flex-1 ${btn.base} ${btn.primary}`}
                        >
                          {t("admin:bookings.checkInAction")}
                        </button>
                      )}
                      {canCheckOut && (
                        <button
                          type="button"
                          onClick={() =>
                            runAction("check-out", booking.id, () => onCheckOut(booking.id))
                          }
                          disabled={isProcessing}
                          className={`flex-1 ${btn.base} ${btn.primary}`}
                        >
                          {t("admin:bookings.checkOutAction")}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => handleSort("status")}
                        className="group inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-brand"
                      >
                        {t("admin:table.status")}
                        <SortIcon field="status" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => handleSort("client")}
                        className="group inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-brand"
                      >
                        {t("admin:bookings.client")}
                        <SortIcon field="client" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {t("admin:bookings.roomNumber")}
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => handleSort("checkIn")}
                        className="group inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-brand"
                      >
                        {t("admin:bookings.checkIn")}
                        <SortIcon field="checkIn" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => handleSort("checkOut")}
                        className="group inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-brand"
                      >
                        {t("admin:bookings.checkOut")}
                        <SortIcon field="checkOut" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {t("admin:bookings.pets")}
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => handleSort("price")}
                        className="group inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-brand"
                      >
                        {t("admin:table.price")}
                        <SortIcon field="price" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                        {t("admin:table.actions")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {paginatedBookings.map((booking) => {
                    const isProcessing = actionState?.bookingId === booking.id;
                    const canConfirm = booking.statusKey === "Pending" && onConfirm;
                    const canCheckIn = booking.statusKey === "Confirmed" && onCheckIn;
                    const canCheckOut = booking.statusKey === "CheckedIn" && onCheckOut;
                    const paidAmount =
                      typeof booking.paidAmount === "number" ? booking.paidAmount : 0;
                    const remainingAmount =
                      typeof booking.remainingAmount === "number" ? booking.remainingAmount : 0;
                    const overpaymentConvertedToRevenue = Boolean(
                      booking.overpaymentConvertedToRevenue
                    );
                    const revenueConversionAmount =
                      typeof booking.revenueConversionAmount === "number"
                        ? booking.revenueConversionAmount
                        : 0;

                    return (
                      <tr key={booking.id} className="group hover:bg-slate-50/50 transition">
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${booking.statusTheme.badgeClass}`}
                          >
                            {booking.statusTheme.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-slate-900">{booking.clientName}</span>
                            {booking.client?.email && (
                              <span className="text-xs text-slate-500">{booking.client.email}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-900">
                                {booking.roomPrimaryLabel}
                              </span>
                              {booking.isComposite && (
                                <span
                                  className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700"
                                  title={t("admin:bookings.compositeBooking")}
                                >
                                  <svg
                                    className="h-3 w-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                                    />
                                  </svg>
                                  {booking.childBookings?.length || 0}{" "}
                                  {t("admin:bookings.segments")}
                                </span>
                              )}
                            </div>
                            {booking.roomMetaLabel && (
                              <span className="text-xs text-slate-500">
                                {booking.roomMetaLabel}
                              </span>
                            )}
                            {booking.hasUnassignedRooms && (
                              <span className="inline-flex w-fit items-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                                {t("admin:bookings.unassignedRoomsBadge", {
                                  count: booking.unassignedSegments,
                                })}
                              </span>
                            )}
                            <span className="text-xs text-slate-500">
                              {t("admin:bookings.petCount", { count: booking.actualPetCount })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-slate-900">
                              {booking.checkInDateValue.toLocaleDateString(locale, {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                            <span className="text-xs text-slate-500">
                              {booking.checkInDateValue.toLocaleTimeString(locale, {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-slate-900">
                              {booking.checkOutDateValue.toLocaleDateString(locale, {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                            <span className="text-xs text-slate-500">
                              {t("admin:common.nightsPlural", { count: booking.numberOfNights })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {booking.uniquePets.slice(0, 2).map((pet) => (
                              <span
                                key={pet.id}
                                className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
                              >
                                {pet.name}
                              </span>
                            ))}
                            {booking.uniquePets.length > 2 && (
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                                +{booking.uniquePets.length - 2}
                              </span>
                            )}
                            {booking.uniquePets.length === 0 && (
                              <span className="text-xs text-slate-400">
                                {t("admin:bookings.noPets")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {/* Base cost */}
                            <div className="font-semibold text-slate-900 text-sm">
                              {currency.format(booking.totalPrice)}
                            </div>

                            {/* Financial summary */}
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                              {/* Paid */}
                              {paidAmount > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-emerald-600 font-medium">
                                  <svg
                                    className="h-3 w-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                  {currency.format(paidAmount)}
                                </span>
                              )}

                              {/* Remaining payment */}
                              {remainingAmount > 0 && (
                                <span className="inline-flex items-center gap-0.5 text-orange-600 font-medium">
                                  <svg
                                    className="h-3 w-3"
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
                                  {currency.format(remainingAmount)}
                                </span>
                              )}

                              {/* Overpayment */}
                              {remainingAmount < 0 && (
                                <span className="inline-flex items-center gap-0.5 text-rose-600 font-medium">
                                  <svg
                                    className="h-3 w-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  {currency.format(Math.abs(remainingAmount))}
                                </span>
                              )}

                              {/* Credited to income */}
                              {overpaymentConvertedToRevenue && (
                                <span className="inline-flex items-center gap-0.5 text-emerald-700 font-medium">
                                  <svg
                                    className="h-3 w-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  {t("admin:bookings.toRevenue")}{" "}
                                  {currency.format(revenueConversionAmount)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {canConfirm && (
                              <button
                                type="button"
                                onClick={() =>
                                  runAction("confirm", booking.id, () => onConfirm(booking.id))
                                }
                                disabled={isProcessing}
                                className={`${btn.base} ${btn.success}`}
                                title={t("admin:bookings.confirm")}
                              >
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </button>
                            )}
                            {canCheckIn && (
                              <button
                                type="button"
                                onClick={() =>
                                  runAction("check-in", booking.id, () => onCheckIn(booking.id))
                                }
                                disabled={isProcessing}
                                className={`${btn.base} ${btn.primary}`}
                                title={t("admin:bookings.checkInAction")}
                              >
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                                  />
                                </svg>
                              </button>
                            )}
                            {canCheckOut && (
                              <button
                                type="button"
                                onClick={() =>
                                  runAction("check-out", booking.id, () => onCheckOut(booking.id))
                                }
                                disabled={isProcessing}
                                className={`${btn.base} ${btn.primary}`}
                                title={t("admin:bookings.checkOutAction")}
                              >
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                                  />
                                </svg>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedBooking(booking)}
                              className={`${btn.base} ${btn.outline}`}
                              title={t("admin:bookings.manage")}
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                            </button>
                            {/* Cancel Button - show for non-cancelled and non-checked-out bookings */}
                            {onCancel &&
                              booking.statusKey !== "Cancelled" &&
                              booking.statusKey !== "CheckedOut" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmAction({
                                      message: `${t("admin:actions.cancelBooking")} ${t("admin:bookings.client").toLowerCase()} ${booking.clientName}?`,
                                      onConfirm: () =>
                                        runAction("cancel", booking.id, () => onCancel(booking.id)),
                                      type: "warning",
                                    })
                                  }
                                  disabled={isProcessing}
                                  className={`${btn.base} border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100`}
                                  title={t("admin:actions.cancelBooking")}
                                >
                                  <svg
                                    className="h-3.5 w-3.5"
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
                                </button>
                              )}
                            {/* Delete Button - show for all bookings with strong warning */}
                            {onDelete && (
                              <button
                                type="button"
                                onClick={() =>
                                  setConfirmAction({
                                    message: `${t("admin:bookings.deleteBookingConfirm", { bookingId: booking.id, clientName: booking.clientName })}\n\n${t("admin:bookings.deleteBookingConfirm2")}`,
                                    onConfirm: () =>
                                      runAction("delete", booking.id, () => onDelete(booking.id)),
                                    type: "danger",
                                  })
                                }
                                disabled={isProcessing}
                                className={`${btn.base} ${btn.danger}`}
                                title={t("admin:actions.deleteBooking")}
                              >
                                <svg
                                  className="h-3.5 w-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedBooking(booking)}
                              className={`${btn.base} ${btn.outline}`}
                              title={t("admin:bookings.details")}
                            >
                              <svg
                                className="h-3.5 w-3.5"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-4 sm:px-6 py-4">
                <div className="text-xs sm:text-sm text-slate-600 text-center sm:text-left">
                  <span className="hidden sm:inline">{t("admin:bookings.showing")} </span>
                  <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>-
                  <span className="font-medium">
                    {Math.min(currentPage * itemsPerPage, filteredBookings.length)}
                  </span>
                  <span className="hidden sm:inline"> {t("admin:bookings.ofTotal")} </span>
                  <span className="inline sm:hidden">/</span>
                  <span className="font-medium">{filteredBookings.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`${btn.base} ${btn.outline}`}
                    aria-label="Previous page"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>

                  {/* Desktop: Full pagination */}
                  <div className="hidden md:flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        if (totalPages <= 7) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                        return false;
                      })
                      .map((page, idx, arr) => {
                        const prevPage = arr[idx - 1];
                        const showEllipsis = prevPage && page - prevPage > 1;
                        return (
                          <div key={page} className="flex items-center gap-1">
                            {showEllipsis && <span className="px-2 text-slate-400">...</span>}
                            <button
                              type="button"
                              onClick={() => setCurrentPage(page)}
                              className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-medium transition ${
                                page === currentPage
                                  ? "bg-brand text-white shadow-sm"
                                  : "text-slate-600 hover:bg-slate-100"
                              }`}
                            >
                              {page}
                            </button>
                          </div>
                        );
                      })}
                  </div>

                  {/* Mobile: Current page indicator */}
                  <div className="flex md:hidden items-center gap-2 px-3 py-1 bg-white rounded-lg border border-slate-200">
                    <span className="text-sm font-medium text-slate-700">{currentPage}</span>
                    <span className="text-xs text-slate-400">/</span>
                    <span className="text-sm text-slate-500">{totalPages}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`${btn.base} ${btn.outline}`}
                    aria-label="Next page"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Unified Booking Modal */}
      {selectedBooking && (
        <Suspense
          fallback={
            <div className="flex items-center justify-center p-4">
              {t("admin:bookings.loadingModal")}
            </div>
          }
        >
          <UnifiedBookingModal
            booking={selectedBooking}
            isOpen={!!selectedBooking}
            onClose={() => setSelectedBooking(null)}
            onUpdate={onRefresh}
            onConfirm={onConfirm}
            onCheckIn={onCheckIn}
            onCheckOut={onCheckOut}
            onCancel={onCancel}
            onDelete={onDelete}
            onUpdateDates={onUpdateDates}
            onAssignRoom={onAssignRoom}
          />
        </Suspense>
      )}

      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.onConfirm()}
        message={confirmAction?.message ?? ""}
        type={confirmAction?.type ?? "warning"}
        zIndex={350}
      />
    </div>
  );
};

export default AdminBookingsTable;
