import { useMemo, useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { getSpeciesLabel, getGenderOptions } from "../../constants/pet";
import useLocale from "../../hooks/useLocale";
import {
  BanknotesIcon,
  CalendarDaysIcon,
  ClockIcon,
  HomeModernIcon,
  UserGroupIcon,
  SparklesIcon,
  ClipboardDocumentListIcon,
  ShieldCheckIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClipboardDocumentCheckIcon,
  XMarkIcon,
  HomeIcon,
} from "@heroicons/react/24/outline";

export type AdminBooking = {
  id: string;
  clientId: string;
  roomTypeId: string;
  roomTypeName: string;
  assignedRoomId?: string | null;
  checkInDate: string;
  checkOutDate: string;
  numberOfNights: number;
  numberOfPets: number;
  status: string;
  totalPrice: number;
  paidAmount: number;
  remainingAmount: number;
  requiredPrepaymentAmount?: number;
  prepaymentCancelled?: boolean;
  paymentApproved?: boolean;
  discountPercent?: number;
  loyaltyDiscountPercent?: number;
  discountAmount?: number;
  basePrice?: number;
  additionalPetsPrice?: number;
  servicesPrice?: number;
  createdAt: string;
  originalCheckOutDate?: string | null;
  isEarlyCheckout?: boolean;
  specialRequests?: string | null;
  overpaymentConvertedToRevenue?: boolean;
  revenueConversionAmount?: number;
  revenueConversionComment?: string;
  // Composite bookings
  isComposite?: boolean;
  parentBookingId?: string | null;
  segmentOrder?: number | null;
  childBookings?: AdminBooking[];
  roomType?: {
    id: string;
    name: string;
    maxCapacity?: number;
    pricePerNight?: number;
    pricePerAdditionalPet?: number;
  };
  assignedRoom?: {
    id: string;
    roomNumber: string;
    roomTypeId: string;
    roomTypeName: string;
    floor?: number | null;
    specialNotes?: string | null;
    isActive: boolean;
  };
  client?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    internalNotes?: string | null;
  };
  pets?: Array<{
    id: string;
    name: string;
    species: number;
    gender: number;
    type?: string;
    breed?: string;
    age?: number;
    birthDate?: string;
    color?: string;
    weight?: number;
    microchip?: string;
    specialNeeds?: string;
    photoUrl?: string | null;
  }>;
  room?: {
    id?: string;
    roomNumber?: string;
    roomType?: string;
  };
};

type AdminPendingBookingsProps = {
  bookings: AdminBooking[];
  loading: boolean;
  onConfirm: (bookingId: string) => Promise<void>;
  onDelete: (bookingId: string) => Promise<void>;
  onRefresh: () => void;
  onAssignRoom?: (bookingId: string, roomId: string) => Promise<void>;
};

type Room = {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  floor?: number | null;
  specialNotes?: string | null;
  isActive: boolean;
};

const AdminPendingBookings = ({
  bookings,
  loading,
  onConfirm,
  onDelete,
  onRefresh,
  onAssignRoom,
}: AdminPendingBookingsProps) => {
  const { t, i18n } = useTranslation();
  const { authFetch } = useAuth();
  const { locale } = useLocale();
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

  // Filter composite bookings: show only parents (isComposite=true) and simple bookings
  // Hide segments (parentBookingId != null) as they will be shown inside parent
  const displayBookings = useMemo(() => {
    return bookings.filter((b) => !b.parentBookingId);
  }, [bookings]);

  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewBooking, setViewBooking] = useState<AdminBooking | null>(null);
  const [selectedPet, setSelectedPet] = useState<{
    id: string;
    name: string;
    species: number;
    gender: number;
  } | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [selectedRoomForAssignment, setSelectedRoomForAssignment] = useState<string>("");
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [assigningRoom, setAssigningRoom] = useState(false);
  const [confirmSuccess, setConfirmSuccess] = useState(false);

  // For composite bookings: state for each segment
  const [segmentRooms, setSegmentRooms] = useState<Record<string, Room[]>>({});
  const [selectedSegmentRooms, setSelectedSegmentRooms] = useState<Record<string, string>>({});
  const [loadingSegmentRooms, setLoadingSegmentRooms] = useState<Record<string, boolean>>({});
  const [assigningSegmentRoom, setAssigningSegmentRoom] = useState<string | null>(null);
  type PetDetails = {
    id: string;
    clientId: string;
    name: string;
    species: number;
    breed?: string | null;
    birthDate?: string | null;
    ageYears?: number | null;
    gender: number;
    weight?: number | null;
    color?: string | null;
    microchip?: string | null;
    specialNeeds?: string | null;
    internalNotes?: string | null;
    photoUrl?: string | null;
    isActive: boolean;
    createdAt: string;
  };
  const [selectedPetDetails, setSelectedPetDetails] = useState<PetDetails | null>(null);
  const [selectedPetPhoto, setSelectedPetPhoto] = useState<string | null>(null);
  const [petDetailsLoading, setPetDetailsLoading] = useState(false);
  const [petDetailsError, setPetDetailsError] = useState<string | null>(null);
  const [fullSizePhotoUrl, setFullSizePhotoUrl] = useState<string | null>(null);

  const loadSegmentRoomsForBooking = useCallback(
    async (targetBooking: AdminBooking) => {
      if (!targetBooking.isComposite || !targetBooking.childBookings || !onAssignRoom) {
        setSegmentRooms({});
        setSelectedSegmentRooms({});
        setLoadingSegmentRooms({});
        return;
      }

      const roomsMap: Record<string, Room[]> = {};
      const loadingMap: Record<string, boolean> = {};
      const selectedMap: Record<string, string> = {};

      for (const segment of targetBooking.childBookings) {
        loadingMap[segment.id] = true;
        selectedMap[segment.id] = segment.assignedRoomId || "";
      }

      setLoadingSegmentRooms(loadingMap);
      setSelectedSegmentRooms(selectedMap);

      await Promise.all(
        targetBooking.childBookings.map(async (segment) => {
          try {
            const params = new URLSearchParams({
              roomTypeId: segment.roomTypeId,
              checkIn: segment.checkInDate,
              checkOut: segment.checkOutDate,
            });
            const response = await authFetch(`/api/rooms/available?${params.toString()}`);
            if (!response.ok) {
              throw new Error(t("admin:pendingBookings.loadRoomsError"));
            }
            roomsMap[segment.id] = await response.json();
          } catch (err) {
            console.error(`Error loading rooms for segment ${segment.id}:`, err);
            roomsMap[segment.id] = [];
          } finally {
            loadingMap[segment.id] = false;
          }
        })
      );

      setSegmentRooms(roomsMap);
      setLoadingSegmentRooms({ ...loadingMap });
    },
    [authFetch, onAssignRoom, t]
  );

  useEffect(() => {
    let cancelled = false;
    const loadPhoto = async () => {
      if (!selectedPet) return;
      try {
        const res = await authFetch(`/api/pets/${selectedPet.id}/photo`);
        if (!res.ok) return;
        const blob = await res.blob();
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setSelectedPetPhoto((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch {
        /* no-empty */
      }
    };
    void loadPhoto();
    return () => {
      cancelled = true;
      setSelectedPetPhoto((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [authFetch, selectedPet]);

  useEffect(() => {
    let cancelled = false;
    const loadDetails = async () => {
      if (!selectedPet) {
        setSelectedPetDetails(null);
        setPetDetailsError(null);
        return;
      }
      setPetDetailsLoading(true);
      setPetDetailsError(null);
      try {
        const res = await authFetch("/api/admin/clients");
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? t("admin:pendingBookings.loadPetDataError"));
        }
        const clients = (await res.json()) as Array<{ id: string; pets: PetDetails[] }>;
        if (cancelled) return;
        let found: PetDetails | null = null;
        for (const c of clients) {
          const p = c.pets?.find((x) => x.id === selectedPet.id);
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
    void loadDetails();
    return () => {
      cancelled = true;
    };
  }, [authFetch, selectedPet, t]);

  // Load available rooms when viewing a booking
  useEffect(() => {
    let cancelled = false;
    const loadRooms = async () => {
      if (!viewBooking) {
        setAvailableRooms([]);
        setSelectedRoomForAssignment("");
        return;
      }

      // Set selected room if already assigned
      if (viewBooking.assignedRoomId) {
        setSelectedRoomForAssignment(viewBooking.assignedRoomId);
      } else {
        setSelectedRoomForAssignment("");
      }

      // Only load available rooms if onAssignRoom is provided
      if (!onAssignRoom) return;

      setLoadingRooms(true);
      try {
        const params = new URLSearchParams({
          roomTypeId: viewBooking.roomTypeId,
          checkIn: viewBooking.checkInDate,
          checkOut: viewBooking.checkOutDate,
        });
        const response = await authFetch(`/api/rooms/available?${params.toString()}`);
        if (!response.ok) {
          throw new Error(t("admin:pendingBookings.loadRoomsError"));
        }
        const rooms = await response.json();
        if (!cancelled) {
          setAvailableRooms(rooms);
        }
      } catch (err) {
        console.error("Error loading available rooms:", err);
        if (!cancelled) {
          setAvailableRooms([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingRooms(false);
        }
      }
    };
    void loadRooms();
    return () => {
      cancelled = true;
    };
  }, [viewBooking, authFetch, onAssignRoom, t]);

  // Load available rooms for each segment of composite booking
  useEffect(() => {
    if (!viewBooking || !viewBooking.isComposite || !viewBooking.childBookings || !onAssignRoom) {
      setSegmentRooms({});
      setSelectedSegmentRooms({});
      setLoadingSegmentRooms({});
      return;
    }

    void loadSegmentRoomsForBooking(viewBooking);
  }, [viewBooking, loadSegmentRoomsForBooking, onAssignRoom]);

  // Date parser 'YYYY-MM-DD' to local time (without timezone offset)
  const parseDateOnly = (s: string) => {
    const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(s);
    if (!m) return new Date(s);
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  };

  const handleAssignRoom = async () => {
    if (!viewBooking || !onAssignRoom || !selectedRoomForAssignment) return;

    try {
      setAssigningRoom(true);
      setError(null);
      await onAssignRoom(viewBooking.id, selectedRoomForAssignment);

      // Update local viewBooking state without reloading modal
      const assignedRoom = availableRooms.find((r) => r.id === selectedRoomForAssignment);
      setViewBooking({
        ...viewBooking,
        assignedRoomId: selectedRoomForAssignment,
        assignedRoom: assignedRoom
          ? {
              id: assignedRoom.id,
              roomNumber: assignedRoom.roomNumber,
              roomTypeId: assignedRoom.roomTypeId,
              roomTypeName: viewBooking.roomTypeName,
              floor: assignedRoom.floor,
              specialNotes: assignedRoom.specialNotes,
              isActive: assignedRoom.isActive,
            }
          : undefined,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAssigningRoom(false);
    }
  };

  const handleAssignSelectedSegmentRooms = async () => {
    if (!viewBooking || !viewBooking.childBookings || !onAssignRoom) return;

    const targetSegments = viewBooking.childBookings.filter(
      (segment) => !segment.assignedRoomId && !!selectedSegmentRooms[segment.id]
    );
    if (targetSegments.length === 0) {
      setError(t("admin:pendingBookings.selectSegmentsFirst"));
      return;
    }

    try {
      setAssigningSegmentRoom("all");
      setError(null);

      for (const segment of targetSegments) {
        const roomId = selectedSegmentRooms[segment.id];
        if (!roomId) continue;
        await onAssignRoom(segment.id, roomId);
      }

      const updatedBooking = {
        ...viewBooking,
        childBookings: viewBooking.childBookings.map((segment) => {
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

      setViewBooking(updatedBooking);
      await loadSegmentRoomsForBooking(updatedBooking);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAssigningSegmentRoom(null);
    }
  };

  const handleConfirm = async (bookingId: string) => {
    const target = bookings.find((b) => b.id === bookingId);
    if (target) {
      const simpleOk = !target.isComposite && !!target.assignedRoomId;
      const compositeOk = target.isComposite
        ? (target.childBookings?.every((s) => s.assignedRoomId) ?? false)
        : true;
      const canProceed = target.isComposite ? compositeOk : simpleOk;
      if (!canProceed) {
        setError(
          target.isComposite
            ? t("admin:pendingBookings.assignAllSegmentsError")
            : t("admin:pendingBookings.assignRoomError")
        );
        return;
      }
    }

    try {
      setConfirmingId(bookingId);
      setError(null);
      await onConfirm(bookingId);

      // Show success
      setConfirmSuccess(true);

      // Close modal after 1.5 seconds
      setTimeout(() => {
        setConfirmSuccess(false);
        setViewBooking(null);
        onRefresh(); // Update list only after modal closes
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setConfirmingId(null);
    }
  };

  const handleDelete = async (bookingId: string) => {
    try {
      setDeletingId(bookingId);
      setError(null);
      await onDelete(bookingId);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  // Unified button styles
  return (
    <section className="rounded-2xl bg-gradient-to-br from-white to-slate-50 p-4 sm:p-6 shadow-lg border border-slate-100">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            {t("admin:pendingBookings.title")}
          </h2>
          <p className="text-xs text-slate-600 mt-1">{t("admin:pendingBookings.subtitle")}</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="shrink-0 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700 hover:shadow disabled:opacity-50"
        >
          {loading ? "⏳" : `🔄 ${t("admin:pendingBookings.refresh")}`}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-gradient-to-r from-rose-50 to-red-50 border border-rose-200 px-4 py-3 text-sm text-rose-700 shadow-sm">
          ⚠️ {error}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-500"></div>
          <span className="text-sm text-slate-500">{t("admin:pendingBookings.loading")}</span>
        </div>
      ) : displayBookings.length === 0 ? (
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-6 py-8 text-center">
          <div className="text-4xl mb-2">✅</div>
          <p className="text-sm text-slate-600 font-medium">
            {t("admin:pendingBookings.noBookings")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayBookings.map((booking) => {
            const clientName = booking.client
              ? `${booking.client.lastName} ${booking.client.firstName}`
              : t("admin:pendingBookings.unknown");
            const parseDateOnly = (s: string) => {
              const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})/.exec(s);
              if (!m) return new Date(s);
              return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
            };
            const dateLocale = i18n.language === "ru" ? "ru-RU" : "en-US";
            const period = `${parseDateOnly(booking.checkInDate).toLocaleDateString(dateLocale)} — ${parseDateOnly(
              booking.checkOutDate
            ).toLocaleDateString(dateLocale)}`;
            const roomLabel = booking.assignedRoom
              ? `${booking.assignedRoom.roomTypeName} #${booking.assignedRoom.roomNumber}`
              : `${booking.roomTypeName} (${t("admin:pendingBookings.notAssigned")})`;

            // For composite bookings collect pets from all segments
            const displayPets =
              booking.isComposite && booking.childBookings
                ? booking.childBookings
                    .flatMap((seg) => seg.pets || [])
                    .filter((pet, index, self) => self.findIndex((p) => p.id === pet.id) === index) // remove duplicates
                : booking.pets || [];

            const actualPetsCount = displayPets.length;

            return (
              <article
                key={booking.id}
                className="rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition"
              >
                <div className="p-3 sm:p-4 lg:p-3 space-y-2 lg:space-y-1.5">
                  <div className="flex flex-wrap items-start justify-between gap-2 sm:gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] text-slate-500">
                        {t("admin:pendingBookings.client")}
                      </p>
                      <h3 className="text-sm sm:text-base font-semibold text-slate-900 leading-tight">
                        {clientName}
                      </h3>
                      <div className="text-[11px] text-slate-600 space-x-2">
                        {booking.client?.email && <span>{booking.client.email}</span>}
                        {booking.client?.phone && <span>• {booking.client.phone}</span>}
                      </div>
                      {booking.client?.internalNotes && (
                        <p className="mt-1 text-[11px] text-amber-700 bg-amber-50 inline-block px-2 py-0.5 rounded">
                          {booking.client.internalNotes}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-end">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 border border-blue-200">
                        {t("admin:pendingBookings.waiting")}
                      </span>
                      {booking.isComposite && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 border border-amber-200">
                          {t("admin:pendingBookings.composite")}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700 border border-slate-200">
                        {new Date(booking.createdAt).toLocaleString(dateLocale, {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      <CalendarDaysIcon className="h-4 w-4 text-slate-500" />
                      {period} • {booking.numberOfNights} {t("admin:pendingBookings.days")}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      {booking.isComposite ? (
                        <UserGroupIcon className="h-4 w-4 text-slate-500" />
                      ) : (
                        <HomeModernIcon className="h-4 w-4 text-slate-500" />
                      )}
                      {booking.isComposite
                        ? `${actualPetsCount} ${t("admin:pendingBookings.pets")}`
                        : roomLabel}
                      {booking.isComposite && (
                        <span className="text-slate-500">
                          • {booking.childBookings?.length ?? 0}{" "}
                          {t("admin:pendingBookings.segments")}
                        </span>
                      )}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                      <BanknotesIcon className="h-4 w-4 text-emerald-600" />
                      {currency.format(booking.totalPrice)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      <ClockIcon className="h-4 w-4 text-slate-500" />
                      {t("admin:pendingBookings.created")}{" "}
                      {new Date(booking.createdAt).toLocaleTimeString(dateLocale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {booking.isComposite &&
                    booking.childBookings &&
                    booking.childBookings.length > 0 && (
                      <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-2 space-y-1 max-h-20 overflow-x-auto overflow-y-auto">
                        <p className="text-[11px] font-semibold text-amber-700">
                          {t("admin:pendingBookings.segmentsTitle")} ({booking.childBookings.length}
                          )
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {booking.childBookings
                            .sort((a, b) => (a.segmentOrder || 0) - (b.segmentOrder || 0))
                            .map((segment, idx) => {
                              const segPeriod = `${parseDateOnly(segment.checkInDate).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit" })} — ${parseDateOnly(segment.checkOutDate).toLocaleDateString(dateLocale, { day: "2-digit", month: "2-digit" })}`;
                              const segRoomLabel = segment.assignedRoom
                                ? `${segment.roomTypeName} #${segment.assignedRoom.roomNumber}`
                                : `${segment.roomTypeName} (${t("admin:pendingBookings.notAssigned")})`;
                              return (
                                <span
                                  key={segment.id}
                                  className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-2 py-1 text-[11px] text-slate-700"
                                >
                                  <span className="font-semibold text-amber-700">#{idx + 1}</span>
                                  <span className="text-slate-800">{segRoomLabel}</span>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-700">{segPeriod}</span>
                                  <span className="text-slate-400">•</span>
                                  <span className="text-slate-600">
                                    {segment.numberOfNights} {t("admin:pendingBookings.days")}
                                  </span>
                                </span>
                              );
                            })}
                        </div>
                      </div>
                    )}

                  <div className="flex flex-wrap lg:flex-nowrap items-center gap-2">
                    <p className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">
                      {t("admin:pendingBookings.petsTitle")}
                    </p>
                    {displayPets.length > 0 ? (
                      displayPets.map((pet) => (
                        <button
                          key={pet.id}
                          type="button"
                          onClick={() => {
                            setViewBooking(booking);
                            setSelectedPet(pet);
                          }}
                          className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:border-rose-300 hover:bg-rose-50"
                        >
                          {pet.name}
                          <span className="text-slate-500">• {getSpeciesLabel(pet.species)}</span>
                        </button>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">
                        {t("admin:pendingBookings.notSpecified")}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 justify-between items-center">
                    {booking.specialRequests && (
                      <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex-1 line-clamp-2 sm:line-clamp-none">
                        📝 {booking.specialRequests}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-end">
                      <button
                        onClick={() => setViewBooking(booking)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700"
                      >
                        {t("admin:pendingBookings.details")}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {viewBooking &&
        (() => {
          // For composite bookings collect pets from all segments
          const modalDisplayPets =
            viewBooking.isComposite && viewBooking.childBookings
              ? viewBooking.childBookings
                  .flatMap((seg) => seg.pets || [])
                  .filter((pet, index, self) => self.findIndex((p) => p.id === pet.id) === index) // remove duplicates
              : viewBooking.pets || [];

          const modalPetsCount = modalDisplayPets.length;

          return (
            <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 px-3 backdrop-blur-sm">
              <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
                <button
                  type="button"
                  className="absolute right-3 top-3 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => setViewBooking(null)}
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
                <div className="pr-8 mb-4">
                  <h3 className="text-base sm:text-lg font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                    {t("admin:pendingBookings.bookingDetails")}
                  </h3>
                  <p className="mt-1 text-xs text-slate-600">
                    {t("admin:pendingBookings.status")}{" "}
                    <span className="font-semibold">{viewBooking.status}</span>
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Client */}
                  <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 p-3">
                    <p className="text-xs font-bold text-slate-700 mb-1 inline-flex items-center gap-1">
                      <UserGroupIcon className="h-4 w-4 text-slate-500" />
                      {t("admin:pendingBookings.client")}
                    </p>
                    <p className="font-bold text-slate-900 mb-1">
                      {viewBooking.client
                        ? `${viewBooking.client.lastName} ${viewBooking.client.firstName}`
                        : t("admin:pendingBookings.unknownClient")}
                    </p>
                    {viewBooking.client?.email && (
                      <p className="text-sm text-slate-600">📧 {viewBooking.client.email}</p>
                    )}
                    {viewBooking.client?.phone && (
                      <p className="text-sm text-slate-600">📱 {viewBooking.client.phone}</p>
                    )}
                  </div>

                  {/* Admin notes about client */}
                  {viewBooking.client?.internalNotes && (
                    <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-3">
                      <p className="text-xs font-bold text-blue-700 mb-1 inline-flex items-center gap-1">
                        <ClipboardDocumentCheckIcon className="h-4 w-4 text-blue-500" />
                        {t("admin:pendingBookings.adminNotesClient")}
                      </p>
                      <p className="whitespace-pre-line text-sm text-slate-700 leading-snug">
                        {viewBooking.client.internalNotes}
                      </p>
                    </div>
                  )}

                  <div className="grid sm:grid-cols-2 gap-3">
                    {/* Period */}
                    <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 p-3">
                      <p className="text-xs font-bold text-blue-700 mb-1 inline-flex items-center gap-1">
                        <CalendarDaysIcon className="h-4 w-4 text-blue-500" />
                        {t("admin:pendingBookings.stayPeriod")}
                      </p>
                      <p className="font-semibold text-slate-900 text-sm mb-0.5">
                        {parseDateOnly(viewBooking.checkInDate).toLocaleDateString(
                          i18n.language === "ru" ? "ru-RU" : "en-US"
                        )}{" "}
                        —{" "}
                        {parseDateOnly(viewBooking.checkOutDate).toLocaleDateString(
                          i18n.language === "ru" ? "ru-RU" : "en-US"
                        )}
                      </p>
                      <p className="text-xs text-slate-600">
                        {viewBooking.numberOfNights} {t("admin:pendingBookings.days")} •{" "}
                        {modalPetsCount}{" "}
                        {modalPetsCount === 1
                          ? t("admin:pendingBookings.petsCount_one")
                          : t("admin:pendingBookings.petsCount_many")}
                      </p>
                      {viewBooking.isComposite && (
                        <p className="text-[11px] text-blue-600 font-semibold mt-1 inline-flex items-center gap-1">
                          <InformationCircleIcon className="h-4 w-4" />
                          {t("admin:pendingBookings.compositeInfo", {
                            count: viewBooking.childBookings?.length || 0,
                          })}
                        </p>
                      )}
                    </div>

                    {/* Room - only for simple bookings */}
                    {!viewBooking.isComposite && (
                      <div className="rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 p-3">
                        <p className="text-xs font-bold text-purple-700 mb-1 inline-flex items-center gap-1">
                          <HomeIcon className="h-4 w-4 text-purple-500" />
                          {t("admin:pendingBookings.room")}
                        </p>
                        <p className="font-semibold text-slate-900">
                          {viewBooking.assignedRoom
                            ? `${viewBooking.assignedRoom.roomTypeName} #${viewBooking.assignedRoom.roomNumber}`
                            : `${viewBooking.roomTypeName} (${t("admin:pendingBookings.notAssigned")})`}
                        </p>
                      </div>
                    )}

                    {/* Segments - only for composite bookings */}
                    {viewBooking.isComposite && viewBooking.childBookings && (
                      <div className="rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 p-3">
                        <p className="text-xs font-bold text-purple-700 mb-1 inline-flex items-center gap-1">
                          <ClipboardDocumentListIcon className="h-4 w-4 text-purple-500" />
                          {t("admin:pendingBookings.segmentsLabel")}
                        </p>
                        <div className="space-y-0.5">
                          {viewBooking.childBookings
                            .sort((a, b) => (a.segmentOrder || 0) - (b.segmentOrder || 0))
                            .map((seg, idx) => {
                              const segDateLocale = i18n.language === "ru" ? "ru-RU" : "en-US";
                              const segDates = `${parseDateOnly(seg.checkInDate).toLocaleDateString(segDateLocale, { day: "2-digit", month: "2-digit" })} — ${parseDateOnly(seg.checkOutDate).toLocaleDateString(segDateLocale, { day: "2-digit", month: "2-digit" })}`;
                              return (
                                <div key={seg.id} className="text-[11px] text-slate-700">
                                  <span className="font-semibold">#{idx + 1}</span>{" "}
                                  {seg.roomTypeName} • {segDates}
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cost */}
                  <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-3">
                    <p className="text-xs font-bold text-emerald-700 mb-1 inline-flex items-center gap-1">
                      <BanknotesIcon className="h-4 w-4 text-emerald-600" />
                      {t("admin:pendingBookings.bookingCost")}
                    </p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-900">
                      {currency.format(viewBooking.totalPrice)}
                    </p>
                    {typeof viewBooking.roomType?.pricePerNight === "number" && (
                      <p className="text-sm text-emerald-700 mt-0.5">
                        {t("admin:pendingBookings.perNight")}{" "}
                        {currency.format(viewBooking.roomType!.pricePerNight!)}
                      </p>
                    )}
                  </div>

                  {/* Pets */}
                  <div className="rounded-xl bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 p-3">
                    <p className="text-xs font-bold text-rose-700 mb-2 inline-flex items-center gap-1">
                      <ShieldCheckIcon className="h-4 w-4 text-rose-500" />
                      {t("admin:pendingBookings.petsDocs")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {modalDisplayPets.length > 0 ? (
                        modalDisplayPets.map((pet) => (
                          <button
                            key={pet.id}
                            type="button"
                            onClick={() => setSelectedPet(pet)}
                            className="rounded-xl bg-white border-2 border-rose-300 px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-rose-100 hover:border-rose-400 hover:shadow-md"
                          >
                            {pet.name} • {getSpeciesLabel(pet.species)}
                          </button>
                        ))
                      ) : (
                        <span className="text-sm text-slate-500">
                          {t("admin:pendingBookings.petsNotSpecified")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Special requests */}
                  {viewBooking.specialRequests && (
                    <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-3">
                      <p className="text-xs font-bold text-amber-700 mb-1 inline-flex items-center gap-1">
                        <SparklesIcon className="h-4 w-4 text-amber-500" />
                        {t("admin:pendingBookings.specialRequests")}
                      </p>
                      <p className="whitespace-pre-line text-sm text-slate-700 leading-snug">
                        {viewBooking.specialRequests}
                      </p>
                    </div>
                  )}

                  {/* Composite Booking Segments - Only show for composite bookings */}
                  {viewBooking.isComposite &&
                    viewBooking.childBookings &&
                    viewBooking.childBookings.length > 0 &&
                    onAssignRoom && (
                      <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-3">
                        <p className="text-xs font-bold text-amber-700 mb-2 inline-flex items-center gap-1">
                          <HomeModernIcon className="h-4 w-4 text-amber-600" />
                          {t("admin:pendingBookings.assignRoomsSegments")}
                        </p>
                        <p className="text-sm text-amber-700 mb-3">
                          {t("admin:pendingBookings.assignRoomsDesc")}
                        </p>
                        <div className="space-y-3">
                          {viewBooking.childBookings
                            .sort((a, b) => (a.segmentOrder || 0) - (b.segmentOrder || 0))
                            .map((segment, idx) => {
                              const segDateLocale = i18n.language === "ru" ? "ru-RU" : "en-US";
                              const segPeriod = `${parseDateOnly(segment.checkInDate).toLocaleDateString(segDateLocale, { day: "2-digit", month: "2-digit" })} — ${parseDateOnly(segment.checkOutDate).toLocaleDateString(segDateLocale, { day: "2-digit", month: "2-digit" })}`;
                              const rooms = segmentRooms[segment.id] || [];
                              const isLoading = loadingSegmentRooms[segment.id];

                              return (
                                <div
                                  key={segment.id}
                                  className="rounded-lg bg-white border border-amber-300 p-3"
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-bold text-amber-600">#{idx + 1}</span>
                                    <span className="font-medium text-slate-700">
                                      {segment.roomTypeName}
                                    </span>
                                    <span className="text-slate-500">•</span>
                                    <span className="text-sm text-slate-600">{segPeriod}</span>
                                    <span className="text-slate-500">•</span>
                                    <span className="text-sm text-slate-600">
                                      {segment.numberOfNights} {t("admin:pendingBookings.days")}
                                    </span>
                                  </div>

                                  {segment.assignedRoomId ? (
                                    <div className="rounded-lg bg-emerald-50 border border-emerald-300 p-2">
                                      <p className="text-xs text-emerald-700 mb-0.5 inline-flex items-center gap-1">
                                        <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                                        {t("admin:pendingBookings.roomAssigned")}
                                      </p>
                                      <p className="text-sm font-bold text-slate-900">
                                        {segment.assignedRoom
                                          ? `#${segment.assignedRoom.roomNumber}`
                                          : `#${segment.assignedRoomId.slice(0, 8)}`}
                                      </p>
                                    </div>
                                  ) : isLoading ? (
                                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-2 text-center">
                                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600"></div>
                                      <p className="mt-1 text-xs text-slate-600">
                                        {t("admin:pendingBookings.loadingRooms")}
                                      </p>
                                    </div>
                                  ) : rooms.length === 0 ? (
                                    <div className="rounded-lg bg-rose-50 border border-rose-300 p-2 text-xs text-rose-700">
                                      <ExclamationTriangleIcon className="h-4 w-4 inline mr-1 align-[-2px]" />
                                      {t("admin:pendingBookings.noRoomsAvailable")}
                                    </div>
                                  ) : (
                                    <div className="flex gap-2">
                                      <select
                                        value={selectedSegmentRooms[segment.id] || ""}
                                        onChange={(e) =>
                                          setSelectedSegmentRooms({
                                            ...selectedSegmentRooms,
                                            [segment.id]: e.target.value,
                                          })
                                        }
                                        className="flex-1 rounded-lg border border-amber-300 bg-white px-2 py-1 text-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-200"
                                      >
                                        <option value="">
                                          {t("admin:pendingBookings.selectRoom")}
                                        </option>
                                        {rooms.map((room) => (
                                          <option key={room.id} value={room.id}>
                                            №{room.roomNumber}
                                            {room.floor != null
                                              ? ` (${t("admin:pendingBookings.floorShort")} ${room.floor})`
                                              : ""}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          <button
                            type="button"
                            onClick={handleAssignSelectedSegmentRooms}
                            disabled={
                              assigningSegmentRoom === "all" ||
                              !viewBooking.childBookings.some(
                                (segment) =>
                                  !segment.assignedRoomId && !!selectedSegmentRooms[segment.id]
                              )
                            }
                            className="w-full rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {assigningSegmentRoom === "all"
                              ? t("admin:pendingBookings.processing")
                              : t("admin:pendingBookings.assignSelectedSegments")}
                          </button>
                        </div>
                      </div>
                    )}

                  {/* Room Assignment Section - Only show for simple bookings if onAssignRoom is provided */}
                  {onAssignRoom && !viewBooking.isComposite && (
                    <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 p-3">
                      <p className="text-xs font-bold text-indigo-700 mb-2 inline-flex items-center gap-1">
                        <HomeModernIcon className="h-4 w-4 text-indigo-500" />
                        {t("admin:pendingBookings.roomAssignment")}
                      </p>
                      {viewBooking.assignedRoomId ? (
                        <div className="rounded-lg bg-white border border-indigo-200 p-3">
                          <p className="text-sm text-slate-600 mb-1 inline-flex items-center gap-1">
                            <CheckCircleIcon className="h-4 w-4 text-indigo-500" />
                            {t("admin:pendingBookings.roomAlreadyAssigned")}
                          </p>
                          <p className="text-base font-bold text-slate-900">
                            {viewBooking.assignedRoom
                              ? `${viewBooking.assignedRoom.roomTypeName} #${viewBooking.assignedRoom.roomNumber}`
                              : `${t("admin:pendingBookings.room")} #${viewBooking.assignedRoomId.slice(0, 8)}`}
                          </p>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-indigo-700 mb-3">
                            {t("admin:pendingBookings.assignRoomDesc")}
                          </p>
                          {loadingRooms ? (
                            <div className="rounded-lg bg-white border border-indigo-200 p-4 text-center">
                              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                              <p className="mt-2 text-sm text-slate-600">
                                {t("admin:pendingBookings.loadingAvailableRooms")}
                              </p>
                            </div>
                          ) : availableRooms.length === 0 ? (
                            <div className="rounded-lg bg-amber-50 border border-amber-300 p-3 text-sm text-amber-700">
                              <ExclamationTriangleIcon className="h-4 w-4 inline mr-1 align-[-2px]" />
                              {t("admin:pendingBookings.noRoomsForDates")} &quot;
                              {viewBooking.roomTypeName}&quot;
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              <label className="flex flex-col gap-2">
                                <span className="text-sm font-medium text-slate-700">
                                  {t("admin:pendingBookings.selectRoomLabel")}
                                </span>
                                <select
                                  value={selectedRoomForAssignment}
                                  onChange={(e) => setSelectedRoomForAssignment(e.target.value)}
                                  className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                                >
                                  <option value="">{t("admin:pendingBookings.chooseRoom")}</option>
                                  {availableRooms.map((room) => (
                                    <option key={room.id} value={room.id}>
                                      №{room.roomNumber}
                                      {room.floor != null
                                        ? ` (${t("admin:pendingBookings.floor")} ${room.floor})`
                                        : ""}
                                      {room.specialNotes ? ` - ${room.specialNotes}` : ""}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <button
                                type="button"
                                onClick={handleAssignRoom}
                                disabled={!selectedRoomForAssignment || assigningRoom}
                                className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:shadow-lg hover:from-indigo-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {assigningRoom
                                  ? `⏳ ${t("admin:pendingBookings.assigningRoom")}`
                                  : t("admin:pendingBookings.assignRoom")}
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* Information block */}
                  <div className="rounded-xl bg-gradient-to-r from-blue-50 to-cyan-50 border border-blue-200 p-3">
                    <p className="text-sm font-bold text-blue-900 mb-1 inline-flex items-center gap-1">
                      <InformationCircleIcon className="h-5 w-5 text-blue-500" />
                      {t("admin:pendingBookings.afterConfirmInfo")}
                    </p>
                    <p className="text-sm text-blue-700">
                      {t("admin:pendingBookings.afterConfirmDesc")}
                    </p>
                  </div>

                  {/* Success confirmation message */}
                  {confirmSuccess && (
                    <div className="rounded-xl bg-gradient-to-r from-emerald-100 to-green-100 border border-emerald-300 p-3">
                      <p className="text-center text-lg font-bold text-emerald-800 inline-flex items-center justify-center gap-2">
                        <CheckCircleIcon className="h-5 w-5 text-emerald-700" />
                        {t("admin:pendingBookings.confirmSuccess")}
                      </p>
                      <p className="text-center text-sm text-emerald-700 mt-1">
                        {t("admin:pendingBookings.confirmSuccessDesc")}
                      </p>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex flex-wrap justify-end gap-3 pt-2">
                    {(() => {
                      // For composite bookings: check that all segments have assigned rooms
                      const allSegmentsAssigned = viewBooking.isComposite
                        ? (viewBooking.childBookings?.every((s) => s.assignedRoomId) ?? false)
                        : true;

                      // For simple bookings: check that room is assigned
                      const canConfirm = viewBooking.isComposite
                        ? allSegmentsAssigned
                        : !onAssignRoom || viewBooking.assignedRoomId;

                      const confirmTitle = !canConfirm
                        ? viewBooking.isComposite
                          ? t("admin:pendingBookings.firstAssignAllRooms")
                          : t("admin:pendingBookings.firstAssignRoom")
                        : "";

                      return (
                        <button
                          type="button"
                          onClick={() => handleConfirm(viewBooking.id)}
                          disabled={confirmingId === viewBooking.id || !canConfirm}
                          className="rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:shadow-xl hover:from-emerald-600 hover:to-green-600 disabled:opacity-60 disabled:cursor-not-allowed"
                          title={confirmTitle}
                        >
                          {confirmingId === viewBooking.id
                            ? `⏳ ${t("admin:pendingBookings.processing")}`
                            : t("admin:pendingBookings.allowPayment")}
                        </button>
                      );
                    })()}
                    <button
                      type="button"
                      onClick={() => handleDelete(viewBooking.id)}
                      disabled={deletingId === viewBooking.id}
                      className="rounded-xl border-2 border-rose-300 bg-white px-5 py-3 text-sm font-bold text-rose-600 shadow-sm transition hover:bg-rose-600 hover:text-white hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {deletingId === viewBooking.id
                        ? `⏳ ${t("admin:pendingBookings.deleting")}`
                        : t("admin:pendingBookings.reject")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewBooking(null)}
                      className="rounded-xl border-2 border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      {t("admin:pendingBookings.close")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      {selectedPet && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              onClick={() => setSelectedPet(null)}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            <div className="flex items-start gap-4 pr-8 mb-5">
              <button
                type="button"
                onClick={async () => {
                  if (!selectedPet || !selectedPetPhoto) return;
                  setFullSizePhotoUrl(selectedPetPhoto);
                }}
                className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-pink-50 flex items-center justify-center shadow-md hover:shadow-lg hover:border-rose-400 transition-all cursor-pointer group"
                title={t("admin:pendingBookings.petDetails.fullSizePhoto")}
              >
                {selectedPetPhoto ? (
                  <img
                    src={selectedPetPhoto}
                    alt={selectedPet.name}
                    className="h-full w-full object-cover group-hover:scale-110 transition-transform"
                  />
                ) : (
                  <svg viewBox="0 0 24 24" className="h-10 w-10 text-rose-300">
                    <circle cx="12" cy="8" r="4" fill="currentColor" />
                    <path d="M4 20c0-4 4-6 8-6s8 2 8 6" fill="currentColor" />
                  </svg>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold bg-gradient-to-r from-rose-600 to-pink-600 bg-clip-text text-transparent">
                  {selectedPet.name}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gradient-to-r from-rose-100 to-pink-100 border border-rose-300 px-3 py-1 text-xs font-semibold text-rose-700">
                    {getSpeciesLabel(selectedPet.species)}
                  </span>
                  <span className="rounded-full bg-gradient-to-r from-blue-100 to-indigo-100 border border-blue-300 px-3 py-1 text-xs font-semibold text-blue-700">
                    {getGenderOptions().find((g) => g.value === selectedPet.gender)?.label ?? "—"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Parameters */}
              <div className="rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 p-4">
                <p className="text-xs font-bold text-slate-700 mb-3">
                  📋 {t("admin:pendingBookings.petDetails.mainParams")}
                </p>
                {petDetailsLoading ? (
                  <div className="flex items-center gap-2 py-4">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-rose-500"></div>
                    <span className="text-sm text-slate-500">
                      {t("admin:pendingBookings.petDetails.loading")}
                    </span>
                  </div>
                ) : petDetailsError ? (
                  <p className="text-sm text-rose-600">⚠️ {petDetailsError}</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-lg bg-white p-2">
                      <p className="text-xs text-slate-500">
                        {t("admin:pendingBookings.petDetails.breed")}
                      </p>
                      <p className="font-semibold text-slate-900">
                        {selectedPetDetails?.breed || "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2">
                      <p className="text-xs text-slate-500">
                        {t("admin:pendingBookings.petDetails.color")}
                      </p>
                      <p className="font-semibold text-slate-900">
                        {selectedPetDetails?.color || "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2">
                      <p className="text-xs text-slate-500">
                        {t("admin:pendingBookings.petDetails.weight")}
                      </p>
                      <p className="font-semibold text-slate-900">
                        {selectedPetDetails?.weight != null
                          ? `${selectedPetDetails.weight} ${t("admin:pendingBookings.petDetails.weightUnit")}`
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2">
                      <p className="text-xs text-slate-500">
                        {t("admin:pendingBookings.petDetails.age")}
                      </p>
                      <p className="font-semibold text-slate-900">
                        {selectedPetDetails?.ageYears != null
                          ? `${selectedPetDetails.ageYears} ${t("admin:pendingBookings.petDetails.ageUnit")}`
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2 col-span-2">
                      <p className="text-xs text-slate-500">
                        {t("admin:pendingBookings.petDetails.microchip")}
                      </p>
                      <p className="font-mono text-xs font-semibold text-slate-900">
                        {selectedPetDetails?.microchip || "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2">
                      <p className="text-xs text-slate-500">
                        {t("admin:pendingBookings.petDetails.birthDate")}
                      </p>
                      <p className="font-semibold text-slate-900 text-xs">
                        {selectedPetDetails?.birthDate
                          ? new Date(selectedPetDetails.birthDate).toLocaleDateString(
                              i18n.language === "ru" ? "ru-RU" : "en-US"
                            )
                          : "—"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-white p-2">
                      <p className="text-xs text-slate-500">
                        {t("admin:pendingBookings.petDetails.statusLabel")}
                      </p>
                      <p className="font-semibold text-slate-900">
                        {selectedPetDetails?.isActive
                          ? t("admin:pendingBookings.petDetails.active")
                          : t("admin:pendingBookings.petDetails.inactive")}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Pet special needs */}
              <div className="rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 p-4">
                <p className="text-xs font-bold text-amber-700 mb-2">
                  ⚡ {t("admin:pendingBookings.petDetails.specialNeeds")}
                </p>
                <p className="whitespace-pre-line text-sm text-slate-700">
                  {selectedPetDetails?.specialNeeds ||
                    t("admin:pendingBookings.petDetails.noSpecialNeeds")}
                </p>
              </div>

              {/* Admin notes about pet */}
              <div className="rounded-xl bg-gradient-to-br from-purple-50 to-indigo-50 border border-purple-200 p-4">
                <p className="text-xs font-bold text-purple-700 mb-2">
                  📝 {t("admin:pendingBookings.petDetails.adminNotes")}
                </p>
                <p className="whitespace-pre-line text-sm text-slate-700">
                  {selectedPetDetails?.internalNotes ||
                    t("admin:pendingBookings.petDetails.noAdminNotes")}
                </p>
              </div>

              {/* Veterinary documents */}
              <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-4">
                <p className="text-xs font-bold text-emerald-700 mb-3">
                  🏥 {t("admin:pendingBookings.petDetails.vetDocs")}
                </p>
                <p className="text-xs text-slate-500">
                  {t("admin:pendingBookings.petDetails.docsUnavailable")}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedPet(null)}
                className="rounded-xl border-2 border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {t("admin:pendingBookings.close")}
              </button>
            </div>
          </div>
        </div>
      )}
      {fullSizePhotoUrl && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 px-4 backdrop-blur-sm"
          onClick={() => setFullSizePhotoUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full p-3 bg-white/10 text-white hover:bg-white/20 transition-all z-10"
            onClick={() => setFullSizePhotoUrl(null)}
            title={t("admin:pendingBookings.close")}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <img
              src={fullSizePhotoUrl}
              alt={t("admin:pendingBookings.petDetails.fullSizePhoto")}
              className="max-h-[90vh] max-w-full rounded-lg shadow-2xl object-contain"
            />
          </div>
        </div>
      )}
    </section>
  );
};

export default AdminPendingBookings;
