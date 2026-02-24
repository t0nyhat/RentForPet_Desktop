import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import DateRangeCalendar from "../DateRangeCalendar";
import { getSpeciesLabel } from "../../constants/pet";
import {
  BookingCalculationMode,
  type BookingSettings,
  getUnitName as getBookingUnitName,
} from "../../types/booking";

type AdminClient = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string | null;
  loyaltyDiscountPercent?: number;
  pets: Array<{
    id: string;
    name: string;
    species: number;
    gender: number;
  }>;
};

type RoomType = {
  id: string;
  name: string;
  description: string;
  maxCapacity: number;
  pricePerNight: number;
  pricePerAdditionalPet: number;
  availableRoomsCount?: number;
};

type Room = {
  id: string;
  roomNumber: string;
  roomTypeId: string;
  floor?: number | null;
  specialNotes?: string | null;
  isActive: boolean;
};

type BookingSegmentDto = {
  checkInDate: string;
  checkOutDate: string;
  roomTypeId: string;
  roomTypeName: string;
  squareMeters: number;
  maxCapacity: number;
  nights: number;
  price: number;
};

type BookingOptionDto = {
  optionType: string; // "Single", "SameType", "Mixed"
  segments: BookingSegmentDto[];
  totalPrice: number;
  totalNights: number;
  warningMessage?: string | null;
  transferCount: number;
  priority: number;
  priceBreakdown?: {
    basePrice: number;
    additionalPetsPrice: number;
    discountAmount: number;
    loyaltyDiscountPercent: number;
    numberOfNights: number;
    numberOfPets: number;
  };
};

type BookingOptionsResponseDto = {
  singleRoomOptions: BookingOptionDto[];
  sameTypeTransferOptions: BookingOptionDto[];
  mixedTypeTransferOptions: BookingOptionDto[];
  totalOptions: number;
  hasPerfectOptions: boolean;
  checkInDate: string;
  checkOutDate: string;
  numberOfPets: number;
};

export type ManualBookingPayload = {
  clientId: string;
  roomTypeId?: string;
  assignedRoomId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  petIds: string[];
  specialRequests?: string;
  segments?: Array<{
    roomTypeId: string;
    checkInDate: string;
    checkOutDate: string;
  }>;
};

type AdminManualBookingFormProps = {
  clients: AdminClient[];
  roomTypes: RoomType[];
  onCreate: (payload: ManualBookingPayload) => Promise<void>;
  authFetch: (url: string, options?: Record<string, unknown>) => Promise<Response>;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const AdminManualBookingForm = ({ clients, onCreate, authFetch }: AdminManualBookingFormProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language.startsWith("ru") ? "ru-RU" : "en-US";

  // Helper function to format currency
  const formatCurrency = (amount: number): string => {
    const currencySymbol = i18n.language.startsWith("en") ? "$" : "₽";
    return `${amount.toLocaleString(locale)} ${currencySymbol}`;
  };

  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [roomsError, setRoomsError] = useState<string | null>(null);

  const [form, setForm] = useState({
    clientId: "",
    checkInDate: "",
    checkOutDate: "",
    petIds: [] as string[],
    specialRequests: "",
    roomId: "", // For simple bookings with assigned room
  });

  // Booking options after date selection
  const [bookingOptions, setBookingOptions] = useState<BookingOptionsResponseDto | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [selectedOption, setSelectedOption] = useState<BookingOptionDto | null>(null);
  const [bookingSettings, setBookingSettings] = useState<BookingSettings | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchBookingSettings = async () => {
      try {
        const response = await authFetch("/api/admin/settings/booking");
        if (!response.ok) {
          return;
        }
        const settings = (await response.json()) as BookingSettings;
        setBookingSettings(settings);
      } catch {
        // ignore and fallback to default mode (Days)
      }
    };
    void fetchBookingSettings();
  }, [authFetch]);

  // Ref for horizontal room slider
  const sliderRef = useRef<HTMLDivElement | null>(null);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.clientId),
    [clients, form.clientId]
  );
  const selectedClientDiscount = selectedClient?.loyaltyDiscountPercent ?? 0;
  const calculationMode = bookingSettings?.calculationMode ?? BookingCalculationMode.Days;

  const availablePets = selectedClient?.pets ?? [];

  // Filter clients by search query
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return clients;

    const query = clientSearchQuery.toLowerCase();
    return clients.filter((client) => {
      const fullName = `${client.firstName} ${client.lastName}`.toLowerCase();
      const email = client.email.toLowerCase();
      const phone = client.phone.toLowerCase();

      const hasPetMatch = client.pets.some((pet) => pet.name.toLowerCase().includes(query));

      return (
        fullName.includes(query) || email.includes(query) || phone.includes(query) || hasPetMatch
      );
    });
  }, [clients, clientSearchQuery]);

  // Flatten all booking options for display
  // Show all direct options and a small preview of transfer options.
  const allOptions = useMemo(() => {
    if (!bookingOptions) return [];

    const direct = bookingOptions.singleRoomOptions ?? [];
    const transfer = [
      ...(bookingOptions.sameTypeTransferOptions ?? []),
      ...(bookingOptions.mixedTypeTransferOptions ?? []),
    ]
      .sort((a, b) => {
        if (a.totalPrice !== b.totalPrice) return a.totalPrice - b.totalPrice;
        return a.transferCount - b.transferCount;
      })
      .slice(0, 2); // Show a couple of transfer options

    return [...direct, ...transfer];
  }, [bookingOptions]);

  // Check booking options when dates and pets are selected
  useEffect(() => {
    if (!form.checkInDate || !form.checkOutDate || form.petIds.length === 0 || !form.clientId) {
      setBookingOptions(null);
      setSelectedOption(null);
      return;
    }

    setCheckingAvailability(true);

    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const response = await authFetch("/api/bookings/options", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            checkInDate: form.checkInDate,
            checkOutDate: form.checkOutDate,
            numberOfPets: form.petIds.length,
            clientId: form.clientId,
          }),
        });

        if (!response.ok) {
          throw new Error(t("admin:manualBooking.errors.loadOptions"));
        }

        const data = (await response.json()) as BookingOptionsResponseDto;
        setBookingOptions(data);

        // Auto-select first option if available
        if (data.singleRoomOptions.length > 0) {
          setSelectedOption(data.singleRoomOptions[0]);
        } else if (data.sameTypeTransferOptions.length > 0) {
          setSelectedOption(data.sameTypeTransferOptions[0]);
        } else if (data.mixedTypeTransferOptions.length > 0) {
          setSelectedOption(data.mixedTypeTransferOptions[0]);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        console.error("Error loading booking options:", error);
        setBookingOptions(null);
      } finally {
        setCheckingAvailability(false);
      }
    }, 400);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [form.checkInDate, form.checkOutDate, form.petIds.length, form.clientId, authFetch, t]);

  // Load available rooms when a single room option is selected
  useEffect(() => {
    if (!selectedOption) {
      setAvailableRooms([]);
      setRoomsError(null);
      return;
    }

    // Only load rooms for simple bookings (single segment)
    if (selectedOption.segments.length > 1) {
      setAvailableRooms([]);
      setRoomsError(null);
      return;
    }

    const segment = selectedOption.segments[0];

    const loadAvailableRooms = async () => {
      setLoadingRooms(true);
      setRoomsError(null);
      try {
        const params = new URLSearchParams({
          roomTypeId: segment.roomTypeId,
          checkIn: segment.checkInDate,
          checkOut: segment.checkOutDate,
        });
        const response = await authFetch(`/api/rooms/available?${params.toString()}`);
        if (!response.ok) {
          throw new Error(t("admin:manualBooking.errors.loadRooms"));
        }
        const rooms = await response.json();
        setAvailableRooms(rooms);
        if (rooms.length === 0) {
          setRoomsError(t("admin:manualBooking.errors.noRoomsForDates"));
        }
      } catch (err) {
        setRoomsError((err as Error).message);
        setAvailableRooms([]);
      } finally {
        setLoadingRooms(false);
      }
    };

    loadAvailableRooms();
  }, [selectedOption, authFetch, t]);

  const togglePet = (petId: string) => {
    setForm((prev) => {
      const exists = prev.petIds.includes(petId);
      return {
        ...prev,
        petIds: exists ? prev.petIds.filter((id) => id !== petId) : [...prev.petIds, petId],
      };
    });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.checkInDate || !form.checkOutDate) {
      setError(t("admin:manualBooking.errors.selectDates"));
      return;
    }

    if (!form.clientId) {
      setError(t("admin:manualBooking.errors.selectClient"));
      return;
    }

    if (form.petIds.length === 0) {
      setError(t("admin:manualBooking.errors.selectPets"));
      return;
    }

    if (!selectedOption) {
      setError(t("admin:manualBooking.errors.selectOption"));
      return;
    }

    const isComposite = selectedOption.segments.length > 1;

    // For simple bookings, room selection is optional (admin can assign later)
    // For composite bookings, room selection is not applicable

    try {
      setIsSubmitting(true);

      const payload: ManualBookingPayload = isComposite
        ? {
            clientId: form.clientId,
            petIds: form.petIds,
            segments: selectedOption.segments.map((seg) => ({
              roomTypeId: seg.roomTypeId,
              checkInDate: seg.checkInDate,
              checkOutDate: seg.checkOutDate,
            })),
            specialRequests: form.specialRequests.trim() || undefined,
          }
        : {
            clientId: form.clientId,
            roomTypeId: selectedOption.segments[0].roomTypeId,
            assignedRoomId: form.roomId || undefined,
            checkInDate: selectedOption.segments[0].checkInDate,
            checkOutDate: selectedOption.segments[0].checkOutDate,
            petIds: form.petIds,
            specialRequests: form.specialRequests.trim() || undefined,
          };

      await onCreate(payload);
      setSuccess(t("admin:manualBooking.success"));

      // Reset form
      setForm({
        clientId: "",
        checkInDate: "",
        checkOutDate: "",
        petIds: [],
        specialRequests: "",
        roomId: "",
      });
      setClientSearchQuery("");
      setAvailableRooms([]);
      setBookingOptions(null);
      setSelectedOption(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Determine current step
  const currentStep =
    !form.checkInDate || !form.checkOutDate
      ? 1
      : !form.clientId
        ? 2
        : form.petIds.length === 0
          ? 3
          : !selectedOption
            ? 4
            : selectedOption.segments.length === 1 && !form.roomId
              ? 5
              : 6;

  const steps = [
    { num: 1, label: t("admin:manualBooking.steps.dates") },
    { num: 2, label: t("admin:manualBooking.steps.client") },
    { num: 3, label: t("admin:manualBooking.steps.pets") },
    { num: 4, label: t("admin:manualBooking.steps.option") },
    { num: 5, label: t("admin:manualBooking.steps.room") },
    { num: 6, label: t("admin:manualBooking.steps.done") },
  ];

  return (
    <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/30 p-6 sm:p-8 shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          {t("admin:manualBooking.title")}
        </h2>
        <p className="mt-2 text-sm text-slate-600">{t("admin:manualBooking.subtitle")}</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8 flex items-center justify-between overflow-x-auto pb-2">
        {steps.map((step, idx) => (
          <div key={step.num} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition-all ${
                  currentStep >= step.num
                    ? "bg-gradient-to-br from-indigo-500 to-purple-500 text-white shadow-md"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {step.num}
              </div>
              <span
                className={`mt-1 text-xs font-medium ${currentStep >= step.num ? "text-indigo-600" : "text-slate-400"}`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`mx-2 h-1 w-8 sm:w-12 rounded transition-all ${
                  currentStep > step.num
                    ? "bg-gradient-to-r from-indigo-500 to-purple-500"
                    : "bg-slate-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Date Selection */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-600">
              1
            </span>
            {t("admin:manualBooking.selectDates")}
          </h3>
          <div className="mt-4">
            <DateRangeCalendar
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              checkInDate={form.checkInDate}
              checkOutDate={form.checkOutDate}
              busyDates={new Set()}
              minDate={new Date()}
              blockBusyDates={false}
              onChange={({ checkInDate, checkOutDate }) => {
                setForm((prev) => ({ ...prev, checkInDate, checkOutDate }));
              }}
              onInvalidRange={(message) => {
                if (message) setError(message);
                else setError(null);
              }}
            />
            {form.checkInDate && form.checkOutDate && (
              <div className="mt-3 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 p-3">
                <p className="text-sm font-semibold text-emerald-900">
                  {t("admin:manualBooking.selectedPeriod")}{" "}
                  {new Date(form.checkInDate).toLocaleDateString("ru-RU")} —{" "}
                  {new Date(form.checkOutDate).toLocaleDateString("ru-RU")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Client Selection */}
        {form.checkInDate && form.checkOutDate && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-600">
                2
              </span>
              {t("admin:manualBooking.selectClient")}
            </h3>

            {/* Search input */}
            <div className="mt-4">
              <div className="relative">
                <input
                  type="text"
                  value={clientSearchQuery}
                  onChange={(e) => setClientSearchQuery(e.target.value)}
                  placeholder={t("admin:manualBooking.searchPlaceholder")}
                  className="w-full rounded-xl border-2 border-slate-200 px-4 py-3 pl-11 text-base text-slate-900 transition focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                />
                <svg
                  className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400"
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
              </div>
            </div>

            {/* Client cards */}
            <div className="mt-4 max-h-[400px] overflow-y-auto space-y-2">
              {filteredClients.length === 0 ? (
                <p className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-8 text-center text-sm text-slate-600">
                  {clientSearchQuery
                    ? t("admin:manualBooking.noClientsFound")
                    : t("admin:manualBooking.noClientsAvailable")}
                </p>
              ) : (
                filteredClients.map((client) => {
                  const matchedPets = clientSearchQuery.trim()
                    ? client.pets.filter((pet) =>
                        pet.name.toLowerCase().includes(clientSearchQuery.toLowerCase())
                      )
                    : [];

                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          clientId: client.id,
                          petIds: [],
                        }));
                        setClientSearchQuery("");
                      }}
                      className={`w-full text-left rounded-xl border-2 p-4 transition-all ${
                        form.clientId === client.id
                          ? "border-purple-500 bg-gradient-to-br from-purple-50 to-pink-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-purple-300 hover:shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-base font-bold text-slate-900">
                            {client.lastName} {client.firstName}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">{client.email}</p>
                          <p className="text-xs text-slate-500">{client.phone}</p>
                          {matchedPets.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {matchedPets.map((pet) => (
                                <span
                                  key={pet.id}
                                  className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700"
                                >
                                  {pet.name}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-slate-400">
                              {t("admin:manualBooking.petsCount")} {client.pets.length}
                            </p>
                          )}
                        </div>
                        {form.clientId === client.id && (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500 text-white">
                            <svg
                              className="h-5 w-5"
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
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {selectedClient && (
              <div className="mt-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-300 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <svg
                    className="h-5 w-5 text-purple-600"
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
                  <p className="text-sm font-bold text-purple-900">
                    {t("admin:manualBooking.selectedClient")}
                  </p>
                </div>
                <p className="text-base font-semibold text-purple-900">
                  {selectedClient.lastName} {selectedClient.firstName}
                </p>
                <p className="text-sm text-purple-700">
                  {selectedClient.email} • {selectedClient.phone}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Pet Selection */}
        {form.clientId && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
                3
              </span>
              {t("admin:manualBooking.selectPets")}
            </h3>
            {availablePets.length === 0 ? (
              <p className="mt-3 rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
                {t("admin:manualBooking.noPetsMessage")}
              </p>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {availablePets.map((pet) => {
                  const checked = form.petIds.includes(pet.id);
                  return (
                    <label
                      key={pet.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-all ${
                        checked
                          ? "border-blue-500 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-blue-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePet(pet.id)}
                        className="h-5 w-5 rounded border-slate-300 text-blue-500 focus:ring-blue-400"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">{pet.name}</p>
                        <p className="text-xs text-slate-500">{getSpeciesLabel(pet.species)}</p>
                      </div>
                      {checked && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-white">
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
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Booking Option Selection */}
        {form.petIds.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-600">
                4
              </span>
              {t("admin:manualBooking.selectOption")}
            </h3>
            {checkingAvailability ? (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-6">
                <svg
                  className="h-6 w-6 animate-spin text-amber-600"
                  fill="none"
                  viewBox="0 0 24 24"
                >
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
                <span className="text-sm text-slate-600">
                  {t("admin:manualBooking.searchingOptions")}
                </span>
              </div>
            ) : !bookingOptions || allOptions.length === 0 ? (
              <div className="mt-4 rounded-2xl bg-rose-50 px-4 py-4 text-sm text-rose-600">
                {t("admin:manualBooking.noOptionsAvailable")}
              </div>
            ) : (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-slate-500">
                      {t("admin:manualBooking.optionsFound")} {allOptions.length}
                      {bookingOptions.hasPerfectOptions && (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {t("admin:manualBooking.perfectOptions")}
                        </span>
                      )}
                    </p>
                    {bookingOptions.singleRoomOptions.length > 0 ? (
                      <p className="text-xs flex items-center gap-1 text-emerald-700">
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {t("admin:manualBooking.directBookingsOnly")}
                      </p>
                    ) : (
                      <p className="text-xs flex items-center gap-1 text-amber-700">
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {t("admin:manualBooking.noDirectOptions")}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (!sliderRef.current) return;
                        sliderRef.current.scrollBy({ left: -300, behavior: "smooth" });
                      }}
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-amber-500 hover:text-amber-600"
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
                          d="M15 19l-7-7 7-7"
                        />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!sliderRef.current) return;
                        sliderRef.current.scrollBy({ left: 300, behavior: "smooth" });
                      }}
                      className="rounded-lg border border-slate-200 p-2 text-slate-600 transition hover:border-amber-500 hover:text-amber-600"
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
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <div
                  ref={sliderRef}
                  className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pt-1 [scrollbar-width:none] [-ms-overflow-style:none]"
                  style={{ scrollBehavior: "smooth" }}
                >
                  <style>{`.no-scrollbar::-webkit-scrollbar{display:none;}`}</style>
                  {allOptions.map((option, optionIndex) => {
                    const firstSegment = option.segments[0];
                    const isComposite = option.segments.length > 1;
                    const selected = selectedOption === option;

                    // Priority badges
                    const priorityBadge =
                      option.optionType === "Single"
                        ? {
                            label: t("admin:manualBooking.perfectOption"),
                            color: "bg-emerald-100 text-emerald-700",
                          }
                        : option.optionType === "SameType"
                          ? {
                              label: t("admin:manualBooking.withTransfer"),
                              color: "bg-amber-100 text-amber-700",
                            }
                          : {
                              label: t("admin:manualBooking.differentTypes"),
                              color: "bg-blue-100 text-blue-700",
                            };

                    return (
                      <div
                        key={`option-${optionIndex}`}
                        className={`${selected ? "snap-center" : "snap-start"} w-80 flex-shrink-0 rounded-xl border text-left shadow-md transition hover:shadow-xl focus:outline-none ${
                          selected ? "border-amber-500 ring-2 ring-amber-500" : "border-slate-200"
                        }`}
                      >
                        <div className="relative h-48 w-full overflow-hidden rounded-t-xl bg-slate-50">
                          <div className="flex h-full w-full items-center justify-center text-6xl">
                            🏨
                          </div>
                          {selected && (
                            <span className="absolute right-3 top-3 rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                              {t("admin:manualBooking.selected")}
                            </span>
                          )}
                          {/* Priority badge */}
                          <span
                            className={`absolute left-3 top-3 rounded-lg px-2 py-1 text-xs font-semibold ${priorityBadge.color}`}
                          >
                            {priorityBadge.label}
                          </span>
                          {/* Price badge */}
                          <div className="absolute bottom-3 left-3 rounded-lg bg-white/95 backdrop-blur-sm px-3 py-2 shadow-lg">
                            <div className="text-xl font-bold text-slate-900">
                              {formatCurrency(option.totalPrice)}
                              <span className="text-xs font-normal text-slate-500">
                                {" "}
                                / {option.totalNights}{" "}
                                {getBookingUnitName(calculationMode, option.totalNights)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="text-lg font-bold text-slate-900">
                            {isComposite
                              ? `${option.segments.length} ${t("admin:manualBooking.rooms")}`
                              : firstSegment.roomTypeName}
                          </h3>

                          {/* Segments timeline for composite bookings */}
                          {isComposite && (
                            <div className="mt-3 space-y-2">
                              {option.segments.map((segment, segIdx) => {
                                const checkIn = new Date(segment.checkInDate);
                                const checkOut = new Date(segment.checkOutDate);
                                const days = segment.nights;
                                const formatDate = (date: Date) =>
                                  date.toLocaleDateString(locale, {
                                    day: "2-digit",
                                    month: "2-digit",
                                  });

                                return (
                                  <div
                                    key={segIdx}
                                    className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-900">
                                          {segment.roomTypeName}
                                        </p>
                                        <p className="text-xs text-slate-600">
                                          {formatDate(checkIn)} — {formatDate(checkOut)}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {days} {getBookingUnitName(calculationMode, days)}
                                        </p>
                                      </div>
                                      <p className="whitespace-nowrap text-sm font-semibold text-slate-900">
                                        {formatCurrency(segment.price)}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {!isComposite && (
                            <div className="mt-3 flex items-center gap-3 text-xs text-slate-600">
                              <span className="flex items-center gap-1">
                                <svg
                                  className="w-4 h-4 text-amber-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                  />
                                </svg>
                                {t("admin:manualBooking.upTo")} {firstSegment.maxCapacity}{" "}
                                {t("admin:manualBooking.pets")}
                                {firstSegment.maxCapacity === 1
                                  ? t("admin:manualBooking.pet_one")
                                  : t("admin:manualBooking.pet_many")}
                              </span>
                              <span>•</span>
                              <span>
                                {firstSegment.squareMeters} {t("admin:manualBooking.sqm")}
                              </span>
                            </div>
                          )}

                          {isComposite && option.transferCount > 0 && (
                            <div className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-700">
                              <p>
                                {t("admin:manualBooking.transferNotice", {
                                  count: option.transferCount,
                                })}
                              </p>
                              {option.optionType === "Mixed" && (
                                <p className="mt-1">
                                  {t("admin:manualBooking.transferNoticeMixedTypes")}
                                </p>
                              )}
                            </div>
                          )}

                          <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2">
                            <div className="flex items-baseline justify-between">
                              <span className="text-xs text-slate-600">
                                {t("admin:manualBooking.totalLabel")}
                              </span>
                              <span className="text-lg font-bold text-amber-900">
                                {formatCurrency(option.totalPrice)}
                              </span>
                            </div>
                            {option.priceBreakdown && option.priceBreakdown.discountAmount > 0 && (
                              <div className="mt-1 text-xs text-emerald-700">
                                {t("admin:manualBooking.discountApplied", {
                                  percent: option.priceBreakdown.loyaltyDiscountPercent,
                                })}{" "}
                                <span className="font-semibold">
                                  -
                                  {formatCurrency(Math.round(option.priceBreakdown.discountAmount))}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="mt-4">
                            <button
                              type="button"
                              onClick={() => setSelectedOption(option)}
                              className={`w-full rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                selected
                                  ? "bg-amber-500 text-white"
                                  : "bg-amber-100 text-amber-700 hover:bg-amber-500 hover:text-white"
                              }`}
                            >
                              {selected
                                ? t("admin:manualBooking.selectedLabel")
                                : t("admin:manualBooking.selectLabel")}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 5: Room Selection (only for simple bookings) */}
        {selectedOption && selectedOption.segments.length === 1 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-600">
                5
              </span>
              {t("admin:manualBooking.selectRoom")}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{t("admin:manualBooking.selectRoomHint")}</p>

            <div className="mt-4">
              {loadingRooms ? (
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
                  <p className="mt-2 text-sm text-slate-600">
                    {t("admin:manualBooking.loadingRooms")}
                  </p>
                </div>
              ) : roomsError ? (
                <div className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-4 text-sm text-rose-600">
                  {roomsError}
                </div>
              ) : availableRooms.length === 0 ? (
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-4 text-sm text-slate-600">
                  {t("admin:manualBooking.noRoomsAvailable")}
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, roomId: "" }))}
                    className={`w-full text-left rounded-xl border-2 p-3 transition-all ${
                      !form.roomId
                        ? "border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-emerald-300"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-700">
                        {t("admin:manualBooking.assignLater")}
                      </span>
                      {!form.roomId && (
                        <svg
                          className="h-5 w-5 text-emerald-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                  {availableRooms.map((room) => (
                    <button
                      key={room.id}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, roomId: room.id }))}
                      className={`w-full text-left rounded-xl border-2 p-3 transition-all ${
                        form.roomId === room.id
                          ? "border-emerald-500 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-sm"
                          : "border-slate-200 bg-white hover:border-emerald-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-base font-bold text-slate-900">№ {room.roomNumber}</p>
                          {room.floor != null && (
                            <p className="mt-1 text-xs text-slate-500">
                              {t("admin:manualBooking.floor")} {room.floor}
                            </p>
                          )}
                          {room.specialNotes && (
                            <p className="mt-1 text-xs text-slate-600">{room.specialNotes}</p>
                          )}
                        </div>
                        {form.roomId === room.id && (
                          <svg
                            className="h-6 w-6 text-emerald-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 6: Special Requests & Submit */}
        {selectedOption && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-600">
                6
              </span>
              {t("admin:manualBooking.specialRequests")}
            </h3>
            <div className="mt-4">
              <label className="block text-sm font-semibold text-slate-700">
                {t("admin:manualBooking.specialRequestsLabel")}
              </label>
              <textarea
                value={form.specialRequests}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, specialRequests: event.target.value }))
                }
                rows={3}
                className="mt-2 w-full rounded-xl border-2 border-slate-200 px-4 py-3 text-sm text-slate-900 transition focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-200"
                placeholder={t("admin:manualBooking.specialRequestsPlaceholder")}
              />
            </div>

            {/* Summary */}
            <div className="mt-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 p-4">
              <h4 className="text-sm font-bold text-slate-900">
                {t("admin:manualBooking.summary")}
              </h4>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="text-slate-400">•</span>
                  <span>
                    <strong>{t("admin:manualBooking.period")}</strong>{" "}
                    {new Date(form.checkInDate).toLocaleDateString(
                      i18n.language === "ru" ? "ru-RU" : "en-US"
                    )}{" "}
                    —{" "}
                    {new Date(form.checkOutDate).toLocaleDateString(
                      i18n.language === "ru" ? "ru-RU" : "en-US"
                    )}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400">•</span>
                  <span>
                    <strong>{t("admin:manualBooking.clientLabel")}</strong>{" "}
                    {selectedClient?.lastName} {selectedClient?.firstName}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400">•</span>
                  <span>
                    <strong>{t("admin:manualBooking.petsLabel")}</strong> {form.petIds.length}
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-slate-400">•</span>
                  <span>
                    <strong>{t("admin:manualBooking.bookingType")}</strong>{" "}
                    {selectedOption.segments.length === 1
                      ? t("admin:manualBooking.simple")
                      : `${t("admin:manualBooking.composite")} (${selectedOption.segments.length} ${t("admin:manualBooking.segmentsCount")})`}
                  </span>
                </li>
                {selectedOption.segments.length === 1 && form.roomId && (
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400">•</span>
                    <span>
                      <strong>{t("admin:manualBooking.roomLabel")}</strong> №
                      {availableRooms.find((r) => r.id === form.roomId)?.roomNumber}
                    </span>
                  </li>
                )}
                <li className="flex items-start gap-2">
                  <span className="text-slate-400">•</span>
                  <span>
                    <strong>{t("admin:manualBooking.costLabel")}</strong>{" "}
                    {selectedOption.totalPrice.toLocaleString(
                      i18n.language === "ru" ? "ru-RU" : "en-US"
                    )}{" "}
                    ₽
                  </span>
                </li>
                {(selectedOption.priceBreakdown?.discountAmount ?? 0) > 0 && (
                  <li className="flex items-start gap-2">
                    <span className="text-slate-400">•</span>
                    <span>
                      <strong>
                        {t("admin:manualBooking.discountApplied", {
                          percent:
                            selectedOption.priceBreakdown?.loyaltyDiscountPercent ??
                            selectedClientDiscount,
                        })}
                      </strong>{" "}
                      -
                      {formatCurrency(
                        Math.round(selectedOption.priceBreakdown?.discountAmount ?? 0)
                      )}
                    </span>
                  </li>
                )}
              </ul>
              {selectedOption.segments.length > 1 && (
                <div className="mt-3 rounded-lg bg-blue-50 border border-blue-200 p-3">
                  <p className="text-xs text-blue-700">
                    ℹ️{" "}
                    {t("admin:manualBooking.compositeNote", {
                      count: selectedOption.segments.length,
                    })}
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 px-6 py-4 text-base font-bold text-white shadow-lg transition hover:shadow-xl hover:from-indigo-600 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? t("admin:manualBooking.creating")
                : t("admin:manualBooking.createBooking")}
            </button>
          </div>
        )}

        {/* Error & Success Messages */}
        {error && (
          <div className="rounded-xl bg-gradient-to-br from-rose-50 to-red-50 border-2 border-rose-300 px-5 py-4 shadow-sm">
            <p className="text-sm font-semibold text-rose-700">{error}</p>
          </div>
        )}

        {success && (
          <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 px-5 py-4 shadow-sm">
            <p className="text-sm font-semibold text-emerald-700">{success}</p>
          </div>
        )}
      </form>
    </section>
  );
};

export default AdminManualBookingForm;
