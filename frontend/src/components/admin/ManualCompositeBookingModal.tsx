import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { type BookingSettings, BookingCalculationMode, getUnitName } from "../../types/booking";

type SegmentPrice = {
  basePrice: number;
  additionalPetsPrice: number;
  discountAmount: number;
  loyaltyDiscountPercent: number;
  numberOfUnits: number;
  totalPrice: number;
  pricePerUnit: number;
  pricePerAdditionalPet: number;
};

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  pets: Array<{
    id: string;
    name: string;
    species: number;
    gender: number;
  }>;
}

interface ManualCompositeBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  segments: Array<{
    roomId: string;
    roomNumber: string;
    roomTypeId: string;
    roomTypeName: string;
    from: Date;
    to: Date;
    price: number;
  }>;
  onSuccess: () => void;
  /** Calculation mode: by days or nights (for segment duration display) */
  bookingSettings?: BookingSettings | null;
}

const ManualCompositeBookingModal: React.FC<ManualCompositeBookingModalProps> = ({
  isOpen,
  onClose,
  segments,
  onSuccess,
  bookingSettings,
}) => {
  const { authFetch, user } = useAuth();
  const { t, i18n } = useTranslation();

  // Helper function to format currency
  const formatCurrency = (amount: number): string => {
    const currencySymbol = i18n.language.startsWith("en") ? "$" : "₽";
    return `${amount.toLocaleString(i18n.language === "en" ? "en-US" : "ru-RU")} ${currencySymbol}`;
  };

  const [clients, setClients] = useState<Client[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedPetIds, setSelectedPetIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const [segmentPrices, setSegmentPrices] = useState<(SegmentPrice | null)[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);

  const loadClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const res = await authFetch("/api/admin/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (err) {
      console.error("Failed to load clients", err);
    } finally {
      setLoadingClients(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (isOpen) {
      loadClients();
      setSelectedClientId("");
      setSelectedPetIds([]);
      setError(null);
      setClientSearch("");
      setSegmentPrices([]);
    }
  }, [isOpen, loadClients]);

  const numberOfPets = selectedPetIds.length;
  const fetchPrices = useCallback(async () => {
    if (!isOpen || segments.length === 0 || numberOfPets === 0) {
      setSegmentPrices(segments.map(() => null));
      return;
    }
    setLoadingPrices(true);
    try {
      const results: (SegmentPrice | null)[] = [];
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const checkIn = seg.from.toISOString().split("T")[0];
        const checkOut = seg.to.toISOString().split("T")[0];
        const res = await authFetch("/api/bookings/options", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            checkInDate: checkIn,
            checkOutDate: checkOut,
            numberOfPets,
            clientId: selectedClientId || undefined,
          }),
        });
        if (!res.ok) {
          results.push(null);
          continue;
        }
        const data = (await res.json()) as {
          singleRoomOptions?: Array<{
            totalPrice: number;
            segments: Array<{ roomTypeId: string }>;
            priceBreakdown?: {
              basePrice: number;
              additionalPetsPrice: number;
              discountAmount: number;
              loyaltyDiscountPercent: number;
              numberOfNights?: number;
              numberOfUnits?: number;
            };
          }>;
        };
        const match = (data.singleRoomOptions ?? []).find((option) =>
          option.segments?.some((segment) => segment.roomTypeId === seg.roomTypeId)
        );
        if (match?.priceBreakdown) {
          const pb = match.priceBreakdown;
          const units = pb.numberOfNights ?? pb.numberOfUnits ?? 0;
          const pricePerUnit = units > 0 ? pb.basePrice / units : 0;
          const additionalPetsCount = Math.max(0, numberOfPets - 1);
          const pricePerAdditionalPet =
            units > 0 && additionalPetsCount > 0
              ? pb.additionalPetsPrice / (units * additionalPetsCount)
              : 0;
          results.push({
            basePrice: pb.basePrice,
            additionalPetsPrice: pb.additionalPetsPrice,
            discountAmount: pb.discountAmount ?? 0,
            loyaltyDiscountPercent: pb.loyaltyDiscountPercent ?? 0,
            numberOfUnits: units,
            totalPrice: match.totalPrice,
            pricePerUnit,
            pricePerAdditionalPet,
          });
        } else {
          results.push(null);
        }
      }
      setSegmentPrices(results);
    } catch (err) {
      console.error("Failed to fetch prices", err);
      setSegmentPrices(segments.map(() => null));
    } finally {
      setLoadingPrices(false);
    }
  }, [isOpen, segments, numberOfPets, authFetch, selectedClientId]);

  useEffect(() => {
    if (!isOpen) return;
    if (numberOfPets === 0) {
      setSegmentPrices(segments.length > 0 ? segments.map(() => null) : []);
      return;
    }
    fetchPrices();
  }, [isOpen, segments, numberOfPets, fetchPrices]);

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  const filteredClients = clients.filter((c) => {
    if (user?.email && c.email?.toLowerCase() === user.email.toLowerCase()) return false;
    const search = clientSearch.toLowerCase();
    return (
      c.firstName.toLowerCase().includes(search) ||
      c.lastName.toLowerCase().includes(search) ||
      c.email?.toLowerCase().includes(search) ||
      c.phone?.includes(search)
    );
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId || selectedPetIds.length === 0) {
      setError(t("admin:compositeBooking.selectClientAndPet"));
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Sort segments by date
      const sortedSegments = [...segments].sort((a, b) => a.from.getTime() - b.from.getTime());

      const payload = {
        clientId: selectedClientId,
        petIds: selectedPetIds,
        segments: sortedSegments.map((s) => {
          // Dates from Gantt are already UTC midnight, just extract YYYY-MM-DD
          const checkIn = s.from.toISOString().split("T")[0];
          const checkOut = s.to.toISOString().split("T")[0];

          return {
            roomTypeId: s.roomTypeId,
            assignedRoomId: s.roomId,
            checkInDate: checkIn,
            checkOutDate: checkOut,
          };
        }),
      };

      const res = await authFetch("/api/admin/bookings/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || t("admin:compositeBooking.createError"));
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-bold text-slate-900">{t("admin:compositeBooking.title")}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
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
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <form id="manual-booking-form" onSubmit={handleSubmit} className="space-y-6">
            {/* Segments Summary */}
            <div>
              <h4 className="mb-2 text-sm font-bold text-slate-900">
                {t("admin:compositeBooking.selectedSegments", { count: segments.length })}
              </h4>
              <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                {segments
                  .sort((a, b) => a.from.getTime() - b.from.getTime())
                  .map((segment, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-lg bg-white p-2 shadow-sm border border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {segment.roomTypeName}{" "}
                            <span className="text-slate-500">№{segment.roomNumber}</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            {segment.from.toLocaleDateString(
                              i18n.language === "en" ? "en-US" : "ru-RU"
                            )}{" "}
                            —{" "}
                            {segment.to.toLocaleDateString(
                              i18n.language === "en" ? "en-US" : "ru-RU"
                            )}
                            <span className="mx-1">•</span>
                            {(() => {
                              const diffMs = segment.to.getTime() - segment.from.getTime();
                              const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                              const isNights =
                                bookingSettings?.calculationMode === BookingCalculationMode.Nights;
                              const count = isNights ? diffDays : diffDays + 1;
                              const mode =
                                bookingSettings?.calculationMode ?? BookingCalculationMode.Days;
                              return `${count} ${getUnitName(mode, count)}`;
                            })()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Client Selection */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                {t("admin:compositeBooking.client")}
              </label>
              {loadingClients ? (
                <div className="text-sm text-slate-500">
                  {t("admin:compositeBooking.loadingClients")}
                </div>
              ) : (
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder={t("admin:compositeBooking.searchClient")}
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full rounded-lg border-slate-200 text-sm focus:border-brand focus:ring-brand"
                  />
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white">
                    {filteredClients.map((client) => (
                      <div
                        key={client.id}
                        onClick={() => {
                          setSelectedClientId(client.id);
                          setSelectedPetIds([]);
                        }}
                        className={`cursor-pointer px-3 py-2 text-sm hover:bg-slate-50 ${
                          selectedClientId === client.id
                            ? "bg-brand/5 font-medium text-brand"
                            : "text-slate-700"
                        }`}
                      >
                        {client.lastName} {client.firstName} ({client.email || client.phone})
                      </div>
                    ))}
                    {filteredClients.length === 0 && (
                      <div className="px-3 py-2 text-sm text-slate-400">
                        {t("admin:compositeBooking.nothingFound")}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Pet Selection */}
            {selectedClient && (
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {t("admin:compositeBooking.pets")}
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {selectedClient.pets.map((pet) => (
                    <label
                      key={pet.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                        selectedPetIds.includes(pet.id)
                          ? "border-brand bg-brand/5 ring-1 ring-brand"
                          : "border-slate-200 hover:border-brand/50 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                        checked={selectedPetIds.includes(pet.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPetIds([...selectedPetIds, pet.id]);
                          } else {
                            setSelectedPetIds(selectedPetIds.filter((id) => id !== pet.id));
                          }
                        }}
                      />
                      <span className="text-sm font-medium text-slate-900">{pet.name}</span>
                    </label>
                  ))}
                </div>
                {selectedClient.pets.length === 0 && (
                  <p className="text-sm text-slate-500">{t("admin:compositeBooking.noPets")}</p>
                )}
              </div>
            )}

            {/* Accommodation cost */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <h4 className="mb-2 text-sm font-bold text-slate-900">
                {t("admin:compositeBooking.accommodationCost")}
              </h4>
              {numberOfPets === 0 ? (
                <p className="text-sm text-slate-500">
                  {t("admin:compositeBooking.selectClientAndPetsForCost")}
                </p>
              ) : loadingPrices ? (
                <p className="text-sm text-slate-500">
                  {t("admin:compositeBooking.calculatingCost")}
                </p>
              ) : (
                <div className="space-y-3">
                  {[...segments]
                    .sort((a, b) => a.from.getTime() - b.from.getTime())
                    .map((segment) => {
                      const idx = segments.indexOf(segment);
                      const price = segmentPrices[idx] ?? null;
                      const unitLabel = getUnitName(
                        bookingSettings?.calculationMode ?? BookingCalculationMode.Days,
                        1
                      );
                      const unitLabelPlural = getUnitName(
                        bookingSettings?.calculationMode ?? BookingCalculationMode.Days,
                        price?.numberOfUnits ?? 2
                      );
                      return (
                        <div
                          key={`${segment.roomId}-${segment.from.getTime()}-${segment.to.getTime()}`}
                          className="rounded-lg border border-slate-100 bg-white p-3 text-sm"
                        >
                          <div className="font-medium text-slate-900">
                            {segment.roomTypeName} №{segment.roomNumber}
                          </div>
                          <div className="mt-1 text-xs text-slate-500">
                            {segment.from.toLocaleDateString(
                              i18n.language === "en" ? "en-US" : "ru-RU"
                            )}{" "}
                            —{" "}
                            {segment.to.toLocaleDateString(
                              i18n.language === "en" ? "en-US" : "ru-RU"
                            )}
                          </div>
                          {price ? (
                            <div className="mt-2 space-y-1 text-slate-700">
                              <div>
                                {t("admin:compositeBooking.pricePerUnit", { unit: unitLabel })}{" "}
                                <span className="font-medium">
                                  {formatCurrency(Math.round(price.pricePerUnit))}
                                </span>
                                {" / "}
                                {unitLabelPlural}
                              </div>
                              {price.additionalPetsPrice > 0 && (
                                <div>
                                  {t("admin:compositeBooking.petsCost")}{" "}
                                  <span className="font-medium">
                                    {formatCurrency(Math.round(price.additionalPetsPrice))}
                                  </span>
                                  {price.pricePerAdditionalPet > 0 && (
                                    <span className="text-slate-500">
                                      {" "}
                                      ({t("admin:compositeBooking.firstIncluded")}{" "}
                                      {formatCurrency(Math.round(price.pricePerAdditionalPet))}{" "}
                                      {t("admin:compositeBooking.perEachAdditional")}{" "}
                                      {price.numberOfUnits} {unitLabelPlural} × {numberOfPets - 1}{" "}
                                      {t("admin:compositeBooking.pets_many", {
                                        count: numberOfPets - 1,
                                      })}
                                      )
                                    </span>
                                  )}
                                </div>
                              )}
                              {price.discountAmount > 0 && (
                                <>
                                  <div>
                                    {t("admin:compositeBooking.totalBeforeDiscount")}{" "}
                                    <span className="font-medium">
                                      {formatCurrency(
                                        Math.round(
                                          price.basePrice +
                                            price.additionalPetsPrice +
                                            price.discountAmount
                                        )
                                      )}
                                    </span>
                                  </div>
                                  <div className="text-emerald-700">
                                    {t("admin:compositeBooking.discountApplied", {
                                      percent: price.loyaltyDiscountPercent,
                                    })}{" "}
                                    <span className="font-medium">
                                      -{formatCurrency(Math.round(price.discountAmount))}
                                    </span>
                                  </div>
                                </>
                              )}
                              <div className="border-t border-slate-100 pt-2 font-medium text-slate-900">
                                {t("admin:compositeBooking.segmentTotal")}{" "}
                                {formatCurrency(Math.round(price.totalPrice))}
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1 text-slate-500">
                              {t("admin:compositeBooking.noPriceData")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  {segmentPrices.some((p) => p !== null) && (
                    <div className="border-t border-slate-200 pt-2 space-y-1">
                      <div className="text-base font-bold text-slate-900">
                        {t("admin:compositeBooking.totalAccommodation")}{" "}
                        {formatCurrency(
                          Math.round(
                            segmentPrices.reduce((sum, p) => sum + (p?.totalPrice ?? 0), 0)
                          )
                        )}
                      </div>
                      {segmentPrices.some((p) => (p?.discountAmount ?? 0) > 0) && (
                        <div className="text-sm text-emerald-700">
                          {t("admin:compositeBooking.totalDiscount")}{" "}
                          <span className="font-semibold">
                            -
                            {formatCurrency(
                              Math.round(
                                segmentPrices.reduce((sum, p) => sum + (p?.discountAmount ?? 0), 0)
                              )
                            )}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4 bg-slate-50 rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
          >
            {t("admin:compositeBooking.cancel")}
          </button>
          <button
            type="submit"
            form="manual-booking-form"
            disabled={submitting || !selectedClientId || selectedPetIds.length === 0}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? t("admin:compositeBooking.creating")
              : t("admin:compositeBooking.createBooking")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualCompositeBookingModal;
