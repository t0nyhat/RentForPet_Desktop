import { useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { useTranslation } from "react-i18next";
import useLocale from "../hooks/useLocale";
import AdminManualBookingForm, {
  type ManualBookingPayload,
} from "../components/admin/AdminManualBookingForm";
import { AdminBooking } from "../components/admin/AdminPendingBookings";
import AdminPaymentsHistory, { type Payment } from "../components/admin/AdminPaymentsHistory";
import AdminRoomsManager, { type AdminRoom } from "../components/admin/AdminRoomsManager";
import AdminRoomTypesManager, {
  type AdminRoomType,
} from "../components/admin/AdminRoomTypesManager";
import AdminAvailableRooms from "../components/admin/AdminAvailableRooms";

// Lazy load large components for better code splitting
const AdminSchedule = lazy(() => import("../components/admin/AdminSchedule"));
const AdminBookingsTable = lazy(() => import("../components/admin/AdminBookingsTable"));
import type { QuickFilter } from "../components/admin/AdminBookingsTable";
import AdminClientsPanel from "../components/admin/AdminClientsPanel";
import AdminBookingSettings from "../components/admin/AdminBookingSettings";
import AdminSystemPanel from "../components/admin/AdminSystemPanel";
import AdminFeedbackPanel from "../components/admin/AdminFeedbackPanel";
import { Layout } from "../components/layout/Layout";
import { SidebarGroup } from "../components/layout/Sidebar";
import { useAuth } from "../context/AuthContext";
import ConfirmModal from "../components/ConfirmModal";
import { useQueryApi } from "../hooks/useQueryApi";
import { useQueryClient } from "@tanstack/react-query";
import { resolveBookingStatus, type BookingStatusKey } from "../constants/bookingStatusTheme";
import { useRealtime } from "../context/RealtimeContext";
import {
  ClockIcon,
  ClipboardDocumentListIcon,
  PencilSquareIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  HomeModernIcon,
  BuildingOffice2Icon,
  Squares2X2Icon,
  HomeIcon,
  CurrencyDollarIcon,
  ArrowPathRoundedSquareIcon,
  PlusIcon,
  ArrowDownOnSquareIcon,
  ArrowUpOnSquareIcon,
  HeartIcon,
  QuestionMarkCircleIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

type RoomDto = AdminRoom;

type AdminClientDto = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string | null;
  internalNotes?: string | null;
  loyaltyDiscountPercent?: number;
  pets: Array<{
    id: string;
    clientId: string;
    name: string;
    species: number;
    gender: number;
    breed?: string | null;
    birthDate?: string | null;
    ageYears?: number | null;
    weight?: number | null;
    color?: string | null;
    microchip?: string | null;
    specialNeeds?: string | null;
    photoUrl?: string | null; // route to backend streaming
    isActive: boolean;
    createdAt: string;
    internalNotes?: string | null;
  }>;
};

const createRange = () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  // Initially show month (until same date next month)
  to.setMonth(to.getMonth() + 1);
  return { from, to };
};

const AdminDashboard = () => {
  const { t } = useTranslation(["admin", "common", "booking"]);
  const { locale, formatCurrency } = useLocale();
  const { user, isAuthenticated, authFetch, isLoading } = useAuth();
  const isAdmin = user?.role === "Admin";
  const { subscribe } = useRealtime();
  const queryClient = useQueryClient();

  // No automatic redirect - users can access admin dashboard directly

  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const [scheduleRefreshKey, setScheduleRefreshKey] = useState(0);
  const [bookingsRefreshKey, setBookingsRefreshKey] = useState(0);
  const [roomsRefreshKey, setRoomsRefreshKey] = useState(0);
  const [roomTypesRefreshKey, setRoomTypesRefreshKey] = useState(0);
  const [clientsRefreshKey, setClientsRefreshKey] = useState(0);
  const [tableQuickFilter, setTableQuickFilter] = useState<QuickFilter | null>(null);
  const [tableStatusFilter, setTableStatusFilter] = useState<BookingStatusKey[] | null>(null);
  const [range, setRange] = useState(createRange);
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "schedule"
    | "manual"
    | "rooms"
    | "available-rooms"
    | "room-types"
    | "table"
    | "clients"
    | "history"
    | "settings"
    | "feedback"
    | "system"
  >("overview");
  const isFirstRender = useRef(true);
  const isInitialRoomTypesLoad = useRef(true);
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    onConfirm: () => void;
    type?: "danger" | "warning";
  } | null>(null);
  // Local state for room types to avoid refetching after photo operations
  const [localRoomTypes, setLocalRoomTypes] = useState<AdminRoomType[]>([]);

  // All payments history - migrated to React Query
  const allPaymentsState = useQueryApi<Payment[]>(
    isAuthenticated && isAdmin ? "/api/admin/payments" : null,
    { authorized: true, dependencies: [historyRefreshKey] }
  );

  const scheduleQuery = useMemo(() => {
    if (!isAuthenticated || !isAdmin) return null;
    const params = new URLSearchParams();
    params.set("from", range.from.toISOString());
    params.set("to", range.to.toISOString());
    return `/api/admin/bookings?${params.toString()}`;
  }, [range, isAuthenticated, isAdmin]);

  const scheduleBookingsState = useQueryApi<AdminBooking[]>(scheduleQuery, {
    authorized: true,
    dependencies: [scheduleQuery, scheduleRefreshKey],
  });

  const roomsState = useQueryApi<RoomDto[]>(isAuthenticated && isAdmin ? "/api/rooms" : null, {
    authorized: true,
    dependencies: [roomsRefreshKey],
  });
  const roomTypesState = useQueryApi<AdminRoomType[]>(
    isAuthenticated && isAdmin ? "/api/room-types/all" : null,
    { authorized: true, dependencies: [roomTypesRefreshKey] }
  );
  const allBookingsState = useQueryApi<AdminBooking[]>(
    isAuthenticated && isAdmin ? "/api/admin/bookings" : null,
    { authorized: true, dependencies: [bookingsRefreshKey] }
  );
  const clientsState = useQueryApi<AdminClientDto[]>(
    isAuthenticated && isAdmin ? "/api/admin/clients" : null,
    { authorized: true, dependencies: [clientsRefreshKey] }
  );

  // On logout reset all keys to 0
  useEffect(() => {
    if (!isAuthenticated) {
      setHistoryRefreshKey(0);
      setScheduleRefreshKey(0);
      setBookingsRefreshKey(0);
      setRoomsRefreshKey(0);
      setRoomTypesRefreshKey(0);
      setClientsRefreshKey(0);
      setTableQuickFilter(null);
      isFirstRender.current = true;
    }
  }, [isAuthenticated]);

  // Sync local room types with API state when it changes
  // On initial load, sync immediately
  // After that, sync when refreshKey changes (after create/update/delete operations)
  useEffect(() => {
    if (roomTypesState.status === "success" && roomTypesState.data) {
      if (isInitialRoomTypesLoad.current) {
        setLocalRoomTypes(roomTypesState.data);
        isInitialRoomTypesLoad.current = false;
      } else if (roomTypesRefreshKey > 0) {
        // After operations (create/update/delete), sync with server data
        setLocalRoomTypes(roomTypesState.data);
      }
    }
  }, [roomTypesState.status, roomTypesState.data, roomTypesRefreshKey]);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return;

    const unsubscribes = [
      subscribe("BookingCreated", () => {
        // Invalidate React Query cache
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              typeof key[0] === "string" &&
              key[0].includes("/api/admin/bookings")
            );
          },
        });
        // Keep refresh keys for backward compatibility
        setBookingsRefreshKey((prev) => prev + 1);
        setScheduleRefreshKey((prev) => prev + 1);
      }),
      subscribe("BookingUpdated", () => {
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              typeof key[0] === "string" &&
              (key[0].includes("/api/admin/bookings") || key[0].includes("/api/admin/payments"))
            );
          },
        });
        setBookingsRefreshKey((prev) => prev + 1);
        setHistoryRefreshKey((prev) => prev + 1);
        setScheduleRefreshKey((prev) => prev + 1);
      }),
      subscribe("PaymentReceived", () => {
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey;
            return (
              Array.isArray(key) &&
              typeof key[0] === "string" &&
              (key[0].includes("/api/admin/payments") || key[0].includes("/api/admin/bookings"))
            );
          },
        });
        setHistoryRefreshKey((prev) => prev + 1);
        setBookingsRefreshKey((prev) => prev + 1);
      }),
    ];

    return () => unsubscribes.forEach((u) => u());
  }, [isAuthenticated, isAdmin, subscribe, queryClient]);

  // Update data when switching between tabs
  // IMPORTANT: on first render (login or page reload) URL change
  // from null to string automatically triggers loading in useApi, so
  // we DON'T increment refreshKeys to not cancel first requests
  useEffect(() => {
    // Skip first render - data will load via URL change
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    switch (activeTab) {
      case "overview":
        // On return to overview update all data
        setBookingsRefreshKey((prev) => prev + 1);
        setRoomsRefreshKey((prev) => prev + 1);
        setClientsRefreshKey((prev) => prev + 1);
        break;
      case "history":
        setHistoryRefreshKey((prev) => prev + 1);
        break;
      case "schedule":
        setScheduleRefreshKey((prev) => prev + 1);
        break;
      case "table":
        setBookingsRefreshKey((prev) => prev + 1);
        break;
      case "rooms":
        setRoomsRefreshKey((prev) => prev + 1);
        break;
      case "available-rooms":
        setRoomsRefreshKey((prev) => prev + 1);
        break;
      case "room-types":
        setRoomTypesRefreshKey((prev) => prev + 1);
        break;
      case "clients":
        setClientsRefreshKey((prev) => prev + 1);
        break;
    }
  }, [activeTab]);

  const performAndRefresh = async <T,>(fn: () => Promise<T>) => {
    const response = await fn();
    // Increase delay to give server time to process update and update DB
    await new Promise((resolve) => setTimeout(resolve, 500));
    setScheduleRefreshKey((prev) => prev + 1);
    setBookingsRefreshKey((prev) => prev + 1);
    return response;
  };

  const confirmBooking = async (bookingId: string) => {
    const response = await authFetch(`/api/admin/bookings/${bookingId}/confirm`, {
      method: "POST",
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody?.error ?? "Failed to confirm booking");
    }
    // Update all related data to refresh badges
    setHistoryRefreshKey((prev) => prev + 1);
    setScheduleRefreshKey((prev) => prev + 1);
    setBookingsRefreshKey((prev) => prev + 1);
  };

  const checkInBooking = async (bookingId: string) => {
    await performAndRefresh(async () => {
      const response = await authFetch(`/api/admin/bookings/${bookingId}/check-in`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error ?? "Failed to check in booking");
      }
      return response;
    });
  };

  const checkOutBooking = async (bookingId: string) => {
    // First check if this is early checkout
    try {
      const calcResponse = await authFetch(
        `/api/admin/bookings/${bookingId}/calculate-early-checkout`
      );
      if (calcResponse.ok) {
        const calculation = await calcResponse.json();

        if (calculation.isEarlyCheckout) {
          const confirmMessage =
            `${t("admin:earlyCheckoutConfirm.title")}\n\n` +
            `${t("admin:earlyCheckoutConfirm.daysStayed", { stayed: calculation.nightsStayed, total: calculation.totalNights })}\n` +
            `${t("admin:earlyCheckoutConfirm.amountForStayed", { amount: formatCurrency(calculation.amountForStayedNights) })}\n` +
            `${t("admin:earlyCheckoutConfirm.refundAmount", { amount: formatCurrency(calculation.refundAmount) })}\n\n` +
            `${t("admin:earlyCheckoutConfirm.continueQuestion")}`;

          setConfirmAction({
            message: confirmMessage,
            type: "warning",
            onConfirm: () => doCheckOut(bookingId),
          });
          return;
        }
      }
    } catch (err) {
      console.warn("Failed to calculate early checkout:", err);
    }

    await doCheckOut(bookingId);
  };

  const doCheckOut = async (bookingId: string) => {
    await performAndRefresh(async () => {
      const response = await authFetch(`/api/admin/bookings/${bookingId}/check-out`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error ?? "Failed to check out booking");
      }
      return response;
    });
  };

  const deleteBooking = async (bookingId: string) => {
    await performAndRefresh(async () => {
      const response = await authFetch(`/api/admin/bookings/${bookingId}`, { method: "DELETE" });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error ?? "Failed to delete booking");
      }
      return response;
    });
  };

  const cancelBooking = async (bookingId: string) => {
    await performAndRefresh(async () => {
      const response = await authFetch(`/api/admin/bookings/${bookingId}/cancel`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error ?? "Failed to cancel booking");
      }
      return response;
    });
  };

  const updateBookingDates = async (
    bookingId: string,
    checkInDate: string,
    checkOutDate: string
  ) => {
    await performAndRefresh(async () => {
      const response = await authFetch(`/api/admin/bookings/${bookingId}/dates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkInDate, checkOutDate }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error ?? "Failed to change dates");
      }
      return response;
    });
  };

  const assignRoom = async (bookingId: string, roomId: string) => {
    await performAndRefresh(async () => {
      const response = await authFetch(`/api/admin/bookings/${bookingId}/assign-room`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        const errorMessage = errorBody?.error ?? "Failed to assign room";
        console.error("Error assigning room:", errorMessage, errorBody);
        throw new Error(errorMessage);
      }
      return response;
    });
  };

  const updateBookingRoomAndDates = async (
    bookingId: string,
    roomId: string,
    checkInDate: string,
    checkOutDate: string
  ) => {
    await performAndRefresh(async () => {
      const response = await authFetch(`/api/admin/bookings/${bookingId}/room-and-dates`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, checkInDate, checkOutDate }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody?.error ?? "Failed to update room and dates");
      }
      return response;
    });
  };

  const createManualBooking = async (payload: ManualBookingPayload) => {
    const response = await authFetch("/api/admin/bookings/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody?.error ?? "Failed to create booking");
    }

    setHistoryRefreshKey((prev) => prev + 1);
    setScheduleRefreshKey((prev) => prev + 1);
    setBookingsRefreshKey((prev) => prev + 1);
  };

  const createRoom = async (payload: {
    roomNumber: string;
    roomTypeId: string;
    floor?: number | null;
    specialNotes?: string | null;
  }): Promise<string> => {
    const response = await authFetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody?.error ?? "Failed to create room");
    }
    const created = await response.json().catch(() => null as Record<string, unknown> | null);
    setRoomsRefreshKey((prev) => prev + 1);
    return created?.id ?? "";
  };

  const updateRoom = async (
    roomId: string,
    payload: {
      roomNumber: string;
      roomTypeId: string;
      floor?: number | null;
      specialNotes?: string | null;
    }
  ) => {
    const response = await authFetch(`/api/rooms/${roomId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody?.error ?? "Failed to update room");
    }
    setRoomsRefreshKey((prev) => prev + 1);
  };

  const deleteRoom = async (roomId: string) => {
    const response = await authFetch(`/api/rooms/${roomId}`, { method: "DELETE" });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody?.error ?? "Failed to delete room");
    }
    setRoomsRefreshKey((prev) => prev + 1);
  };

  // Room Types management functions
  const createRoomType = async (payload: {
    name: string;
    description: string;
    maxCapacity: number;
    pricePerNight: number;
    pricePerAdditionalPet: number;
    squareMeters: number;
    features: string[];
    isActive: boolean;
  }): Promise<string> => {
    const response = await authFetch("/api/room-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody?.error ?? errorBody?.message ?? "Failed to create room type");
    }
    const created = await response.json().catch(() => null);
    if (!created || !created.id) {
      throw new Error("Server did not return created room type ID");
    }

    // Update localRoomTypes by adding the new room type
    setLocalRoomTypes((prev) => {
      const newRoomType: AdminRoomType = {
        id: String(created.id),
        name: created.name ?? payload.name,
        description: created.description ?? payload.description,
        maxCapacity: created.maxCapacity ?? payload.maxCapacity,
        pricePerNight: created.pricePerNight ?? payload.pricePerNight,
        pricePerAdditionalPet: created.pricePerAdditionalPet ?? payload.pricePerAdditionalPet,
        squareMeters: created.squareMeters ?? payload.squareMeters,
        features: created.features ?? payload.features,
        isActive: created.isActive ?? payload.isActive,
      };
      return [...prev, newRoomType];
    });

    setRoomTypesRefreshKey((prev) => prev + 1);
    return String(created.id);
  };

  const updateRoomType = async (
    roomTypeId: string,
    payload: {
      name: string;
      description: string;
      maxCapacity: number;
      pricePerNight: number;
      pricePerAdditionalPet: number;
      squareMeters: number;
      features: string[];
      isActive: boolean;
    }
  ) => {
    const response = await authFetch(`/api/room-types/${roomTypeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody?.error ?? "Failed to update room type");
    }
    setRoomTypesRefreshKey((prev) => prev + 1);
  };

  const deleteRoomType = async (roomTypeId: string) => {
    const response = await authFetch(`/api/room-types/${roomTypeId}`, { method: "DELETE" });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody?.error ?? "Failed to delete room type");
    }
    setRoomTypesRefreshKey((prev) => prev + 1);
  };

  // Calculate data from states (before early return!)
  const scheduleBookingsRaw = scheduleBookingsState.data ?? [];
  const scheduleBookings = scheduleBookingsRaw.filter(
    (booking) => resolveBookingStatus(booking.status) !== "Cancelled"
  );

  const rooms = roomsState.data ?? [];
  const roomTypes = localRoomTypes.length > 0 ? localRoomTypes : (roomTypesState.data ?? []);
  const clients = useMemo<AdminClientDto[]>(() => clientsState.data ?? [], [clientsState.data]);
  const allBookings = useMemo<AdminBooking[]>(() => {
    // Return all bookings without excluding cancelled ones
    // Status exclusions are handled below in specific metrics/widgets
    return allBookingsState.data ?? [];
  }, [allBookingsState.data]);
  const pendingCount = allBookings.filter((b) => {
    const statusKey = resolveBookingStatus(b.status);
    return statusKey === "Pending" && !b.parentBookingId;
  }).length;
  const awaitingPaymentCount = allBookings.filter((b) => {
    const statusKey = resolveBookingStatus(b.status);
    const paidAmount = (b as AdminBooking & { paidAmount?: number }).paidAmount || 0;
    const totalPrice = b.totalPrice || 0;
    const remainingAmount =
      (b as AdminBooking & { remainingAmount?: number }).remainingAmount ?? totalPrice - paidAmount;

    // Include bookings with "AwaitingPayment" status
    if (statusKey === "AwaitingPayment") {
      return true;
    }

    // Also include bookings with partial payment (Confirmed or CheckedIn with remaining balance)
    if ((statusKey === "Confirmed" || statusKey === "CheckedIn") && remainingAmount > 0.01) {
      return true;
    }

    return false;
  }).length;
  const awaitingRefundCount = allBookings.filter((b) => {
    // Exclude child bookings (segments of composite bookings)
    if (b.parentBookingId) {
      return false;
    }

    // Exclude bookings where remaining balance was already credited to income
    if (
      (b as AdminBooking & { overpaymentConvertedToRevenue?: boolean })
        .overpaymentConvertedToRevenue
    ) {
      return false;
    }

    // For composite bookings include child segment payments
    // Backend mapping should include child payments, but if paidAmount = 0, sum manually
    let paidAmount = (b as AdminBooking & { paidAmount?: number }).paidAmount || 0;
    if (b.isComposite && b.childBookings && b.childBookings.length > 0 && paidAmount === 0) {
      // If paidAmount = 0, mapping might have failed, sum child segment payments
      const childPayments = b.childBookings.reduce((sum: number, child: AdminBooking) => {
        return sum + (child.paidAmount || 0);
      }, 0);
      paidAmount = childPayments;
    }

    const totalPrice = b.totalPrice || 0;
    const statusKey = resolveBookingStatus(b.status);
    const hasOverpayment = paidAmount > totalPrice;
    const isCancelledWithPayment = statusKey === "Cancelled" && paidAmount > 0;
    const isCheckedOutOverpaid = statusKey === "CheckedOut" && hasOverpayment;
    const markedAwaitingRefund = statusKey === "AwaitingRefund";
    // Count refunds for explicit status, cancelled paid bookings, and overpaid early checkouts
    return markedAwaitingRefund || isCancelledWithPayment || isCheckedOutOverpaid;
  }).length;
  const today = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
  }, []);
  const isSameDay = useCallback(
    (dateStr: string) => {
      const d = new Date(dateStr);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    },
    [today]
  );
  const checkinsToday = allBookings.filter((b) => isSameDay(b.checkInDate)).length;
  const checkoutsToday = allBookings.filter((b) => isSameDay(b.checkOutDate)).length;
  const currentPets = allBookings
    .filter((b) => {
      const start = new Date(b.checkInDate);
      const end = new Date(b.checkOutDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      const statusKey = resolveBookingStatus(b.status);
      return (
        start <= today && end >= today && statusKey !== "Cancelled" && statusKey !== "CheckedOut"
      );
    })
    .reduce((sum, b) => sum + (b.numberOfPets || b.pets?.length || 0), 0);

  const scheduleError =
    scheduleBookingsState.status === "error" ? scheduleBookingsState.error : null;
  const clientsError = clientsState.status === "error" ? clientsState.error : null;
  const roomsError = roomsState.status === "error" ? roomsState.error : null;
  const allBookingsError = allBookingsState.status === "error" ? allBookingsState.error : null;

  const sidebarIcons = useMemo(
    () => ({
      overview: <Squares2X2Icon className="h-5 w-5" />,
      schedule: <CalendarDaysIcon className="h-5 w-5" />,
      history: <ClockIcon className="h-5 w-5" />,
      table: <ClipboardDocumentListIcon className="h-5 w-5" />,
      manual: <PencilSquareIcon className="h-5 w-5" />,
      roomTypes: <BuildingOffice2Icon className="h-5 w-5" />,
      rooms: <HomeModernIcon className="h-5 w-5" />,
      availableRooms: <ArrowDownOnSquareIcon className="h-5 w-5" />,
      clients: <UserGroupIcon className="h-5 w-5" />,
      settings: <HomeIcon className="h-5 w-5" />,
      system: <WrenchScrewdriverIcon className="h-5 w-5" />,
      feedback: <HeartIcon className="h-5 w-5" />,
      help: <QuestionMarkCircleIcon className="h-5 w-5" />,
    }),
    []
  );

  const quickStats = useMemo(
    () => [
      {
        id: "rooms",
        label: t("admin:overview.totalRooms"),
        value: rooms.length,
        accent: "bg-brand-light",
        icon: <HomeIcon className="h-4 w-4 text-brand-dark" />,
      },
      {
        id: "pending",
        label: t("admin:overview.pendingRequests"),
        value: pendingCount,
        accent: "bg-amber-100",
        icon: <ArrowPathRoundedSquareIcon className="h-4 w-4 text-amber-600" />,
      },
      {
        id: "bookings",
        label: t("admin:overview.totalBookings"),
        value: allBookings.length,
        accent: "bg-blue-100",
        icon: <ClipboardDocumentListIcon className="h-4 w-4 text-blue-600" />,
      },
      {
        id: "clients",
        label: t("admin:overview.activeClients"),
        value: clients.length,
        accent: "bg-purple-100",
        icon: <UserGroupIcon className="h-4 w-4 text-purple-600" />,
      },
    ],
    [rooms.length, pendingCount, allBookings.length, clients.length, t]
  );

  const quickActions = useMemo(
    () => [
      {
        id: "manual",
        label: t("booking:create.title"),
        icon: <PlusIcon className="h-5 w-5 text-brand" />,
        gradient: "from-brand-light to-brand/20",
        tab: "manual" as typeof activeTab,
      },
      {
        id: "schedule",
        label: t("admin:navigation.schedule"),
        icon: <CalendarDaysIcon className="h-5 w-5 text-blue-600" />,
        gradient: "from-blue-50 to-blue-100",
        tab: "schedule" as typeof activeTab,
      },
    ],
    [t]
  );

  const quickOverviewCards = useMemo(
    () => [
      {
        id: "checkins",
        label: t("admin:overview.checkInsToday"),
        value: checkinsToday,
        icon: <ArrowDownOnSquareIcon className="h-5 w-5 text-emerald-600" />,
        onClick: () => {
          setTableQuickFilter("checkinToday");
          setActiveTab("table");
        },
      },
      {
        id: "checkouts",
        label: t("admin:overview.checkOutsToday"),
        value: checkoutsToday,
        icon: <ArrowUpOnSquareIcon className="h-5 w-5 text-amber-600" />,
        onClick: () => {
          setTableQuickFilter("checkoutToday");
          setActiveTab("table");
        },
      },
      {
        id: "current-pets",
        label: t("admin:overview.petsNow"),
        value: currentPets,
        icon: <HeartIcon className="h-5 w-5 text-rose-500" />,
        onClick: () => {
          setTableQuickFilter("currentStay");
          setActiveTab("table");
        },
      },
    ],
    [checkinsToday, checkoutsToday, currentPets, t]
  );

  const formatDateShort = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString(locale, { day: "2-digit", month: "short" });

  const arrivingToday = useMemo(() => {
    return allBookings
      .filter((b) => {
        const statusKey = resolveBookingStatus(b.status);
        return (
          isSameDay(b.checkInDate) &&
          statusKey !== "CheckedIn" &&
          statusKey !== "CheckedOut" &&
          statusKey !== "Cancelled"
        );
      })
      .map((b) => ({
        id: b.id,
        roomLabel:
          b.assignedRoom?.roomNumber || b.room?.roomNumber || b.room?.roomType || "No room",
        checkOutDate: b.checkOutDate,
        totalPrice: b.totalPrice,
        petsCount: b.numberOfPets || b.pets?.length || 1,
      }));
  }, [allBookings, isSameDay]);

  const departingToday = useMemo(() => {
    return allBookings
      .filter((b) => {
        const statusKey = resolveBookingStatus(b.status);
        return isSameDay(b.checkOutDate) && statusKey !== "CheckedOut" && statusKey !== "Cancelled";
      })
      .map((b) => ({
        id: b.id,
        roomLabel:
          b.assignedRoom?.roomNumber || b.room?.roomNumber || b.room?.roomType || "No room",
        checkInDate: b.checkInDate,
        totalPrice: b.totalPrice,
        petsCount: b.numberOfPets || b.pets?.length || 1,
      }));
  }, [allBookings, isSameDay]);

  const occupancy = useMemo(() => {
    const active = allBookings.filter((b) => {
      const start = new Date(b.checkInDate);
      const end = new Date(b.checkOutDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      const statusKey = resolveBookingStatus(b.status);
      return (
        start <= today && end >= today && statusKey !== "Cancelled" && statusKey !== "CheckedOut"
      );
    });
    const usedRooms = new Set(
      active
        .map((b) => b.assignedRoom?.id || b.assignedRoomId || b.room?.id)
        .filter((id): id is string => Boolean(id))
    ).size;
    const roomsTotal = rooms.length;
    const percentRooms =
      roomsTotal > 0 ? Math.min(100, Math.round((usedRooms / roomsTotal) * 100)) : 0;
    return { usedRooms, roomsTotal, percentRooms, currentPets };
  }, [allBookings, rooms.length, today, currentPets]);

  const weekSchedule = useMemo(() => {
    const base: Date[] = [];
    const startDay = new Date();
    startDay.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(startDay);
      d.setDate(startDay.getDate() + i);
      base.push(d);
    }

    const isSameDayDate = (dateA: Date, dateStr: string) => {
      const d = new Date(dateStr);
      return (
        d.getFullYear() === dateA.getFullYear() &&
        d.getMonth() === dateA.getMonth() &&
        d.getDate() === dateA.getDate()
      );
    };

    return base.map((d) => {
      const arrivals = allBookings.filter((b) => {
        const statusKey = resolveBookingStatus(b.status);
        return isSameDayDate(d, b.checkInDate) && statusKey !== "Cancelled";
      }).length;
      const departures = allBookings.filter((b) => {
        const statusKey = resolveBookingStatus(b.status);
        return isSameDayDate(d, b.checkOutDate) && statusKey !== "Cancelled";
      }).length;
      const staying = allBookings.filter((b) => {
        const start = new Date(b.checkInDate);
        const end = new Date(b.checkOutDate);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        const statusKey = resolveBookingStatus(b.status);
        return start <= d && end >= d && statusKey !== "Cancelled";
      }).length;

      return {
        label: d.toLocaleDateString(locale, { weekday: "short", day: "2-digit" }),
        arrivals,
        departures,
        staying,
      };
    });
  }, [allBookings, locale]);

  // Sidebar navigation - use useMemo to update when data changes
  const sidebarGroups: SidebarGroup[] = useMemo(
    () => [
      {
        items: [
          {
            id: "overview",
            label: t("admin:navigation.overview"),
            icon: sidebarIcons.overview,
            onClick: () => setActiveTab("overview"),
          },
        ],
      },
      {
        label: t("admin:groups.bookings"),
        items: [
          {
            id: "schedule",
            label: t("admin:navigation.schedule"),
            icon: sidebarIcons.schedule,
            onClick: () => setActiveTab("schedule"),
          },
          {
            id: "table",
            label: t("admin:navigation.allBookings"),
            icon: sidebarIcons.table,
            onClick: () => {
              setTableStatusFilter(null);
              setActiveTab("table");
            },
          },
          {
            id: "history",
            label: t("admin:navigation.paymentHistory"),
            icon: sidebarIcons.history,
            onClick: () => setActiveTab("history"),
          },
          {
            id: "manual",
            label: t("admin:navigation.createManual"),
            icon: sidebarIcons.manual,
            onClick: () => setActiveTab("manual"),
          },
        ],
      },
      {
        label: t("admin:groups.management"),
        items: [
          {
            id: "room-types",
            label: t("admin:navigation.roomTypes"),
            icon: sidebarIcons.roomTypes,
            onClick: () => setActiveTab("room-types"),
          },
          {
            id: "rooms",
            label: t("admin:navigation.rooms"),
            icon: sidebarIcons.rooms,
            onClick: () => setActiveTab("rooms"),
          },
          {
            id: "available-rooms",
            label: t("admin:navigation.availableRooms"),
            icon: sidebarIcons.availableRooms,
            onClick: () => setActiveTab("available-rooms"),
          },
          {
            id: "clients",
            label: t("admin:navigation.clients"),
            icon: sidebarIcons.clients,
            onClick: () => setActiveTab("clients"),
          },
          {
            id: "settings",
            label: t("admin:navigation.bookingSettings"),
            icon: sidebarIcons.settings,
            onClick: () => setActiveTab("settings"),
          },
          {
            id: "system",
            label: t("admin:navigation.system"),
            icon: sidebarIcons.system,
            onClick: () => setActiveTab("system"),
          },
          {
            id: "feedback",
            label: t("admin:navigation.feedback"),
            icon: sidebarIcons.feedback,
            onClick: () => setActiveTab("feedback"),
          },
          {
            id: "help",
            label: t("admin:navigation.help"),
            icon: sidebarIcons.help,
            path: "/help",
          },
        ],
      },
    ],
    [sidebarIcons, t]
  );

  // Authentication checks AFTER all hooks
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand"></div>
      </div>
    );
  }

  // Standalone mode: always allow admin panel access

  const scheduleSection = (
    <>
      {scheduleError && (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {scheduleError}
        </div>
      )}
      <Suspense
        fallback={
          <div className="flex items-center justify-center p-8">
            {t("admin:overview.loadingSchedule")}
          </div>
        }
      >
        <AdminSchedule
          rooms={rooms}
          bookings={scheduleBookings}
          allBookings={allBookings}
          range={range}
          loading={scheduleBookingsState.status === "loading"}
          onRangeChange={setRange}
          onRefresh={() => {
            setScheduleRefreshKey((prev) => prev + 1);
            setBookingsRefreshKey((prev) => prev + 1);
          }}
          onConfirmBooking={confirmBooking}
          onCancelBooking={cancelBooking}
          onCheckInBooking={checkInBooking}
          onCheckOutBooking={checkOutBooking}
          onUpdateDates={async (id, checkIn, checkOut) => {
            await updateBookingDates(id, checkIn, checkOut);
          }}
          onAssignRoom={assignRoom}
          onUpdateRoomAndDates={updateBookingRoomAndDates}
        />
      </Suspense>
    </>
  );

  return (
    <Layout sidebarGroups={sidebarGroups} noPadding={activeTab === "schedule"}>
      {activeTab === "schedule" ? (
        <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden">{scheduleSection}</div>
      ) : (
        <div className="space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-4 md:space-y-6">
              {/* Mobile compact layout: everything on one screen, no horizontal scroll */}
              <div className="md:hidden space-y-3">
                <h1 className="text-2xl font-bold text-gray-900">{t("admin:overview.title")}</h1>
                <div className="grid grid-cols-2 gap-2">
                  {quickStats.map((stat) => (
                    <div
                      key={stat.id}
                      className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3"
                    >
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.accent}`}
                      >
                        <span className="text-xl">{stat.icon}</span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">{stat.label}</p>
                        <p className="text-xl font-bold text-gray-900 leading-tight">
                          {stat.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {quickOverviewCards.map((card) => (
                    <button
                      key={card.id}
                      onClick={card.onClick}
                      className="rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:shadow transition flex items-center gap-3"
                    >
                      <span className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                        {card.icon}
                      </span>
                      <div>
                        <p className="text-xs text-slate-500">{card.label}</p>
                        <p className="text-xl font-bold text-slate-900">{card.value}</p>
                      </div>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {quickActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={() => setActiveTab(action.tab)}
                      className={`p-3 rounded-lg text-left bg-gradient-to-br ${action.gradient} border border-gray-100 shadow-sm hover:shadow md:hover:shadow-lg transition`}
                    >
                      <span className="text-lg block mb-1">{action.icon}</span>
                      <p className="text-sm font-semibold text-gray-900 leading-tight">
                        {action.label}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Desktop / tablet layout */}
              <div className="hidden md:flex md:flex-col md:space-y-6">
                <h1 className="text-3xl font-bold text-gray-900">
                  {t("admin:overview.adminPanel")}
                </h1>

                {/* Quick Stats */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h2 className="text-xl font-semibold text-gray-900">
                      {t("admin:overview.summary")}
                    </h2>
                    <span className="text-sm text-gray-500">
                      {t("admin:overview.updatedAt", {
                        time: new Date().toLocaleTimeString(locale),
                      })}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {quickStats.map((stat) => (
                      <div
                        key={stat.id}
                        className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs uppercase font-semibold tracking-wide text-gray-500">
                              {stat.label}
                            </p>
                            <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                          </div>
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.accent}`}
                          >
                            <span className="text-2xl">{stat.icon}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {quickOverviewCards.map((card) => (
                      <button
                        key={card.id}
                        onClick={card.onClick}
                        className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:shadow-md transition flex items-center gap-3"
                      >
                        <span className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                          {card.icon}
                        </span>
                        <div>
                          <p className="text-sm text-slate-500">{card.label}</p>
                          <p className="text-3xl font-bold text-slate-900 mt-1">{card.value}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">
                        {t("admin:overview.quickActions")}
                      </h2>
                      <p className="text-sm text-gray-500">
                        {t("admin:overview.quickActionsDesc")}
                      </p>
                    </div>
                    <button
                      className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-dark transition"
                      onClick={() => setActiveTab("table")}
                    >
                      {t("admin:overview.goToJournal")}
                      <span aria-hidden>→</span>
                    </button>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {quickActions.map((action) => (
                      <button
                        key={action.id}
                        onClick={() => setActiveTab(action.tab)}
                        className={`p-4 text-left rounded-xl transition-all border border-transparent bg-gradient-to-br ${action.gradient} hover:translate-y-[-2px] hover:shadow-lg ${action.id === "assistant" ? "border-amber-100" : ""
                          }`}
                      >
                        <span className="text-2xl mb-2 block">{action.icon}</span>
                        <p className="font-semibold text-gray-900">{action.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {t("admin:overview.checkInsToday")}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {t("admin:overview.awaitingGuests")}
                        </p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                        {arrivingToday.length}
                      </span>
                    </div>
                    {arrivingToday.length === 0 ? (
                      <p className="text-sm text-slate-500">{t("admin:overview.noCheckIns")}</p>
                    ) : (
                      <ul className="space-y-2">
                        {arrivingToday.map((b) => (
                          <li
                            key={b.id}
                            className="rounded-xl border border-slate-100 p-3 flex items-center justify-between gap-3"
                          >
                            <div>
                              <p className="font-semibold text-slate-900">№ {b.roomLabel}</p>
                              <p className="text-xs text-slate-500">
                                {formatDateShort(b.checkOutDate)} • {b.petsCount}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-900">
                                {formatCurrency(b.totalPrice ?? 0)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {t("admin:overview.paymentForPeriod")}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {t("admin:overview.checkOutsToday")}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {t("admin:overview.notCheckedOut")}
                        </p>
                      </div>
                      <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                        {departingToday.length}
                      </span>
                    </div>
                    {departingToday.length === 0 ? (
                      <p className="text-sm text-slate-500">{t("admin:overview.noCheckOuts")}</p>
                    ) : (
                      <ul className="space-y-2">
                        {departingToday.map((b) => (
                          <li
                            key={b.id}
                            className="rounded-xl border border-slate-100 p-3 flex items-center justify-between gap-3"
                          >
                            <div>
                              <p className="font-semibold text-slate-900">№ {b.roomLabel}</p>
                              <p className="text-xs text-slate-500">
                                {formatDateShort(b.checkInDate)} • {b.petsCount}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-slate-900">
                                {formatCurrency(b.totalPrice ?? 0)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {t("admin:overview.paymentForPeriod")}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {t("admin:overview.hotelOccupancy")}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {t("admin:overview.byAssignedRooms")}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-slate-700">
                        {occupancy.percentRooms}% ({occupancy.usedRooms}/
                        {occupancy.roomsTotal || "?"})
                      </span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand to-brand-dark"
                        style={{ width: `${occupancy.percentRooms}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-sm text-slate-600">
                      <span>
                        {t("admin:overview.petsNowCount", { count: occupancy.currentPets })}
                      </span>
                      <span>
                        {t("admin:overview.roomsOccupied", { count: occupancy.usedRooms })}
                      </span>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {t("admin:overview.weekCalendar")}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {t("admin:overview.weekCalendarDesc")}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {weekSchedule.map((d) => (
                        <div
                          key={d.label}
                          className="rounded-xl border border-slate-100 p-3 bg-slate-50"
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {d.label}
                          </p>
                          <div className="mt-2 space-y-1 text-sm text-slate-700">
                            <p>
                              {t("admin:overview.checkIns")}:{" "}
                              <span className="font-semibold">{d.arrivals}</span>
                            </p>
                            <p>
                              {t("admin:overview.checkOuts")}:{" "}
                              <span className="font-semibold">{d.departures}</span>
                            </p>
                            <p>
                              {t("admin:overview.inHotel")}:{" "}
                              <span className="font-semibold">{d.staying}</span>
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <AdminPaymentsHistory
              payments={allPaymentsState.data || []}
              loading={allPaymentsState.status === "loading"}
              error={allPaymentsState.error}
            />
          )}

          {activeTab === "manual" && (
            <>
              {clientsError && (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {clientsError}
                </div>
              )}
              <AdminManualBookingForm
                clients={clients}
                roomTypes={roomTypes}
                onCreate={createManualBooking}
                authFetch={authFetch}
              />
            </>
          )}

          {activeTab === "room-types" && (
            <AdminRoomTypesManager
              roomTypes={roomTypes}
              loading={roomTypesState.status === "loading"}
              refreshKey={roomTypesRefreshKey}
              onCreate={createRoomType}
              onUpdate={updateRoomType}
              onDelete={deleteRoomType}
            />
          )}

          {activeTab === "rooms" && (
            <>
              {roomsError && (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {roomsError}
                </div>
              )}
              <AdminRoomsManager
                rooms={rooms}
                roomTypes={roomTypes}
                loading={roomsState.status === "loading"}
                onCreate={createRoom}
                onUpdate={updateRoom}
                onDelete={deleteRoom}
              />
            </>
          )}

          {activeTab === "available-rooms" && <AdminAvailableRooms authFetch={authFetch} />}

          {activeTab === "clients" && (
            <AdminClientsPanel
              clients={clients}
              loading={clientsState.status === "loading"}
              onRefresh={() => setClientsRefreshKey((prev) => prev + 1)}
            />
          )}

          {activeTab === "table" && (
            <>
              {/* Quick Status Filters */}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-600">
                  {t("admin:overview.quickFiltersLabel")}
                </span>
                <button
                  onClick={() => setTableStatusFilter(null)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${!tableStatusFilter || tableStatusFilter.length === 0
                    ? "bg-brand text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                >
                  {t("admin:quickFilters.all")}
                </button>
                <button
                  onClick={() => setTableStatusFilter(["Pending"])}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${tableStatusFilter?.includes("Pending")
                    ? "bg-amber-500 text-white"
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                    }`}
                >
                  <ClockIcon className="h-3.5 w-3.5" />
                  {t("admin:quickFilters.requests")}
                  {pendingCount > 0 && (
                    <span className="ml-1 rounded-full bg-amber-600 px-1.5 py-0.5 text-[10px] text-white">
                      {pendingCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setTableStatusFilter(["AwaitingPayment"])}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${tableStatusFilter?.includes("AwaitingPayment")
                    ? "bg-blue-500 text-white"
                    : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                    }`}
                >
                  <CurrencyDollarIcon className="h-3.5 w-3.5" />
                  {t("admin:quickFilters.awaitingPayment")}
                  {awaitingPaymentCount > 0 && (
                    <span className="ml-1 rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] text-white">
                      {awaitingPaymentCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setTableStatusFilter(["AwaitingRefund"])}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${tableStatusFilter?.includes("AwaitingRefund")
                    ? "bg-rose-500 text-white"
                    : "bg-rose-50 text-rose-700 hover:bg-rose-100"
                    }`}
                >
                  <ArrowPathRoundedSquareIcon className="h-3.5 w-3.5" />
                  {t("admin:quickFilters.awaitingRefund")}
                  {awaitingRefundCount > 0 && (
                    <span className="ml-1 rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] text-white">
                      {awaitingRefundCount}
                    </span>
                  )}
                </button>
              </div>

              {allBookingsError && (
                <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
                  {allBookingsError}
                </div>
              )}
              <Suspense
                fallback={
                  <div className="flex items-center justify-center p-8">
                    {t("admin:overview.loadingTable")}
                  </div>
                }
              >
                <AdminBookingsTable
                  bookings={allBookings}
                  loading={allBookingsState.status === "loading"}
                  onRefresh={() => setBookingsRefreshKey((prev) => prev + 1)}
                  onConfirm={confirmBooking}
                  onCheckIn={checkInBooking}
                  onCheckOut={checkOutBooking}
                  onCancel={cancelBooking}
                  onDelete={deleteBooking}
                  onUpdateDates={updateBookingDates}
                  onAssignRoom={assignRoom}
                  quickFilter={tableQuickFilter}
                  statusFilter={tableStatusFilter}
                  onStatusFilterChange={setTableStatusFilter}
                />
              </Suspense>
            </>
          )}

          {activeTab === "settings" && <AdminBookingSettings />}

          {activeTab === "system" && <AdminSystemPanel />}

          {activeTab === "feedback" && <AdminFeedbackPanel />}
        </div>
      )}
      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.onConfirm()}
        message={confirmAction?.message ?? ""}
        type={confirmAction?.type ?? "warning"}
        zIndex={9999}
      />
    </Layout>
  );
};

export default AdminDashboard;
