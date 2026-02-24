import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import Modal from "./Modal";
import ConfirmModal from "./ConfirmModal";
import type { AdminBooking } from "./admin/AdminPendingBookings";
import ReceiptModal, { type ReceiptDto } from "./ReceiptModal";
import DateInput from "./DateInput";
import { getSpeciesOptions, getGenderOptions } from "../constants/pet";
import { getBookingStatusTheme, resolveBookingStatus } from "../constants/bookingStatusTheme";
import useLocale from "../hooks/useLocale";
import { BookingSettings, BookingCalculationMode, getUnitName } from "../types/booking";
import {
  ClipboardDocumentListIcon,
  CreditCardIcon,
  CogIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  CalendarDaysIcon,
  HomeModernIcon,
  UserGroupIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ArrowPathRoundedSquareIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

type UnifiedBookingModalProps = {
  booking: AdminBooking | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: () => void;
  // Action callbacks
  onConfirm?: (bookingId: string) => Promise<void>;
  onCheckIn?: (bookingId: string) => Promise<void>;
  onCheckOut?: (bookingId: string) => Promise<void>;
  onCancel?: (bookingId: string) => Promise<void>;
  onDelete?: (bookingId: string) => Promise<void>;
  onUpdateDates?: (bookingId: string, checkInDate: string, checkOutDate: string) => Promise<void>;
  onAssignRoom?: (bookingId: string, roomId: string) => Promise<void>;
  // Available rooms for assignment
  availableRooms?: Array<{
    id: string;
    roomNumber: string;
    roomTypeId: string;
    floor?: number | null;
    specialNotes?: string | null;
    isActive: boolean;
  }>;
};

type Tab = "details" | "actions" | "payments";

type Payment = {
  id: string;
  bookingId: string;
  amount: number;
  paymentMethod: number;
  paymentStatus: number;
  paymentType: number;
  prepaymentPercentage?: number;
  transactionId?: string;
  paidAt?: string;
  paymentProof?: string;
  adminComment?: string;
  confirmedAt?: string;
  confirmedByAdminId?: string;
  createdAt: string;
};

type BookingWithPrepayment = AdminBooking & {
  prepaymentCancelled?: boolean;
};

type Room = {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  floor?: number | null;
  specialNotes?: string | null;
  isActive: boolean;
};

const paymentMethodKeys: Record<number, string> = {
  0: "card",
  1: "cash",
  2: "online",
  3: "qr",
  4: "phoneTransfer",
};

const paymentStatusColors: Record<number, string> = {
  0: "text-amber-600 bg-amber-50",
  1: "text-emerald-600 bg-emerald-50",
  2: "text-rose-600 bg-rose-50",
  3: "text-slate-600 bg-slate-50",
};

const paymentStatusKeys: Record<number, string> = {
  0: "pending",
  1: "completed",
  2: "failed",
  3: "refunded",
};

const paymentTypeKeys: Record<number, string> = {
  0: "prepayment",
  1: "fullPayment",
};

const paymentMethodToNumber: Record<string, number> = {
  Cash: 1,
  Card: 0,
  Online: 2,
  QrCode: 3,
  PhoneTransfer: 4,
};

const paymentTypeToNumber: Record<string, number> = {
  Prepayment: 0,
  FullPayment: 1,
};

const UnifiedBookingModal = ({
  booking: bookingProp,
  isOpen,
  onClose,
  onUpdate,
  onConfirm,
  onCheckIn,
  onCheckOut,
  onCancel,
  onDelete,
  onUpdateDates,
  onAssignRoom,
  availableRooms = [],
}: UnifiedBookingModalProps) => {
  const { t } = useTranslation(["booking", "common"]);
  const { locale } = useLocale();
  const { authFetch, user } = useAuth();

  const [bookingState, setBookingState] = useState<AdminBooking | null>(null);
  const booking = bookingState ?? bookingProp;

  useEffect(() => {
    // Don't override bookingState if we're in the middle of a check-in/check-out operation
    if (!skipTabResetRef.current) {
      setBookingState(bookingProp ?? null);
    }
  }, [bookingProp]);

  // Reset flags when modal closes
  useEffect(() => {
    if (!isOpen) {
      skipTabResetRef.current = false;
      skipTabResetForPaymentRef.current = false;
      previousBookingIdRef.current = null;
      setLocalRemainingAmount(null);
      setBookingState(null);
      setActiveTab("details");
      setError(null);
      setSuccess(null);
      setReceiptOpen(false);
      setReceipt(null);
      setPendingActionKey(null);
      setPendingActionLabel(null);
    }
  }, [isOpen]);

  // Localized payment names
  const getPaymentMethodName = useCallback(
    (method: number) => {
      const key = paymentMethodKeys[method] || "other";
      return t(`booking:paymentMethods.${key}`);
    },
    [t]
  );

  const getPaymentStatusName = useCallback(
    (status: number) => {
      const key = paymentStatusKeys[status] || "pending";
      return t(`booking:paymentStatuses.${key}`);
    },
    [t]
  );

  const getPaymentTypeName = useCallback(
    (type: number) => {
      const key = paymentTypeKeys[type] || "fullPayment";
      return t(`booking:paymentTypes.${key}`);
    },
    [t]
  );
  const [activeTab, setActiveTab] = useState<Tab>("details");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    message: string;
    onConfirm: () => void;
    type?: "danger" | "warning" | "info";
  } | null>(null);
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null);
  const [pendingActionLabel, setPendingActionLabel] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const skipTabResetRef = useRef(false);
  const skipTabResetForPaymentRef = useRef(false);
  const previousBookingIdRef = useRef<string | null>(null);

  // Date editing
  const [editCheckIn, setEditCheckIn] = useState("");
  const [editCheckOut, setEditCheckOut] = useState("");

  // Room assignment
  const [selectedRoomForAssignment, setSelectedRoomForAssignment] = useState<string>("");
  const [localAvailableRooms, setLocalAvailableRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Segment room assignment (for composite bookings)
  const [segmentRooms, setSegmentRooms] = useState<Record<string, Room[]>>({});
  const [selectedSegmentRooms, setSelectedSegmentRooms] = useState<Record<string, string>>({});
  const [loadingSegmentRooms, setLoadingSegmentRooms] = useState<Record<string, boolean>>({});

  // Payment form
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [paymentType, setPaymentType] = useState<string>("Prepayment");
  const [paymentComment, setPaymentComment] = useState("");
  const [localRemainingAmount, setLocalRemainingAmount] = useState<number | null>(null);

  // Refund/Transfer
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [editingRefundAmount, setEditingRefundAmount] = useState(false);
  const [customRefundAmount, setCustomRefundAmount] = useState<string>("");
  const [transferTargetBooking, setTransferTargetBooking] = useState<string>("");
  const [targetBookings, setTargetBookings] = useState<AdminBooking[]>([]);
  const [customTransferAmount, setCustomTransferAmount] = useState<string>("");

  // Prepayment amount editing
  const [editingPrepaymentAmount, setEditingPrepaymentAmount] = useState(false);
  const [prepaymentAmountInput, setPrepaymentAmountInput] = useState<string>("");
  const [savingPrepaymentAmount, setSavingPrepaymentAmount] = useState(false);

  // Receipt
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptDto | null>(null);

  // Booking settings (Days vs Nights mode)
  const [bookingSettings, setBookingSettings] = useState<BookingSettings | null>(null);

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

  // Discount
  const [discountInput, setDiscountInput] = useState<number>(0);
  const [savingDiscount, setSavingDiscount] = useState(false);

  // Pet modal
  const [selectedPet, setSelectedPet] = useState<{
    id: string;
    name: string;
    species: number;
    gender: number;
  } | null>(null);
  const [selectedPetDetails, setSelectedPetDetails] = useState<{
    id: string;
    name: string;
    species: string;
    breed: string;
    gender: number;
    color?: string | null;
    weight?: number | null;
    ageYears?: number | null;
    microchip?: string | null;
    specialNeeds?: string | null;
  } | null>(null);
  const [selectedPetPhoto, setSelectedPetPhoto] = useState<string | null>(null);
  const [petDetailsLoading, setPetDetailsLoading] = useState(false);
  const [petDetailsError, setPetDetailsError] = useState<string | null>(null);

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

  // Get status info
  const statusKey = booking ? resolveBookingStatus(booking.status) : null;
  const statusTheme = statusKey ? getBookingStatusTheme(statusKey) : undefined;

  // Collect all pets (for composite bookings, from child segments)
  const allPets = useMemo(() => {
    if (!booking) return [];
    if (booking.isComposite && booking.childBookings && booking.childBookings.length > 0) {
      const pets = booking.childBookings.flatMap((child) => child.pets || []);
      return Array.from(new Map(pets.map((pet) => [pet.id, pet])).values());
    }
    return booking.pets || [];
  }, [booking]);

  // Can add items check
  // const canAddItems = booking && statusKey !== "CheckedOut" && statusKey !== "Cancelled"; // Unused

  // Calculate finances
  const paidAmount = booking?.paidAmount || 0;
  // Use localRemainingAmount if it was set after a payment, otherwise calculate from booking
  const remainingAmount =
    localRemainingAmount !== null
      ? localRemainingAmount
      : booking?.remainingAmount || (booking?.totalPrice || 0) - paidAmount;
  const overpayment = Math.max(0, paidAmount - (booking?.totalPrice || 0));
  const additionalPetsPrice = booking?.additionalPetsPrice ?? 0;
  const discountAmount = booking?.discountAmount ?? 0;
  const resolvedBasePrice = booking
    ? typeof booking.basePrice === "number"
      ? booking.basePrice
      : Math.max(0, (booking.totalPrice || 0) + discountAmount - additionalPetsPrice)
    : 0;

  // Stay calculation breakdown
  const numberOfNights = booking?.numberOfNights ?? 0;
  const roomPricePerUnit = numberOfNights > 0 ? resolvedBasePrice / numberOfNights : 0;
  const maxCapacity = booking?.roomType?.maxCapacity ?? 1;
  const numberOfAdditionalPets = Math.max(0, (booking?.numberOfPets ?? 0) - maxCapacity);
  const unitLabel = getUnitName(bookingSettings?.calculationMode ?? BookingCalculationMode.Days, 1);
  const progressPercent =
    booking && booking.totalPrice > 0
      ? Math.round((paidAmount / booking.totalPrice) * 100)
      : paidAmount > 0
        ? 100
        : 0;
  const progressWidth =
    booking && booking.totalPrice > 0
      ? Math.min((paidAmount / booking.totalPrice) * 100, 100)
      : paidAmount > 0
        ? 100
        : 0;
  const isCancelled = statusKey === "Cancelled";
  const availableForRefund = isCancelled ? paidAmount : overpayment;
  const prepaymentCancelled =
    (booking as BookingWithPrepayment | null)?.prepaymentCancelled ?? false;
  const paymentStats = useMemo(() => {
    let paid = 0;
    let pending = 0;
    let refunded = 0;
    let failed = 0;
    const byMethod: Record<string, { count: number; amount: number }> = {};
    let lastPaidAt: string | null = null;

    for (const p of payments) {
      const amt = p.amount || 0;
      const methodName = getPaymentMethodName(p.paymentMethod);
      byMethod[methodName] = byMethod[methodName] || { count: 0, amount: 0 };
      byMethod[methodName].count += 1;
      byMethod[methodName].amount += amt;

      switch (p.paymentStatus) {
        case 1:
          paid += amt;
          if (p.paidAt) {
            if (!lastPaidAt || new Date(p.paidAt) > new Date(lastPaidAt)) {
              lastPaidAt = p.paidAt;
            }
          }
          break;
        case 0:
          pending += amt;
          break;
        case 3:
          refunded += amt;
          break;
        case 2:
          failed += amt;
          break;
        default:
          break;
      }
    }

    return { paid, pending, refunded, failed, byMethod, lastPaidAt };
  }, [payments, getPaymentMethodName]);

  // Initialize form values when booking changes (only from bookingProp, not from bookingState updates)
  useEffect(() => {
    if (bookingProp) {
      const isBookingChanged = previousBookingIdRef.current !== bookingProp.id;
      previousBookingIdRef.current = bookingProp.id;

      // Don't update form fields if we're in the middle of a check-in/check-out operation or payment
      // This prevents UI "jitter" when parent updates bookingProp after API call
      if (!skipTabResetRef.current && !skipTabResetForPaymentRef.current) {
        setEditCheckIn(bookingProp.checkInDate.slice(0, 10));
        setEditCheckOut(bookingProp.checkOutDate.slice(0, 10));
        setSelectedRoomForAssignment(bookingProp.assignedRoomId || "");
        setDiscountInput(bookingProp.discountPercent ?? bookingProp.loyaltyDiscountPercent ?? 0);

        // Initialize payment amount: use requiredPrepaymentAmount for first payment, otherwise remainingAmount
        const currentPaidAmount = bookingProp.paidAmount || 0;
        const currentRemainingAmount =
          bookingProp.remainingAmount || (bookingProp.totalPrice || 0) - currentPaidAmount;
        const requiredPrepayment =
          (bookingProp as { requiredPrepaymentAmount?: number }).requiredPrepaymentAmount ||
          Math.round(bookingProp.totalPrice * 0.3);
        const defaultPaymentAmount =
          currentPaidAmount > 0
            ? currentRemainingAmount
            : Math.min(requiredPrepayment, currentRemainingAmount);
        setPaymentAmount(currentRemainingAmount > 0 ? defaultPaymentAmount.toString() : "");

        // Reset payment/refund states
        setEditingRefundAmount(false);
        setCustomRefundAmount("");
        setEditingPrepaymentAmount(false);
        setPrepaymentAmountInput("");
        setTransferTargetBooking("");
        setCustomTransferAmount("");
        setTargetBookings([]);
      }

      // If room not assigned and can be assigned, open "Actions" tab
      // Compute statusKey locally to avoid dependency on it
      const bookingStatusKey = bookingProp ? resolveBookingStatus(bookingProp.status) : null;
      const needsRoomAssignment =
        !bookingProp.assignedRoomId &&
        onAssignRoom &&
        (bookingStatusKey === "Pending" ||
          bookingStatusKey === "Confirmed" ||
          bookingStatusKey === "AwaitingPayment");

      // Only change tab when opening a different booking, otherwise keep current tab
      // so edits/payments do not force user back to the first tab.
      if (isBookingChanged && !skipTabResetRef.current && !skipTabResetForPaymentRef.current) {
        // If booking is CheckedIn or CheckedOut, keep the current tab (likely "actions")
        if (bookingStatusKey !== "CheckedIn" && bookingStatusKey !== "CheckedOut") {
          setActiveTab(needsRoomAssignment ? "actions" : "details");
        }
      }

      // Always clear error/success when booking changes
      setError(null);
      setSuccess(null);
    }
  }, [bookingProp, onAssignRoom]);

  // Reset local remaining amount only when switching to a different booking
  useEffect(() => {
    setLocalRemainingAmount(null);
  }, [bookingProp?.id]);

  // Memoized handlers for date inputs
  const handleCheckInChange = useCallback((value: string) => {
    setEditCheckIn(value);
  }, []);

  const handleCheckOutChange = useCallback((value: string) => {
    setEditCheckOut(value);
  }, []);

  const fetchPayments = useCallback(async () => {
    if (!booking) {
      return;
    }
    try {
      const response = await authFetch(`/api/payments/booking/${booking.id}`);
      if (response.ok) {
        const data = await response.json();
        setPayments(data);
      } else {
        console.error(
          "[UnifiedBookingModal] ❌ Error fetching payments:",
          response.status,
          response.statusText
        );
      }
    } catch (err) {
      console.error("[UnifiedBookingModal] ❌ Exception fetching payments:", err);
    }
  }, [booking, authFetch]);

  // Load payments
  useEffect(() => {
    if (isOpen && booking) {
      fetchPayments();
    }
  }, [isOpen, booking, fetchPayments]);

  // Load available rooms for simple bookings
  useEffect(() => {
    if (!booking || booking.isComposite || !onAssignRoom) {
      setLocalAvailableRooms([]);
      return;
    }

    const loadRooms = async () => {
      setLoadingRooms(true);
      try {
        const params = new URLSearchParams({
          roomTypeId: booking.roomTypeId,
          checkIn: booking.checkInDate,
          checkOut: booking.checkOutDate,
        });
        const response = await authFetch(`/api/rooms/available?${params.toString()}`);
        if (response.ok) {
          const rooms = await response.json();
          setLocalAvailableRooms(rooms);
        }
      } catch (err) {
        console.error("Error loading rooms:", err);
      } finally {
        setLoadingRooms(false);
      }
    };

    loadRooms();
  }, [booking, authFetch, onAssignRoom]);

  const loadSegmentRoomsForBooking = useCallback(
    async (targetBooking: AdminBooking) => {
      if (!targetBooking.isComposite || !targetBooking.childBookings || !onAssignRoom) {
        setSegmentRooms({});
        setSelectedSegmentRooms({});
        setLoadingSegmentRooms({});
        return;
      }

      const loadingMap: Record<string, boolean> = {};
      const selectedMap: Record<string, string> = {};

      for (const segment of targetBooking.childBookings) {
        loadingMap[segment.id] = true;
        selectedMap[segment.id] = segment.assignedRoomId || "";
      }

      setLoadingSegmentRooms(loadingMap);
      setSelectedSegmentRooms(selectedMap);

      const roomsMap: Record<string, Room[]> = {};

      await Promise.all(
        targetBooking.childBookings.map(async (segment) => {
          try {
            const params = new URLSearchParams({
              roomTypeId: segment.roomTypeId,
              checkIn: segment.checkInDate,
              checkOut: segment.checkOutDate,
            });
            const response = await authFetch(`/api/rooms/available?${params.toString()}`);
            roomsMap[segment.id] = response.ok ? await response.json() : [];
          } catch {
            roomsMap[segment.id] = [];
          } finally {
            loadingMap[segment.id] = false;
          }
        })
      );

      setSegmentRooms(roomsMap);
      setLoadingSegmentRooms({ ...loadingMap });
    },
    [authFetch, onAssignRoom]
  );

  // Load segment rooms for composite bookings
  useEffect(() => {
    if (!booking) {
      setSegmentRooms({});
      setSelectedSegmentRooms({});
      setLoadingSegmentRooms({});
      return;
    }

    void loadSegmentRoomsForBooking(booking);
  }, [booking, loadSegmentRoomsForBooking]);

  // Load pet photo and details
  useEffect(() => {
    if (!selectedPet) {
      setSelectedPetPhoto(null);
      setSelectedPetDetails(null);
      return;
    }

    let cancelled = false;

    const loadPhoto = async () => {
      try {
        const res = await authFetch(`/api/pets/${selectedPet.id}/photo`);
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setSelectedPetPhoto((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        // ignore
      }
    };

    const loadDetails = async () => {
      setPetDetailsLoading(true);
      setPetDetailsError(null);
      try {
        const res = await authFetch("/api/admin/clients");
        if (!res.ok) throw new Error("Failed to load data");
        const clients = await res.json();
        if (cancelled) return;
        let found = null;
        for (const c of clients) {
          const p = c.pets?.find((x: { id: string }) => x.id === selectedPet.id);
          if (p) {
            found = p;
            break;
          }
        }
        setSelectedPetDetails(found);
      } catch (err) {
        if (!cancelled) setPetDetailsError((err as Error).message);
      } finally {
        if (!cancelled) setPetDetailsLoading(false);
      }
    };

    loadPhoto();
    loadDetails();

    return () => {
      cancelled = true;
      setSelectedPetPhoto((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [selectedPet, authFetch]);

  const runAction = async (
    action: () => Promise<void>,
    actionKey: string,
    actionLabel: string
  ): Promise<boolean> => {
    setActionLoading(true);
    setPendingActionKey(actionKey);
    setPendingActionLabel(actionLabel);
    setError(null);
    setSuccess(null);
    try {
      await action();
      onUpdate();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    } finally {
      setActionLoading(false);
      setPendingActionKey(null);
      setPendingActionLabel(null);
    }
  };

  const handleConfirm = async () => {
    if (!booking || !onConfirm) return;

    // Check room assignment
    if (booking.isComposite) {
      const allAssigned = booking.childBookings?.every((s) => s.assignedRoomId);
      if (!allAssigned) {
        setError(t("booking:actions.assignAllRoomsFirst"));
        return;
      }
    } else if (!booking.assignedRoomId && onAssignRoom) {
      setError(t("booking:actions.assignRoomFirst"));
      return;
    }

    const ok = await runAction(
      () => onConfirm(booking.id),
      "booking.confirm",
      t("booking:actions.confirm")
    );
    if (ok) {
      setSuccess(t("booking:actions.bookingConfirmed"));
    }
  };

  const handleCheckIn = async () => {
    if (!booking || !onCheckIn) return;
    skipTabResetRef.current = true;
    setActionLoading(true);
    setPendingActionKey("booking.checkIn");
    setPendingActionLabel(t("booking:actions.checkIn"));
    setError(null);
    setSuccess(null);
    try {
      // Optimistically update state BEFORE the call
      setBookingState((prev) => (prev ? { ...prev, status: "CheckedIn" } : prev));
      await onCheckIn(booking.id);
      // Don't call onUpdate() to avoid resetting activeTab
      setSuccess(t("booking:actions.guestCheckedIn"));
    } catch (err) {
      // Revert on error
      setBookingState((prev) => (prev ? { ...prev, status: booking.status } : prev));
      setError((err as Error).message);
      skipTabResetRef.current = false;
    } finally {
      setActionLoading(false);
      setPendingActionKey(null);
      setPendingActionLabel(null);
      // Keep skipTabResetRef.current = true to prevent tab switching
      // It will be reset when modal closes
    }
  };

  const handleCheckOut = async () => {
    if (!booking || !onCheckOut) return;
    skipTabResetRef.current = true;
    setActionLoading(true);
    setPendingActionKey("booking.checkOut");
    setPendingActionLabel(t("booking:actions.checkOut"));
    setError(null);
    setSuccess(null);
    try {
      // Optimistically update state BEFORE the call
      setBookingState((prev) => (prev ? { ...prev, status: "CheckedOut" } : prev));
      await onCheckOut(booking.id);
      // Don't call onUpdate() to avoid resetting activeTab
      setSuccess(t("booking:actions.guestCheckedOut"));
    } catch (err) {
      // Revert on error
      setBookingState((prev) => (prev ? { ...prev, status: booking.status } : prev));
      setError((err as Error).message);
      skipTabResetRef.current = false;
    } finally {
      setActionLoading(false);
      setPendingActionKey(null);
      setPendingActionLabel(null);
      // Keep skipTabResetRef.current = true to prevent tab switching
      // It will be reset when modal closes
    }
  };

  const handleCancel = () => {
    if (!booking || !onCancel) return;
    setConfirmAction({
      message: t("booking:actions.confirmCancel"),
      type: "warning",
      onConfirm: async () => {
        const ok = await runAction(
          () => onCancel(booking.id),
          "booking.cancel",
          t("booking:actions.cancel")
        );
        if (ok) {
          setSuccess(t("booking:actions.bookingCancelled"));
        }
      },
    });
  };

  const handleDelete = () => {
    if (!booking || !onDelete) return;
    setConfirmAction({
      message: t("booking:actions.confirmDelete"),
      type: "danger",
      onConfirm: async () => {
        const ok = await runAction(
          () => onDelete(booking.id),
          "booking.delete",
          t("booking:actions.delete")
        );
        if (ok) {
          onClose();
        }
      },
    });
  };

  const handleUpdateDates = async () => {
    if (!booking || !onUpdateDates) return;
    setError(null);
    setSuccess(null);
    if (!editCheckIn) {
      setError(t("booking:validation.checkInRequired"));
      return;
    }
    if (!editCheckOut) {
      setError(t("booking:validation.checkOutRequired"));
      return;
    }
    if (editCheckOut < editCheckIn) {
      setError(t("booking:validation.checkOutAfterCheckIn"));
      return;
    }
    const originalCheckIn = booking.checkInDate.slice(0, 10);
    const originalCheckOut = booking.checkOutDate.slice(0, 10);
    if (editCheckIn === originalCheckIn && editCheckOut === originalCheckOut) return;
    const ok = await runAction(
      () => onUpdateDates(booking.id, editCheckIn, editCheckOut),
      "booking.updateDates",
      t("booking:actions.changeDates")
    );
    if (ok) {
      setBookingState((prev) =>
        prev
          ? {
            ...prev,
            checkInDate: editCheckIn,
            checkOutDate: editCheckOut,
          }
          : prev
      );
      setSuccess(t("booking:actions.datesUpdated"));
    }
  };

  const handleAssignRoom = async () => {
    if (!booking || !onAssignRoom || !selectedRoomForAssignment) return;
    const roomId = selectedRoomForAssignment;
    const ok = await runAction(
      () => onAssignRoom(booking.id, selectedRoomForAssignment),
      "booking.assignRoom",
      t("booking:actions.assignRoom")
    );
    if (ok) {
      const assignedRoom = (availableRooms.length > 0 ? availableRooms : localAvailableRooms).find(
        (r) => r.id === roomId
      );
      setBookingState((prev) =>
        prev
          ? {
            ...prev,
            assignedRoomId: roomId,
            assignedRoom: assignedRoom
              ? {
                id: assignedRoom.id,
                roomNumber: assignedRoom.roomNumber,
                roomTypeId: assignedRoom.roomTypeId,
                roomTypeName: prev.roomTypeName,
                floor: assignedRoom.floor,
                specialNotes: assignedRoom.specialNotes,
                isActive: assignedRoom.isActive,
              }
              : prev.assignedRoom,
          }
          : prev
      );
      setSelectedRoomForAssignment("");
      setSuccess(t("booking:actions.roomAssigned"));
    }
  };

  const handleAssignSelectedSegmentRooms = async () => {
    if (!booking || !booking.childBookings || !onAssignRoom) return;

    const targetSegments = booking.childBookings.filter(
      (segment) => !segment.assignedRoomId && !!selectedSegmentRooms[segment.id]
    );

    if (targetSegments.length === 0) {
      setError(t("booking:actions.selectSegmentRoomsFirst"));
      return;
    }

    const ok = await runAction(
      async () => {
        for (const segment of targetSegments) {
          const roomId = selectedSegmentRooms[segment.id];
          if (!roomId) continue;
          await onAssignRoom(segment.id, roomId);
        }
      },
      "booking.assignSegmentRoom",
      t("booking:actions.assignRoom")
    );
    if (!ok) return;

    const updatedBooking: AdminBooking = {
      ...booking,
      childBookings: booking.childBookings.map((segment) => {
        if (segment.assignedRoomId || !selectedSegmentRooms[segment.id]) {
          return segment;
        }

        const roomId = selectedSegmentRooms[segment.id];
        const assignedRoom = segmentRooms[segment.id]?.find((r) => r.id === roomId);
        return {
          ...segment,
          assignedRoomId: roomId,
          assignedRoom: assignedRoom
            ? {
              id: assignedRoom.id,
              roomNumber: assignedRoom.roomNumber,
              roomTypeId: assignedRoom.roomTypeId,
              roomTypeName: segment.roomTypeName,
              floor: assignedRoom.floor,
              specialNotes: assignedRoom.specialNotes,
              isActive: assignedRoom.isActive,
            }
            : segment.assignedRoom,
        };
      }),
    };

    setBookingState(updatedBooking);
    await loadSegmentRoomsForBooking(updatedBooking);
    setSuccess(t("booking:actions.roomsAssigned"));
  };

  const handleCreatePayment = async () => {
    if (!booking) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError(t("booking:paymentForm.invalidAmount"));
      return;
    }

    if (amount > remainingAmount) {
      setError(t("booking:paymentForm.amountExceedsRemaining"));
      return;
    }

    setLoading(true);
    setPendingActionKey("payment.create");
    setPendingActionLabel(t("booking:paymentForm.addPayment"));
    setError(null);
    setSuccess(null);
    skipTabResetForPaymentRef.current = true;

    try {
      const response = await authFetch("/api/admin/payments/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          amount,
          paymentMethod: paymentMethodToNumber[paymentMethod],
          paymentType: paymentTypeToNumber[paymentType],
          adminComment: paymentComment || null,
          autoConfirm: true,
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error ?? t("booking:paymentForm.failedToCreate"));
      }

      const responseData = await response.json();

      // Calculate new remaining amount immediately
      const newPaidAmount = (booking.paidAmount || 0) + amount;
      const newRemainingAmount = Math.max(0, booking.totalPrice - newPaidAmount);

      // Update local remaining amount so button shows correct sum
      setLocalRemainingAmount(newRemainingAmount);

      // Update booking state with new payment data
      if (responseData?.booking) {
        setBookingState((prev) => {
          if (!prev) return prev;
          return { ...prev, ...responseData.booking };
        });
      }

      setSuccess(t("booking:paymentForm.paymentCreated"));

      // Set payment amount to remaining amount if there's still something to pay
      if (newRemainingAmount > 0) {
        setPaymentAmount(newRemainingAmount.toString());
      } else {
        setPaymentAmount("");
      }

      setPaymentComment("");
      fetchPayments();
      onUpdate();
    } catch (err) {
      setError((err as Error).message);
      skipTabResetForPaymentRef.current = false;
    } finally {
      setLoading(false);
      setPendingActionKey(null);
      setPendingActionLabel(null);
      // Keep skipTabResetForPaymentRef.current = true until modal closes to prevent tab switch
      // It will be reset when modal closes
    }
  };

  const handleProcessRefund = async (customAmount?: number) => {
    if (!booking) return;

    const amount =
      customAmount || (customRefundAmount ? parseFloat(customRefundAmount) : undefined);
    const amountText = amount ? currency.format(amount) : t("booking:refund.fullOverpayment");

    setConfirmAction({
      message: t("booking:refund.confirmRefund", { amount: amountText }),
      type: "warning",
      onConfirm: async () => {
        setLoading(true);
        setPendingActionKey("payment.refund");
        setPendingActionLabel(t("booking:refund.processRefund"));
        setError(null);
        setSuccess(null);

        try {
          const body = amount ? JSON.stringify({ amount }) : undefined;
          const response = await authFetch(`/api/admin/bookings/${booking.id}/process-refund`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body,
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error ?? t("booking:refund.failedToProcess"));
          }

          setSuccess(t("booking:refund.refundProcessed"));
          setRefundAmount("");
          setCustomRefundAmount("");
          setEditingRefundAmount(false);
          onUpdate();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setLoading(false);
          setPendingActionKey(null);
          setPendingActionLabel(null);
        }
      },
    });
  };

  const handleConvertToRevenue = () => {
    if (!booking) return;
    setConfirmAction({
      message: t("booking:income.confirmAddToIncome"),
      type: "warning",
      onConfirm: async () => {
        doConvertToRevenue();
      },
    });
  };

  const doConvertToRevenue = async () => {
    if (!booking) return;
    setLoading(true);
    setPendingActionKey("payment.convertIncome");
    setPendingActionLabel(t("booking:income.addToIncome"));
    setError(null);
    setSuccess(null);

    try {
      const response = await authFetch(`/api/admin/bookings/${booking.id}/convert-overpayment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? t("booking:income.failedToAdd"));
      }

      setSuccess(t("booking:income.addedToIncome"));
      onUpdate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      setPendingActionKey(null);
      setPendingActionLabel(null);
    }
  };

  const loadTransferTargets = async () => {
    if (!booking?.client?.id) return;

    try {
      const response = await authFetch(`/api/admin/bookings?clientId=${booking.client.id}`);
      if (!response.ok) throw new Error(t("booking:transfer.failedToLoad"));

      const allBookings = await response.json();
      const active = allBookings.filter((b: AdminBooking) => {
        const status = resolveBookingStatus(b.status);
        return (
          b.id !== booking.id &&
          status !== "CheckedOut" &&
          status !== "Cancelled" &&
          !b.parentBookingId
        );
      });
      setTargetBookings(active);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleTransferPayment = () => {
    if (!booking || !transferTargetBooking) return;

    const amount = customTransferAmount
      ? parseFloat(customTransferAmount)
      : refundAmount
        ? parseFloat(refundAmount)
        : null;
    const amountText = amount ? currency.format(amount) : t("booking:refund.fullOverpayment");

    setConfirmAction({
      message: t("booking:transfer.confirmTransfer", { amount: amountText }),
      type: "warning",
      onConfirm: async () => {
        setLoading(true);
        setPendingActionKey("payment.transfer");
        setPendingActionLabel(t("booking:transfer.transfer"));
        setError(null);
        setSuccess(null);

        try {
          const response = await authFetch(`/api/admin/bookings/${booking.id}/transfer-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              targetBookingId: transferTargetBooking,
              amount,
            }),
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error ?? t("booking:transfer.failedToTransfer"));
          }

          setSuccess(t("booking:transfer.transferred"));
          setTransferTargetBooking("");
          setRefundAmount("");
          setCustomTransferAmount("");
          setTargetBookings([]);
          onUpdate();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setLoading(false);
          setPendingActionKey(null);
          setPendingActionLabel(null);
        }
      },
    });
  };

  const handleSavePrepaymentAmount = async () => {
    if (!booking) return;

    const amount = parseFloat(prepaymentAmountInput);
    const minAmount = Math.round(booking.totalPrice * 0.3);

    if (isNaN(amount) || amount < minAmount || amount > booking.totalPrice) {
      setError(
        t("booking:prepaymentEdit.minMax", {
          min: currency.format(minAmount),
          max: currency.format(booking.totalPrice),
        })
      );
      return;
    }

    setSavingPrepaymentAmount(true);
    setPendingActionKey("payment.prepaymentUpdate");
    setPendingActionLabel(t("booking:prepaymentEdit.editAmount"));
    setError(null);
    setSuccess(null);

    try {
      const response = await authFetch(`/api/admin/bookings/${booking.id}/prepayment-amount`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error ?? t("booking:prepaymentEdit.failedToUpdate"));
      }

      setSuccess(t("booking:prepaymentEdit.updated"));
      setEditingPrepaymentAmount(false);
      setPrepaymentAmountInput("");
      onUpdate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingPrepaymentAmount(false);
      setPendingActionKey(null);
      setPendingActionLabel(null);
    }
  };

  const handleCancelPrepayment = () => {
    if (!booking) return;
    setConfirmAction({
      message: t("booking:prepaymentEdit.confirmCancel"),
      type: "warning",
      onConfirm: async () => {
        setLoading(true);
        setPendingActionKey("payment.prepaymentCancel");
        setPendingActionLabel(t("booking:prepaymentEdit.cancelPrepayment"));
        setError(null);
        setSuccess(null);

        try {
          const response = await authFetch(`/api/admin/bookings/${booking.id}/cancel-prepayment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          if (!response.ok) {
            const data = await response.json().catch(() => ({}));
            throw new Error(data?.error ?? t("booking:prepaymentEdit.failedToCancel"));
          }

          setSuccess(t("booking:prepaymentEdit.cancelled"));
          onUpdate();
        } catch (err) {
          setError((err as Error).message);
        } finally {
          setLoading(false);
          setPendingActionKey(null);
          setPendingActionLabel(null);
        }
      },
    });
  };

  const applyDiscount = async () => {
    if (!booking) return;
    setSavingDiscount(true);
    setPendingActionKey("booking.discount");
    setPendingActionLabel(t("booking:discountForm.apply"));
    setError(null);
    setSuccess(null);

    try {
      const response = await authFetch(`/api/bookings/${booking.id}/discount`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountPercent: discountInput }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || t("booking:discountForm.failedToApply"));
      }

      const updatedPayload = await response.json().catch(() => null);
      const updatedBooking = updatedPayload?.booking ?? updatedPayload;
      if (updatedBooking && typeof updatedBooking === "object") {
        setBookingState((prev) => ({ ...(prev ?? booking), ...updatedBooking }));
      } else {
        setBookingState((prev) => (prev ? { ...prev, discountPercent: discountInput } : prev));
      }

      setSuccess(t("booking:discountForm.applied"));
      onUpdate();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingDiscount(false);
      setPendingActionKey(null);
      setPendingActionLabel(null);
    }
  };

  const loadReceipt = async () => {
    if (!booking) return;
    setReceiptLoading(true);
    setPendingActionKey("booking.receipt");
    setPendingActionLabel(t("booking:modal.receipt"));
    setError(null);

    try {
      const response = await authFetch(`/api/bookings/${booking.id}/receipt`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to load receipt");
      }
      setReceipt(await response.json());
      setReceiptOpen(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReceiptLoading(false);
      setPendingActionKey(null);
      setPendingActionLabel(null);
    }
  };

  const parseDateOnly = (s: string) => {
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(s);
    if (!m) return new Date(s);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };

  if (!booking) return null;

  // const bookingWithDetails = booking as BookingWithDetails; // Unused

  const roomsToUse = availableRooms.length > 0 ? availableRooms : localAvailableRooms;
  const isDateRangeInvalid = !editCheckIn || !editCheckOut || editCheckOut < editCheckIn;
  const hasDateRangeChanged =
    booking.checkInDate.slice(0, 10) !== editCheckIn ||
    booking.checkOutDate.slice(0, 10) !== editCheckOut;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t("booking:modal.title")}
        zIndex={250}
        size="2xl"
      >
        <div className="space-y-4 overflow-x-hidden">
          {/* Status Badge */}
          <div className="flex items-center gap-3 flex-wrap">
            {statusTheme && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${statusTheme.badgeClass}`}
              >
                {statusTheme.label}
              </span>
            )}
            {booking.isComposite && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-100 px-3 py-1.5 text-sm font-semibold text-purple-700">
                <ArrowPathIcon className="h-4 w-4" />
                {t("booking:modal.compositeBooking")} ({booking.childBookings?.length || 0}{" "}
                {t("booking:modal.compositeSegments")})
              </span>
            )}
            <span className="text-xs text-slate-500">
              {t("booking:modal.createdAt")}:{" "}
              {new Date(booking.createdAt).toLocaleDateString(locale)}
            </span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200 -mx-8 px-8 overflow-x-auto">
            {[
              {
                id: "details" as Tab,
                label: t("booking:modal.tabs.details"),
                icon: ClipboardDocumentListIcon,
              },
              { id: "actions" as Tab, label: t("booking:modal.tabs.actions"), icon: CogIcon },
              {
                id: "payments" as Tab,
                label: t("booking:modal.tabs.payments"),
                icon: CreditCardIcon,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-label={tab.label}
                className={`flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition border-b-2 -mb-px ${activeTab === tab.id
                    ? "border-brand text-brand"
                    : "border-transparent text-slate-600 hover:text-brand hover:border-slate-300"
                  }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Messages */}
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 flex items-center gap-2">
              <ExclamationTriangleIcon className="h-5 w-5 flex-shrink-0" />
              {error}
              <button
                onClick={() => setError(null)}
                className="ml-auto text-rose-500 hover:text-rose-700"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          )}
          {success && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 flex-shrink-0" />
              {success}
              <button
                onClick={() => setSuccess(null)}
                className="ml-auto text-emerald-500 hover:text-emerald-700"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          )}
          {pendingActionLabel && (
            <div
              role="status"
              aria-live="polite"
              className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 flex items-center gap-2"
            >
              <ArrowPathIcon className="h-5 w-5 flex-shrink-0 animate-spin" />
              <span>
                {t("booking:paymentForm.processing")} {pendingActionLabel}
              </span>
            </div>
          )}

          {/* Tab Content - No scroll for details */}
          {/* DETAILS TAB */}
          {activeTab === "details" && (
            <div className="space-y-3">
              {/* Top row: Client, Period, Room */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {/* Client */}
                <div className="rounded-lg border border-slate-200 bg-blue-50 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <UserGroupIcon className="h-4 w-4 text-blue-600" />
                    <h4 className="text-sm font-bold text-slate-900">
                      {t("booking:modal.client")}
                    </h4>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {booking.client
                      ? `${booking.client.lastName} ${booking.client.firstName}`
                      : t("booking:modal.unknownClient")}
                  </p>
                  {booking.client?.email && (
                    <p className="text-sm text-slate-600 truncate">{booking.client.email}</p>
                  )}
                  {booking.client?.phone && (
                    <p className="text-sm text-slate-600">{booking.client.phone}</p>
                  )}
                </div>

                {/* Period */}
                <div className="rounded-lg border border-slate-200 bg-purple-50 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <CalendarDaysIcon className="h-4 w-4 text-purple-600" />
                    <h4 className="text-sm font-bold text-slate-900">
                      {t(
                        "booking:modal." +
                        (bookingSettings?.calculationMode === BookingCalculationMode.Nights
                          ? "periodInNights"
                          : "periodInDays")
                      )}
                    </h4>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    {parseDateOnly(booking.checkInDate).toLocaleDateString(locale)}
                  </p>
                  <p className="text-sm text-slate-600">
                    → {parseDateOnly(booking.checkOutDate).toLocaleDateString(locale)}
                  </p>
                  <p className="text-sm font-bold text-slate-900 mt-1">
                    {numberOfNights} {unitLabel}
                  </p>
                </div>

                {/* Room */}
                {!booking.isComposite && (
                  <div className="rounded-lg border border-slate-200 bg-amber-50 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <HomeModernIcon className="h-4 w-4 text-amber-600" />
                      <h4 className="text-sm font-bold text-slate-900">
                        {t("booking:modal.room")}
                      </h4>
                    </div>
                    {booking.assignedRoom ? (
                      <>
                        <p className="text-sm font-semibold text-slate-900">
                          {booking.assignedRoom.roomTypeName}
                        </p>
                        <p className="text-sm text-slate-600">№{booking.assignedRoom.roomNumber}</p>
                      </>
                    ) : (
                      <p className="text-sm text-amber-700 font-medium">
                        {t("booking:modal.notAssigned")}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Stay Calculation + Finances - side by side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
                {/* Stay Calculation */}
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <h4 className="text-sm font-bold text-blue-900 mb-2">
                    {t("booking:modal.stayCalculation")}
                  </h4>
                  <div className="space-y-1 text-[12px]">
                    <div className="flex justify-between">
                      <span className="text-slate-600">{t("booking:modal.roomCost")}:</span>
                      <span className="font-bold text-slate-900">
                        {currency.format(roomPricePerUnit)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">{numberOfNights}x:</span>
                      <span className="font-bold text-blue-600">
                        {currency.format(resolvedBasePrice)}
                      </span>
                    </div>
                    {numberOfAdditionalPets > 0 && (
                      <>
                        <div className="border-t border-blue-200 pt-1 mt-1 flex justify-between">
                          <span className="text-slate-600">
                            +{numberOfAdditionalPets} {t("booking:modal.additionalPets")}:
                          </span>
                          <span className="font-bold text-slate-900">
                            {currency.format(additionalPetsPrice)}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="border-t border-blue-300 pt-1 mt-1 flex justify-between font-bold">
                      <span className="text-slate-900">{t("booking:modal.subtotal")}:</span>
                      <span className="text-blue-600">
                        {currency.format(resolvedBasePrice + additionalPetsPrice)}
                      </span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-700 font-bold">
                        <span>{t("booking:modal.discountAmount")}:</span>
                        <span>- {currency.format(discountAmount)}</span>
                      </div>
                    )}
                    <div className="border-t-2 border-blue-300 pt-1 mt-1 flex justify-between text-sm font-bold">
                      <span>{t("booking:modal.total")}:</span>
                      <span className="text-blue-600">{currency.format(booking.totalPrice)}</span>
                    </div>
                  </div>
                </div>

                {/* Finances */}
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <h4 className="text-sm font-bold text-emerald-900 mb-2">
                    {t("booking:modal.finances")}
                  </h4>
                  <div className="space-y-1.5 text-[12px]">
                    <div className="flex justify-between">
                      <span className="text-slate-600">{t("booking:modal.paid")}:</span>
                      <span className="font-bold text-emerald-600">
                        {currency.format(paidAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">{t("booking:modal.remaining")}:</span>
                      <span className="font-bold text-amber-600">
                        {currency.format(remainingAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">{t("booking:modal.progress")}:</span>
                      <span className="font-bold text-blue-600">{progressPercent}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{ width: `${progressWidth}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Composite Segments */}
              {booking.isComposite && booking.childBookings && booking.childBookings.length > 0 && (
                <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                  <h4 className="text-sm font-bold text-purple-900 mb-2">
                    {t("booking:modal.segments")} ({booking.childBookings.length})
                  </h4>
                  <div className="space-y-1">
                    {booking.childBookings
                      .sort((a, b) => (a.segmentOrder ?? 0) - (b.segmentOrder ?? 0))
                      .map((segment, idx) => (
                        <div
                          key={segment.id}
                          className="flex justify-between items-center text-[12px] bg-white rounded p-1.5 border border-purple-100"
                        >
                          <span className="font-bold text-purple-700 min-w-fit">
                            {idx + 1}. {segment.roomTypeName}
                          </span>
                          <span className="font-bold text-purple-600">
                            {currency.format(segment.totalPrice)}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Pets & Special Requests */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Pets */}
                {allPets.length > 0 && (
                  <div className="rounded-lg border border-pink-200 bg-pink-50 p-3">
                    <h4 className="text-sm font-bold text-pink-900 mb-2">
                      🐾 {t("booking:modal.pets")} ({allPets.length})
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {allPets.map((pet) => (
                        <button
                          key={pet.id}
                          type="button"
                          onClick={() =>
                            setSelectedPet({
                              id: pet.id,
                              name: pet.name,
                              species: pet.species,
                              gender: pet.gender,
                            })
                          }
                          className="text-[11px] bg-white border border-pink-200 rounded px-2 py-0.5 font-medium text-slate-700 hover:bg-pink-100 hover:border-pink-300 focus:outline-none focus:ring-2 focus:ring-pink-300"
                        >
                          {pet.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Discount & Receipt */}
                {user?.role === "Admin" && (
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                    <h4 className="text-sm font-bold text-indigo-900 mb-2">
                      {t("booking:modal.discount")} & {t("booking:modal.receipt")}
                    </h4>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={discountInput}
                        onChange={(e) =>
                          setDiscountInput(Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                        }
                        className="w-16 rounded text-xs px-1.5 py-1 border border-indigo-300"
                        placeholder="0%"
                      />
                      <button
                        onClick={applyDiscount}
                        disabled={savingDiscount}
                        className="text-xs rounded bg-brand text-white px-2 py-1 font-medium hover:bg-brand/90 disabled:opacity-50"
                      >
                        {savingDiscount && pendingActionKey === "booking.discount"
                          ? t("booking:paymentForm.processing")
                          : t("booking:modal.discount")}
                      </button>
                      <button
                        onClick={loadReceipt}
                        disabled={receiptLoading}
                        className="text-xs rounded border border-slate-300 px-2 py-1 hover:bg-slate-100 disabled:opacity-50"
                      >
                        {receiptLoading && pendingActionKey === "booking.receipt"
                          ? t("booking:paymentForm.processing")
                          : "📄"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Special Requests */}
              {booking.specialRequests && (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3">
                  <h4 className="text-xs font-bold text-indigo-900 mb-1">
                    📝 {t("booking:modal.specialRequests")}
                  </h4>
                  <p className="text-xs text-slate-700 line-clamp-2">{booking.specialRequests}</p>
                </div>
              )}

              {/* Warning if room not assigned */}
              {!booking.isComposite &&
                !booking.assignedRoomId &&
                onAssignRoom &&
                (statusKey === "Pending" ||
                  statusKey === "Confirmed" ||
                  statusKey === "AwaitingPayment") && (
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <div className="flex items-start gap-2">
                      <ExclamationTriangleIcon className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-amber-900">
                          {t("booking:modal.roomNotAssigned")}
                        </p>
                        <p className="text-xs text-amber-700 mt-0.5">
                          {t("booking:modal.needAssignRoom")} &quot;{booking.roomTypeName}&quot;
                        </p>
                        <button
                          onClick={() => setActiveTab("actions")}
                          className="text-xs text-amber-700 underline font-bold mt-1"
                        >
                          {t("booking:modal.goToAssignment")} →
                        </button>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          )}

          {/* ACTIONS TAB */}
          {activeTab === "actions" && (
            <div className="space-y-4">
              {/* Quick Actions */}
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <h4 className="text-sm font-bold text-slate-900 mb-4">
                  {t("booking:modal.quickActions")}
                </h4>
                <div className="flex flex-wrap gap-3">
                  {statusKey === "Pending" && onConfirm && (
                    <button
                      onClick={handleConfirm}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircleIcon className="h-5 w-5" />
                      {actionLoading && pendingActionKey === "booking.confirm"
                        ? t("booking:paymentForm.processing")
                        : t("booking:actions.confirm")}
                    </button>
                  )}

                  {(statusKey === "Confirmed" || statusKey === "AwaitingPayment") &&
                    onCheckIn &&
                    (() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const checkInDate = booking ? parseDateOnly(booking.checkInDate) : null;
                      if (checkInDate) {
                        checkInDate.setHours(0, 0, 0, 0);
                      }
                      const canCheckIn = checkInDate && checkInDate.getTime() === today.getTime();

                      return (
                        <button
                          onClick={handleCheckIn}
                          disabled={actionLoading || !canCheckIn}
                          title={
                            !canCheckIn
                              ? `${t("booking:modal.checkInAvailableOnly")} ${checkInDate?.toLocaleDateString(locale)} (${t("booking:modal.checkInDay")})`
                              : t("booking:modal.checkInGuest")
                          }
                          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          <ArrowRightOnRectangleIcon className="h-5 w-5" />
                          {actionLoading && pendingActionKey === "booking.checkIn"
                            ? t("booking:paymentForm.processing")
                            : t("booking:actions.checkIn")}
                        </button>
                      );
                    })()}

                  {statusKey === "CheckedIn" && onCheckOut && (
                    <button
                      onClick={handleCheckOut}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
                    >
                      <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                      {actionLoading && pendingActionKey === "booking.checkOut"
                        ? t("booking:paymentForm.processing")
                        : t("booking:actions.checkOut")}
                    </button>
                  )}

                  {statusKey !== "CheckedIn" &&
                    statusKey !== "CheckedOut" &&
                    statusKey !== "Cancelled" &&
                    onCancel && (
                      <button
                        onClick={handleCancel}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                      >
                        <XMarkIcon className="h-5 w-5" />
                        {actionLoading && pendingActionKey === "booking.cancel"
                          ? t("booking:paymentForm.processing")
                          : t("booking:actions.cancel")}
                      </button>
                    )}

                  {onDelete && (
                    <button
                      onClick={handleDelete}
                      disabled={actionLoading}
                      className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      🗑️{" "}
                      {actionLoading && pendingActionKey === "booking.delete"
                        ? t("booking:paymentForm.processing")
                        : t("booking:modal.deleteBooking")}
                    </button>
                  )}
                </div>
              </div>

              {/* Room Assignment - Simple bookings */}
              {!booking.isComposite && onAssignRoom && (
                <div
                  className={`rounded-xl border p-4 ${!booking.assignedRoomId
                      ? "border-amber-300 bg-gradient-to-br from-amber-50 to-white"
                      : "border-indigo-200 bg-gradient-to-br from-indigo-50 to-white"
                    }`}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <h4 className="text-sm font-bold text-slate-900">
                      🏠 {t("booking:modal.roomAssignment")}
                    </h4>
                    {!booking.assignedRoomId &&
                      (statusKey === "Pending" ||
                        statusKey === "Confirmed" ||
                        statusKey === "AwaitingPayment") && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                          <ExclamationTriangleIcon className="h-3 w-3" />
                          {t("booking:modal.requiresAssignment")}
                        </span>
                      )}
                  </div>
                  {booking.assignedRoomId ? (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                      <p className="text-sm text-emerald-700 font-medium">
                        ✓ {t("booking:modal.assigned")}: {booking.assignedRoom?.roomTypeName} #
                        {booking.assignedRoom?.roomNumber}
                      </p>
                    </div>
                  ) : loadingRooms ? (
                    <p className="text-sm text-slate-500">{t("booking:modal.loadingRooms")}</p>
                  ) : roomsToUse.length === 0 ? (
                    <div className="rounded-lg bg-rose-50 border border-rose-200 p-3">
                      <p className="text-sm text-rose-700 font-medium mb-1">
                        ⚠️ {t("booking:modal.noAvailableRooms")}
                      </p>
                      <p className="text-xs text-rose-600">
                        {t("booking:modal.noFreeRooms")} &quot;{booking.roomTypeName}&quot;{" "}
                        {t("booking:modal.forPeriod")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <select
                          value={selectedRoomForAssignment}
                          onChange={(e) => setSelectedRoomForAssignment(e.target.value)}
                          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="">{t("booking:modal.selectRoom")}</option>
                          {roomsToUse.map((room) => (
                            <option key={room.id} value={room.id}>
                              №{room.roomNumber}{" "}
                              {room.floor != null && `(${t("booking:modal.floor")} ${room.floor})`}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleAssignRoom}
                          disabled={!selectedRoomForAssignment || actionLoading}
                          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {actionLoading &&
                            (pendingActionKey === "booking.assignRoom" ||
                              pendingActionKey === "booking.assignSegmentRoom")
                            ? t("booking:paymentForm.processing")
                            : t("booking:modal.assignRoom")}
                        </button>
                      </div>
                      <p className="text-xs text-slate-500">
                        {t("booking:modal.availableRooms")}: {roomsToUse.length}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Room Assignment - Composite bookings */}
              {booking.isComposite &&
                booking.childBookings &&
                onAssignRoom &&
                (() => {
                  const unassignedSegments =
                    booking.childBookings?.filter((s) => !s.assignedRoomId) || [];
                  const hasUnassigned = unassignedSegments.length > 0;

                  return (
                    <div
                      className={`rounded-xl border p-4 ${hasUnassigned &&
                          (statusKey === "Pending" ||
                            statusKey === "Confirmed" ||
                            statusKey === "AwaitingPayment")
                          ? "border-amber-300 bg-gradient-to-br from-amber-50 to-white"
                          : "border-amber-200 bg-gradient-to-br from-amber-50 to-white"
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <h4 className="text-sm font-bold text-slate-900">
                          🏠 {t("booking:modal.roomAssignmentBySegment")}
                        </h4>
                        {hasUnassigned &&
                          (statusKey === "Pending" ||
                            statusKey === "Confirmed" ||
                            statusKey === "AwaitingPayment") && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              <ExclamationTriangleIcon className="h-3 w-3" />
                              {unassignedSegments.length} {t("booking:modal.withoutRoom")}
                            </span>
                          )}
                      </div>
                      {hasUnassigned &&
                        (statusKey === "Pending" ||
                          statusKey === "Confirmed" ||
                          statusKey === "AwaitingPayment") && (
                          <div className="mb-3 rounded-lg bg-amber-100 border border-amber-300 p-2">
                            <p className="text-xs text-amber-800 font-medium">
                              ⚠️ {t("booking:modal.needAssignAllSegments")}{" "}
                              {unassignedSegments.length} {t("booking:modal.segmentsWord")}
                            </p>
                          </div>
                        )}
                      <div className="space-y-3">
                        {booking.childBookings
                          .sort((a, b) => (a.segmentOrder ?? 0) - (b.segmentOrder ?? 0))
                          .map((segment, idx) => {
                            const rooms = segmentRooms[segment.id] || [];
                            const isLoading = loadingSegmentRooms[segment.id];

                            return (
                              <div
                                key={segment.id}
                                className="rounded-lg bg-white border border-amber-200 p-3"
                              >
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
                                    {idx + 1}
                                  </span>
                                  <span className="text-sm font-medium text-slate-900">
                                    {segment.roomTypeName}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {parseDateOnly(segment.checkInDate).toLocaleDateString(locale, {
                                      day: "2-digit",
                                      month: "2-digit",
                                    })}{" "}
                                    —{" "}
                                    {parseDateOnly(segment.checkOutDate).toLocaleDateString(
                                      locale,
                                      { day: "2-digit", month: "2-digit" }
                                    )}
                                  </span>
                                </div>

                                {segment.assignedRoomId ? (
                                  <p className="text-sm text-emerald-600 font-medium">
                                    ✓ №
                                    {segment.assignedRoom?.roomNumber ||
                                      segment.assignedRoomId.slice(0, 8)}
                                  </p>
                                ) : isLoading ? (
                                  <p className="text-xs text-slate-500">
                                    {t("booking:modal.loading")}
                                  </p>
                                ) : rooms.length === 0 ? (
                                  <p className="text-xs text-rose-600">
                                    {t("booking:modal.noAvailableRooms")}
                                  </p>
                                ) : (
                                  <div className="flex gap-2">
                                    <select
                                      value={selectedSegmentRooms[segment.id] || ""}
                                      onChange={(e) =>
                                        setSelectedSegmentRooms((prev) => ({
                                          ...prev,
                                          [segment.id]: e.target.value,
                                        }))
                                      }
                                      className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                                    >
                                      <option value="">{t("booking:modal.selectRoomShort")}</option>
                                      {rooms.map((room) => (
                                        <option key={room.id} value={room.id}>
                                          №{room.roomNumber}{" "}
                                          {room.floor != null &&
                                            `(${t("booking:modal.floor")} ${room.floor})`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        <div className="pt-2">
                          <button
                            onClick={handleAssignSelectedSegmentRooms}
                            disabled={
                              actionLoading ||
                              !booking.childBookings.some(
                                (segment) =>
                                  !segment.assignedRoomId && !!selectedSegmentRooms[segment.id]
                              )
                            }
                            className="w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {actionLoading && pendingActionKey === "booking.assignSegmentRoom"
                              ? t("booking:paymentForm.processing")
                              : t("booking:modal.assignSelectedSegments")}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })()}

              {/* Date Editing */}
              {onUpdateDates && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h4 className="text-sm font-bold text-slate-900 mb-3">
                    📅 {t("booking:modal.changeDates")}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        {t("booking:modal.checkIn")}
                      </label>
                      <DateInput
                        value={editCheckIn}
                        onChange={handleCheckInChange}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        popoverClassName="fixed max-w-xs sm:max-w-sm md:max-w-md"
                        centerOnScreen
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        {t("booking:modal.checkOut")}
                      </label>
                      <DateInput
                        value={editCheckOut}
                        onChange={handleCheckOutChange}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                        popoverClassName="fixed max-w-xs sm:max-w-sm md:max-w-md"
                        centerOnScreen
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleUpdateDates}
                    disabled={actionLoading || !hasDateRangeChanged || isDateRangeInvalid}
                    className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    {actionLoading && pendingActionKey === "booking.updateDates"
                      ? t("booking:paymentForm.processing")
                      : t("booking:modal.saveDates")}
                  </button>
                  {editCheckIn && editCheckOut && editCheckOut < editCheckIn && (
                    <p className="mt-2 text-xs text-rose-600">
                      {t("booking:validation.checkOutAfterCheckIn")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* PAYMENTS TAB */}
          {activeTab === "payments" && (
            <div className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
                <div className="space-y-4">
                  {/* Payment Summary */}
                  <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <BanknotesIcon className="h-5 w-5 text-slate-600" />
                      <h4 className="text-sm font-bold text-slate-900">
                        {t("booking:modal.paymentSummary")}
                      </h4>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-2 sm:gap-4">
                      <div className="min-w-0 rounded-lg bg-white border border-slate-200 p-2.5 sm:p-3">
                        <p className="text-xs text-slate-500 mb-1">{t("booking:modal.total")}</p>
                        <p className="text-[clamp(0.9rem,1.1vw,1.05rem)] font-bold leading-tight whitespace-nowrap tabular-nums text-slate-900">
                          {currency.format(booking.totalPrice)}
                        </p>
                      </div>
                      <div className="min-w-0 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 sm:p-3">
                        <p className="text-xs text-emerald-600 mb-1">{t("booking:modal.paid")}</p>
                        <p className="text-[clamp(0.9rem,1.1vw,1.05rem)] font-bold leading-tight whitespace-nowrap tabular-nums text-emerald-600">
                          {currency.format(paidAmount)}
                        </p>
                      </div>
                      {!booking?.overpaymentConvertedToRevenue && (
                        <>
                          <div className="min-w-0 rounded-lg bg-amber-50 border border-amber-200 p-2.5 sm:p-3">
                            <p className="text-xs text-amber-600 mb-1">
                              {t("booking:modal.remaining")}
                            </p>
                            <p className="text-[clamp(0.9rem,1.1vw,1.05rem)] font-bold leading-tight whitespace-nowrap tabular-nums text-amber-600">
                              {currency.format(remainingAmount)}
                            </p>
                          </div>
                          <div className="min-w-0 rounded-lg bg-blue-50 border border-blue-200 p-2.5 sm:p-3">
                            <p className="text-xs text-blue-600 mb-1">
                              {t("booking:modal.progress")}
                            </p>
                            <p className="text-[clamp(0.9rem,1.1vw,1.05rem)] font-bold leading-tight whitespace-nowrap tabular-nums text-blue-600">
                              {progressPercent}%
                            </p>
                          </div>
                        </>
                      )}
                      {booking?.overpaymentConvertedToRevenue && (
                        <div className="min-w-0 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 sm:p-3">
                          <p className="text-xs text-emerald-600 mb-1">
                            {t("booking:modal.addedToIncome")}
                          </p>
                          <p className="text-[clamp(0.9rem,1.1vw,1.05rem)] font-bold leading-tight whitespace-nowrap tabular-nums text-emerald-600">
                            {currency.format(booking.revenueConversionAmount || 0)}
                          </p>
                          {booking.revenueConversionComment && (
                            <p className="text-[10px] text-emerald-700 mt-1">
                              {booking.revenueConversionComment}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Progress Bar */}
                    {!booking?.overpaymentConvertedToRevenue && (
                      <div className="mt-4 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-green-500 rounded-full transition-all"
                          style={{
                            width: `${progressWidth}%`,
                          }}
                        />
                      </div>
                    )}
                    {booking?.overpaymentConvertedToRevenue && booking.revenueConversionComment && (
                      <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                        <p className="text-xs text-emerald-700">
                          {booking.revenueConversionComment}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Payment History (moved under summary) */}
                  <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CreditCardIcon className="h-5 w-5 text-slate-600" />
                        <h4 className="text-sm font-bold text-slate-900">
                          {t("booking:modal.paymentHistory")}
                        </h4>
                      </div>
                      {payments.length > 0 && (
                        <span className="text-xs text-slate-500">
                          {t("booking:modal.totalPayments")}: {payments.length}
                        </span>
                      )}
                    </div>

                    {payments.length > 0 && (
                      <div className="mb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                          <p className="text-emerald-700 font-semibold">
                            {t("booking:modal.paid")}
                          </p>
                          <p className="text-sm font-bold text-emerald-800">
                            {currency.format(paymentStats.paid)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                          <p className="text-amber-700 font-semibold">
                            {t("booking:modal.pending")}
                          </p>
                          <p className="text-sm font-bold text-amber-800">
                            {currency.format(paymentStats.pending)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                          <p className="text-rose-700 font-semibold">
                            {t("booking:modal.refundsErrors")}
                          </p>
                          <p className="text-sm font-bold text-rose-800">
                            {currency.format(paymentStats.refunded + paymentStats.failed)}
                          </p>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                          <p className="text-slate-700 font-semibold">
                            {t("booking:modal.lastPayment")}
                          </p>
                          <p className="text-sm font-bold text-slate-900">
                            {paymentStats.lastPaidAt
                              ? new Date(paymentStats.lastPaidAt).toLocaleString(locale, {
                                day: "2-digit",
                                month: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                              : "—"}
                          </p>
                        </div>
                      </div>
                    )}

                    {payments.length > 0 && (
                      <div className="mb-3 flex flex-wrap gap-2 text-[11px] text-slate-600">
                        {Object.entries(paymentStats.byMethod).map(([method, data]) => (
                          <span
                            key={method}
                            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold"
                          >
                            {method} · {data.count} pcs · {currency.format(data.amount)}
                          </span>
                        ))}
                      </div>
                    )}

                    {payments.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-3">
                          <CreditCardIcon className="h-8 w-8 text-slate-400" />
                        </div>
                        <p className="text-sm text-slate-500 font-medium">
                          {t("booking:paymentHistory.noPayments")}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[34vh] overflow-y-auto pr-1">
                        {payments
                          .sort(
                            (a, b) =>
                              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                          )
                          .map((payment) => {
                            const statusColor =
                              paymentStatusColors[payment.paymentStatus] ||
                              "bg-slate-100 text-slate-600";
                            const statusLabel = getPaymentStatusName(payment.paymentStatus);
                            const isPaid = payment.paymentStatus === 1;
                            const isRefunded = payment.paymentStatus === 3;
                            // Determine if refund is full or partial
                            // Check payment comment which contains refund type info
                            const refundAmount = isRefunded ? Math.abs(payment.amount) : 0;
                            const comment = payment.adminComment || "";
                            const isFullRefund =
                              isRefunded &&
                              ((comment.includes("Refund") && !comment.includes("Partial")) ||
                                comment.includes("full overpayment") ||
                                (statusKey === "Cancelled" &&
                                  Math.abs(refundAmount - (booking?.paidAmount || 0)) < 0.01) ||
                                ((statusKey === "CheckedOut" || statusKey === "Cancelled") &&
                                  Math.abs(
                                    refundAmount -
                                    Math.max(
                                      0,
                                      (booking?.paidAmount || 0) - (booking?.totalPrice || 0)
                                    )
                                  ) < 0.01));

                            return (
                              <div
                                key={payment.id}
                                className={`rounded-lg border p-3 transition hover:shadow-md ${isPaid
                                    ? "border-emerald-200 bg-gradient-to-br from-emerald-50 to-white"
                                    : isRefunded
                                      ? "border-rose-200 bg-gradient-to-br from-rose-50 to-white"
                                      : "border-slate-200 bg-slate-50"
                                  }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span
                                        className={`text-xl font-bold ${isPaid
                                            ? "text-emerald-600"
                                            : isRefunded
                                              ? "text-rose-600"
                                              : "text-slate-700"
                                          }`}
                                      >
                                        {isRefunded ? "-" : ""}
                                        {currency.format(Math.abs(payment.amount))}
                                      </span>
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColor}`}
                                      >
                                        {statusLabel}
                                      </span>
                                      {isRefunded && (
                                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold bg-rose-100 text-rose-700 border border-rose-300">
                                          {isFullRefund
                                            ? t("booking:refund.title")
                                            : t("booking:refund.title")}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 mt-1.5">
                                      <span className="inline-flex items-center gap-1">
                                        <CreditCardIcon className="h-3.5 w-3.5" />
                                        {getPaymentMethodName(payment.paymentMethod)}
                                      </span>
                                      <span>•</span>
                                      <span>{getPaymentTypeName(payment.paymentType)}</span>
                                      {payment.paidAt && (
                                        <>
                                          <span>•</span>
                                          <span className="text-emerald-600 font-medium">
                                            {new Date(payment.paidAt).toLocaleDateString(locale)}
                                          </span>
                                        </>
                                      )}
                                    </div>

                                    <p className="text-xs text-slate-500 mt-1">
                                      {new Date(payment.createdAt).toLocaleString(locale, {
                                        day: "2-digit",
                                        month: "2-digit",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </p>

                                    {payment.adminComment && (
                                      <div className="mt-2 rounded bg-slate-100 border border-slate-200 p-2">
                                        <p className="text-xs text-slate-700 italic">
                                          💬 {payment.adminComment}
                                        </p>
                                      </div>
                                    )}

                                    {payment.transactionId && (
                                      <p className="text-xs text-slate-500 mt-1 font-mono">
                                        ID: {payment.transactionId}
                                      </p>
                                    )}
                                  </div>

                                  {isPaid && (
                                    <div className="text-right text-xs text-slate-600 whitespace-nowrap">
                                      <p className="font-semibold text-emerald-700">
                                        {t("booking:modal.credited")}
                                      </p>
                                      <p>
                                        {payment.confirmedAt
                                          ? new Date(payment.confirmedAt).toLocaleDateString(locale)
                                          : "-"}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  {/* Required Prepayment Amount */}
                  {statusKey === "Pending" || statusKey === "AwaitingPayment" ? (
                    <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <ShieldCheckIcon className="h-5 w-5 text-blue-600" />
                          <div>
                            <h4 className="text-sm font-bold text-slate-900">
                              {t("booking:modal.requiredPrepayment")}
                            </h4>
                            <p className="text-xs text-slate-600">
                              {t("booking:modal.minimum")}:{" "}
                              {currency.format(Math.round(booking.totalPrice * 0.3))} (30%)
                            </p>
                          </div>
                        </div>
                        {!editingPrepaymentAmount && (
                          <button
                            onClick={() => {
                              const currentAmount =
                                (booking as { requiredPrepaymentAmount?: number })
                                  .requiredPrepaymentAmount || Math.round(booking.totalPrice * 0.3);
                              setPrepaymentAmountInput(currentAmount.toString());
                              setEditingPrepaymentAmount(true);
                            }}
                            className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50"
                          >
                            {t("booking:modal.change")}
                          </button>
                        )}
                      </div>

                      {editingPrepaymentAmount ? (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={prepaymentAmountInput}
                              onChange={(e) => setPrepaymentAmountInput(e.target.value)}
                              min={Math.round(booking.totalPrice * 0.3)}
                              max={booking.totalPrice}
                              className="flex-1 rounded-lg border border-blue-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              placeholder={Math.round(booking.totalPrice * 0.3).toString()}
                            />
                            <button
                              onClick={handleSavePrepaymentAmount}
                              disabled={savingPrepaymentAmount}
                              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                            >
                              {savingPrepaymentAmount &&
                                pendingActionKey === "payment.prepaymentUpdate"
                                ? t("booking:paymentForm.processing")
                                : t("booking:modal.saveBtn")}
                            </button>
                            <button
                              onClick={() => {
                                setEditingPrepaymentAmount(false);
                                setPrepaymentAmountInput("");
                              }}
                              disabled={savingPrepaymentAmount}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              {t("booking:modal.cancelBtn")}
                            </button>
                          </div>
                          <p className="text-xs text-slate-500">
                            {t("booking:modal.range")}:{" "}
                            {currency.format(Math.round(booking.totalPrice * 0.3))} —{" "}
                            {currency.format(booking.totalPrice)}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="rounded-lg bg-white border border-blue-200 p-3">
                            <p className="text-lg font-bold text-blue-700">
                              {currency.format(
                                (booking as { requiredPrepaymentAmount?: number })
                                  .requiredPrepaymentAmount || Math.round(booking.totalPrice * 0.3)
                              )}
                            </p>
                            {(booking as { prepaymentCancelled?: boolean }).prepaymentCancelled && (
                              <p className="text-xs text-slate-500 mt-1 italic">
                                ⚠️ {t("booking:prepaymentEdit.cancelled")}
                              </p>
                            )}
                          </div>
                          {!prepaymentCancelled && (
                            <button
                              onClick={handleCancelPrepayment}
                              disabled={loading}
                              className="w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                            >
                              {loading && pendingActionKey === "payment.prepaymentCancel"
                                ? t("booking:modal.loading")
                                : `❌ ${t("booking:prepaymentEdit.cancelPrepayment")}`}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-4">
                  {/* Create Payment */}
                  {remainingAmount > 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="p-1.5 rounded-lg bg-emerald-100">
                          <CreditCardIcon className="h-5 w-5 text-emerald-600" />
                        </div>
                        <h4 className="text-sm font-bold text-slate-900">
                          💳 {t("booking:paymentForm.title")}
                        </h4>
                      </div>

                      <div className="space-y-4">
                        {/* Amount Input */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-2">
                            {t("booking:paymentForm.amount")}
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              placeholder="0"
                              min="0"
                              max={remainingAmount}
                              step="0.01"
                              className="flex-1 rounded-lg border-2 border-emerald-300 px-4 py-2.5 text-base font-bold text-emerald-700 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                            />
                            <button
                              onClick={() => setPaymentAmount(remainingAmount.toString())}
                              className="rounded-lg border-2 border-emerald-400 bg-emerald-100 px-4 py-2.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 transition whitespace-nowrap"
                            >
                              {t("booking:paymentForm.fullRemaining")}
                            </button>
                          </div>
                          <div className="flex items-center justify-between mt-2 gap-3">
                            <div className="flex-1">
                              <p className="text-xs text-slate-500">
                                {t("booking:paymentForm.remaining")}:{" "}
                                <span className="font-semibold text-amber-600">
                                  {currency.format(remainingAmount)}
                                </span>
                              </p>
                              {paymentAmount && parseFloat(paymentAmount) > 0 && (
                                <p className="text-xs text-slate-500 mt-0.5">
                                  {t("booking:paymentForm.afterPayment")}:{" "}
                                  <span className="font-semibold text-emerald-600">
                                    {currency.format(
                                      Math.max(0, remainingAmount - parseFloat(paymentAmount))
                                    )}
                                  </span>
                                </p>
                              )}
                            </div>
                            {paymentAmount && parseFloat(paymentAmount) > 0 && (
                              <div className="flex-shrink-0">
                                <div className="rounded-lg bg-emerald-100 border border-emerald-300 px-3 py-1.5">
                                  <p className="text-sm font-bold text-emerald-700">
                                    {Math.round(
                                      (parseFloat(paymentAmount) / booking.totalPrice) * 100
                                    )}
                                    %
                                  </p>
                                  <p className="text-[10px] text-emerald-600">
                                    {t("booking:paymentForm.ofTotal")}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Payment Method and Type */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-2">
                              {t("booking:paymentForm.method")}
                            </label>
                            <select
                              value={paymentMethod}
                              onChange={(e) => setPaymentMethod(e.target.value)}
                              className="w-full rounded-lg border-2 border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 font-medium"
                            >
                              <option value="Cash">💵 {t("booking:paymentForm.methodCash")}</option>
                              <option value="Card">💳 {t("booking:paymentForm.methodCard")}</option>
                              <option value="Online">
                                🌐 {t("booking:paymentForm.methodOnline")}
                              </option>
                              <option value="QrCode">📱 {t("booking:paymentForm.methodQr")}</option>
                              <option value="PhoneTransfer">
                                📲 {t("booking:paymentForm.methodTransfer")}
                              </option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-2">
                              {t("booking:paymentForm.type")}
                            </label>
                            <select
                              value={paymentType}
                              onChange={(e) => setPaymentType(e.target.value)}
                              className="w-full rounded-lg border-2 border-slate-300 px-3 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 font-medium"
                            >
                              <option value="Prepayment">
                                💰 {t("booking:paymentForm.typePrepayment")}
                              </option>
                              <option value="FullPayment">
                                ✅ {t("booking:paymentForm.typeFullPayment")}
                              </option>
                            </select>
                          </div>
                        </div>

                        {/* Comment */}
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-2">
                            {t("booking:paymentForm.comment")}
                          </label>
                          <input
                            type="text"
                            value={paymentComment}
                            onChange={(e) => setPaymentComment(e.target.value)}
                            placeholder={t("booking:paymentForm.commentPlaceholder")}
                            className="w-full rounded-lg border-2 border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                          />
                        </div>
                      </div>
                      <div className="space-y-4 mt-6">
                        {/* Submit Button */}
                        <button
                          onClick={handleCreatePayment}
                          disabled={
                            loading ||
                            !paymentAmount ||
                            parseFloat(paymentAmount) <= 0 ||
                            parseFloat(paymentAmount) > remainingAmount
                          }
                          className="w-full rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                          {loading ? (
                            <span className="inline-flex items-center gap-2">
                              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              {loading && pendingActionKey === "payment.create"
                                ? t("booking:paymentForm.processing")
                                : t("booking:modal.loading")}
                            </span>
                          ) : (
                            `💳 ${t("booking:paymentForm.createPayment")} ${paymentAmount ? currency.format(parseFloat(paymentAmount)) : currency.format(remainingAmount)}`
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                  {remainingAmount <= 0 && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      {t("booking:paymentForm.fullyPaid")}
                    </div>
                  )}
                </div>
              </div>

              {/* Refund/Transfer Section */}
              {availableForRefund > 0 && !booking?.overpaymentConvertedToRevenue && (
                <div className="rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ArrowPathRoundedSquareIcon className="h-5 w-5 text-rose-600" />
                    <h4 className="text-sm font-bold text-slate-900">
                      {isCancelled
                        ? t("booking:refund.paymentRefund")
                        : t("booking:refund.overpayment")}
                    </h4>
                  </div>

                  <div className="rounded-lg bg-rose-100 border-2 border-rose-300 p-4 mb-4">
                    <p className="text-2xl font-bold text-rose-900 mb-1">
                      {currency.format(availableForRefund)}
                    </p>
                    <p className="text-xs text-rose-700 font-medium">
                      {t("booking:refund.availableForRefund")}
                    </p>
                  </div>

                  {/* Partial Refund Input */}
                  {editingRefundAmount ? (
                    <div className="mb-4 rounded-lg bg-blue-50 border-2 border-blue-300 p-3">
                      <label className="block text-xs font-semibold text-blue-700 mb-2">
                        {t("booking:paymentForm.amount")}:
                      </label>
                      <div className="space-y-2">
                        <input
                          type="number"
                          min="0"
                          max={availableForRefund}
                          step="0.01"
                          value={customRefundAmount}
                          onChange={(e) => setCustomRefundAmount(e.target.value)}
                          placeholder={availableForRefund.toFixed(2)}
                          className="w-full rounded-lg border-2 border-blue-400 bg-white px-3 py-2 text-base font-bold text-blue-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                        />
                        <p className="text-xs text-blue-600">
                          Max: {currency.format(availableForRefund)}
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const amount = parseFloat(customRefundAmount) || availableForRefund;
                              handleProcessRefund(amount);
                            }}
                            disabled={
                              loading ||
                              (customRefundAmount.trim() !== "" &&
                                parseFloat(customRefundAmount) <= 0)
                            }
                            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            {loading && pendingActionKey === "payment.refund"
                              ? t("booking:paymentForm.processing")
                              : `✓ ${t("booking:refund.processRefund")}`}
                          </button>
                          <button
                            onClick={() => {
                              setEditingRefundAmount(false);
                              setCustomRefundAmount("");
                            }}
                            disabled={loading}
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {t("booking:modal.cancelBtn")}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                      <button
                        onClick={() => handleProcessRefund()}
                        disabled={loading}
                        className="rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg disabled:opacity-50 transition"
                      >
                        💳 {t("booking:refund.processFullRefund")}
                      </button>
                      <button
                        onClick={() => {
                          setEditingRefundAmount(true);
                          setCustomRefundAmount(availableForRefund.toFixed(2));
                        }}
                        disabled={loading}
                        className="rounded-lg border-2 border-blue-500 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 transition"
                      >
                        ✏️ {t("booking:refund.customAmount")}
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      onClick={handleConvertToRevenue}
                      disabled={loading}
                      className="rounded-lg border-2 border-emerald-500 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 transition"
                    >
                      ✓ {t("booking:income.addToIncome")}
                    </button>
                    <button
                      onClick={() => {
                        loadTransferTargets();
                        setCustomTransferAmount(availableForRefund.toString());
                      }}
                      disabled={loading}
                      className="rounded-lg border-2 border-purple-500 bg-white px-4 py-2.5 text-sm font-semibold text-purple-700 hover:bg-purple-50 disabled:opacity-50 transition"
                    >
                      🔄 {t("booking:transfer.transfer")}
                    </button>
                  </div>

                  {/* Transfer Section */}
                  {targetBookings.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-rose-200 space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          {t("booking:transfer.selectBooking")}:
                        </label>
                        <div className="max-h-64 space-y-2 overflow-y-auto rounded-xl border border-purple-200 bg-purple-50/40 p-2">
                          {targetBookings.map((b) => {
                            const isSelected = transferTargetBooking === b.id;
                            const targetStatusKey = resolveBookingStatus(b.status);
                            const targetStatusTheme = getBookingStatusTheme(targetStatusKey);
                            const roomTypeLabel = b.roomTypeName || t("booking:modal.roomType");
                            const roomLabel = b.assignedRoom?.roomNumber
                              ? `№${b.assignedRoom.roomNumber}`
                              : t("booking:modal.notAssigned");

                            return (
                              <button
                                key={b.id}
                                type="button"
                                onClick={() => setTransferTargetBooking(b.id)}
                                className={`w-full rounded-lg border p-3 text-left transition ${isSelected
                                    ? "border-purple-500 bg-white shadow-sm ring-2 ring-purple-200"
                                    : "border-purple-200 bg-white/80 hover:border-purple-300 hover:bg-white"
                                  }`}
                              >
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-slate-700">
                                    {t("booking:details.bookingId")}:{" "}
                                    {b.id.slice(0, 8).toUpperCase()}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${targetStatusTheme.badgeClass}`}
                                  >
                                    {targetStatusTheme.label}
                                  </span>
                                </div>
                                <div className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
                                  <span>
                                    {t("booking:modal.dates")}:{" "}
                                    {parseDateOnly(b.checkInDate).toLocaleDateString(locale)} —{" "}
                                    {parseDateOnly(b.checkOutDate).toLocaleDateString(locale)}
                                  </span>
                                  <span>
                                    {t("booking:modal.room")}: {roomTypeLabel} {roomLabel}
                                  </span>
                                  <span>
                                    {t("booking:modal.pets")}: {b.numberOfPets}
                                  </span>
                                  <span>
                                    {t("booking:modal.total")}: {currency.format(b.totalPrice)}
                                  </span>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          {t("booking:paymentForm.amount")}:
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            max={availableForRefund}
                            step="0.01"
                            value={customTransferAmount}
                            onChange={(e) => setCustomTransferAmount(e.target.value)}
                            placeholder={availableForRefund.toString()}
                            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                          />
                          <button
                            onClick={() => setCustomTransferAmount(availableForRefund.toString())}
                            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            {t("booking:paymentForm.fullRemaining")}
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          Max: {currency.format(availableForRefund)}
                        </p>
                      </div>

                      <button
                        onClick={handleTransferPayment}
                        disabled={loading || !transferTargetBooking}
                        className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg disabled:opacity-50 transition"
                      >
                        {loading && pendingActionKey === "payment.transfer"
                          ? t("booking:paymentForm.processing")
                          : `${t("booking:transfer.transfer")} ${currency.format(parseFloat(customTransferAmount) || availableForRefund)}`}
                      </button>
                    </div>
                  )}

                  <div className="mt-4 pt-3 border-t border-rose-200">
                    <p className="text-xs text-rose-700 bg-rose-50 rounded-lg p-2 border border-rose-200 flex items-start gap-2">
                      <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>{t("common:messages.irreversibleAction")}</span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t("common:buttons.close")}
          </button>
        </div>
      </Modal>

      {/* Pet Modal */}
      {selectedPet && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <h3 className="text-lg font-bold text-slate-900">{selectedPet.name}</h3>
              <button
                onClick={() => setSelectedPet(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-50 flex items-center justify-center">
                  {selectedPetPhoto ? (
                    <img
                      src={selectedPetPhoto}
                      alt={selectedPet.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">🐾</span>
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {getSpeciesOptions().find((s) => s.value === selectedPet.species)?.label ??
                        t("booking:petCard.pet")}
                    </span>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                      {getGenderOptions().find((g) => g.value === selectedPet.gender)?.label ?? "—"}
                    </span>
                  </div>
                </div>
              </div>

              {petDetailsLoading ? (
                <p className="text-sm text-slate-500 text-center py-8">
                  {t("booking:petCard.loading")}
                </p>
              ) : petDetailsError ? (
                <p className="text-sm text-rose-600">{petDetailsError}</p>
              ) : (
                selectedPetDetails && (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <h5 className="text-xs font-bold text-slate-600 uppercase mb-2">
                        {t("booking:petCard.parameters")}
                      </h5>
                      <dl className="space-y-1.5 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-slate-600">{t("booking:petCard.breed")}:</dt>
                          <dd className="font-medium">{selectedPetDetails.breed || "—"}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-600">{t("booking:petCard.color")}:</dt>
                          <dd className="font-medium">{selectedPetDetails.color || "—"}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-600">{t("booking:petCard.weight")}:</dt>
                          <dd className="font-medium">
                            {selectedPetDetails.weight
                              ? t("booking:petCard.weightValue", {
                                value: selectedPetDetails.weight,
                              })
                              : "—"}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-600">{t("booking:petCard.age")}:</dt>
                          <dd className="font-medium">
                            {selectedPetDetails.ageYears
                              ? t("booking:petCard.ageValue", {
                                value: selectedPetDetails.ageYears,
                              })
                              : "—"}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-600">{t("booking:petCard.chip")}:</dt>
                          <dd className="font-mono text-xs font-medium">
                            {selectedPetDetails.microchip || "—"}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    {selectedPetDetails.specialNeeds && (
                      <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                        <h5 className="text-xs font-bold text-amber-700 uppercase mb-2">
                          {t("booking:petCard.specialNeeds")}
                        </h5>
                        <p className="text-sm text-slate-700 whitespace-pre-line">
                          {selectedPetDetails.specialNeeds}
                        </p>
                      </div>
                    )}

                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
                      <h5 className="text-xs font-bold text-emerald-700 uppercase mb-2">
                        {t("booking:petCard.veterinaryDocuments")}
                      </h5>
                      <p className="text-xs text-slate-500">
                        {t("booking:petCard.documentsUnavailable")}
                      </p>
                    </div>
                  </div>
                )
              )}
            </div>

            <div className="sticky bottom-0 flex justify-end border-t border-slate-100 bg-white px-6 py-4">
              <button
                onClick={() => setSelectedPet(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        receipt={receipt}
        loading={receiptLoading}
        error={null}
        zIndex={251}
      />

      {/* Confirm Action Modal */}
      <ConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction?.onConfirm()}
        message={confirmAction?.message ?? ""}
        type={confirmAction?.type ?? "warning"}
        zIndex={9999}
      />
    </>
  );
};

export default UnifiedBookingModal;
