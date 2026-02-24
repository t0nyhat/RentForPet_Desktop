import { FormEvent, KeyboardEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AlertModal from "../AlertModal";
import ConfirmModal from "../ConfirmModal";

export type AdminRoomType = {
  id: string;
  name: string;
  description: string;
  maxCapacity: number;
  pricePerNight: number;
  pricePerAdditionalPet: number;
  squareMeters: number;
  features: string[];
  isActive: boolean;
};

type CreateOrUpdateRoomTypePayload = {
  name: string;
  description: string;
  maxCapacity: number;
  pricePerNight: number;
  pricePerAdditionalPet: number;
  squareMeters: number;
  features: string[];
  isActive: boolean;
};

type AdminRoomTypesManagerProps = {
  roomTypes: AdminRoomType[];
  loading: boolean;
  error?: string | null;
  refreshKey?: number;
  onCreate: (payload: CreateOrUpdateRoomTypePayload) => Promise<string>;
  onUpdate: (roomTypeId: string, payload: CreateOrUpdateRoomTypePayload) => Promise<void>;
  onDelete: (roomTypeId: string) => Promise<void>;
};

type RoomTypeFormState = {
  name: string;
  description: string;
  maxCapacity: string;
  pricePerNight: string;
  pricePerAdditionalPet: string;
  squareMeters: string;
  features: string[];
  featureInput: string;
  isActive: boolean;
};

const initialFormState: RoomTypeFormState = {
  name: "",
  description: "",
  maxCapacity: "1",
  pricePerNight: "0",
  pricePerAdditionalPet: "0",
  squareMeters: "0",
  features: [],
  featureInput: "",
  isActive: true,
};

const toFormState = (roomType: AdminRoomType): RoomTypeFormState => ({
  name: roomType.name ?? "",
  description: roomType.description ?? "",
  maxCapacity: String(roomType.maxCapacity ?? ""),
  pricePerNight: String(roomType.pricePerNight ?? ""),
  pricePerAdditionalPet: String(roomType.pricePerAdditionalPet ?? ""),
  squareMeters: String(roomType.squareMeters ?? ""),
  features: roomType.features ? [...roomType.features] : [],
  featureInput: "",
  isActive: roomType.isActive ?? true,
});

const AdminRoomTypesManager = ({
  roomTypes,
  loading,
  error,
  refreshKey,
  onCreate,
  onUpdate,
  onDelete,
}: AdminRoomTypesManagerProps) => {
  const { t, i18n } = useTranslation();

  const formatCurrency = (amount: number): string => {
    const currencySymbol = i18n.language.startsWith("en") ? "$" : "₽";
    return `${amount.toLocaleString(i18n.language === "en" ? "en-US" : "ru-RU")} ${currencySymbol}`;
  };

  const [formState, setFormState] = useState<RoomTypeFormState>(initialFormState);
  const [activeRoomTypeId, setActiveRoomTypeId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Alert modal
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    message: string;
    type?: "info" | "success" | "warning" | "error";
  }>({
    isOpen: false,
    message: "",
    type: "info",
  });
  const [formOpen, setFormOpen] = useState(false);

  const sortedRoomTypes = useMemo(() => {
    const active = roomTypes.filter((rt) => rt.isActive);
    const inactive = roomTypes.filter((rt) => !rt.isActive);
    active.sort((a, b) => a.name.localeCompare(b.name, "ru-RU"));
    inactive.sort((a, b) => a.name.localeCompare(b.name, "ru-RU"));
    return [...active, ...inactive];
  }, [roomTypes]);
  void refreshKey;

  const resetForm = () => {
    setActiveRoomTypeId(null);
    setFormState(initialFormState);
    setFormError(null);
  };

  const openCreateModal = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditModal = (roomType: AdminRoomType) => {
    setActiveRoomTypeId(roomType.id);
    setFormState(toFormState(roomType));
    setFormError(null);
    setFormOpen(true);
  };

  const updateField = <K extends keyof RoomTypeFormState>(key: K, value: RoomTypeFormState[K]) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const buildPayload = (): CreateOrUpdateRoomTypePayload | null => {
    const name = formState.name.trim();
    const description = formState.description.trim();
    const maxCapacity = Number(formState.maxCapacity);
    const pricePerNight = Number(formState.pricePerNight);
    const pricePerAdditionalPet = Number(formState.pricePerAdditionalPet);
    const squareMeters = Number(formState.squareMeters);
    const features = formState.features
      .map((feature) => feature.trim())
      .filter((feature) => feature.length > 0);

    if (!name) {
      setFormError(t("admin:roomTypes.nameRequired"));
      return null;
    }

    if (!description) {
      setFormError(t("admin:roomTypes.descriptionRequired"));
      return null;
    }

    if (isNaN(maxCapacity) || maxCapacity < 1) {
      setFormError(t("admin:roomTypes.capacityMinOne"));
      return null;
    }

    if (isNaN(pricePerNight) || pricePerNight < 0) {
      setFormError(t("admin:roomTypes.priceNonNegative"));
      return null;
    }

    if (isNaN(squareMeters) || squareMeters <= 0) {
      setFormError(t("admin:roomTypes.areaPositive"));
      return null;
    }

    return {
      name,
      description,
      maxCapacity,
      pricePerNight,
      pricePerAdditionalPet,
      squareMeters,
      features,
      isActive: formState.isActive,
    };
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const payload = buildPayload();
    if (!payload) return;

    setSubmitting(true);
    try {
      if (activeRoomTypeId) {
        await onUpdate(activeRoomTypeId, payload);
        setAlertModal({
          isOpen: true,
          message: t("admin:roomTypes.updateSuccess"),
          type: "success",
        });
      } else {
        await onCreate(payload);
        setAlertModal({
          isOpen: true,
          message: t("admin:roomTypes.createSuccess"),
          type: "success",
        });
      }
      setFormOpen(false);
      resetForm();
    } catch (err) {
      const errorMessage = (err as Error).message || t("admin:roomTypes.saveError");
      setAlertModal({
        isOpen: true,
        message: errorMessage,
        type: "error",
      });
      setFormError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirmed = async (roomTypeId: string) => {
    setDeletingId(roomTypeId);
    try {
      await onDelete(roomTypeId);
    } catch (err) {
      setAlertModal({
        isOpen: true,
        message: (err as Error).message,
        type: "error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const addFeature = () => {
    const feature = formState.featureInput.trim();
    if (!feature) return;
    if (formState.features.includes(feature)) {
      setFormError(t("admin:roomTypes.amenityDuplicate"));
      return;
    }
    updateField("features", [...formState.features, feature]);
    updateField("featureInput", "");
    setFormError(null);
  };

  const removeFeature = (feature: string) => {
    updateField(
      "features",
      formState.features.filter((f) => f !== feature)
    );
  };

  const handleFeatureKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addFeature();
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {t("admin:roomTypes.title")}
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-600">{t("admin:roomTypes.subtitle")}</p>
        </div>
        <button
          onClick={openCreateModal}
          className="w-full sm:w-auto rounded-xl bg-brand px-4 sm:px-6 py-2 sm:py-3 text-sm sm:text-base font-semibold text-white shadow-lg transition hover:bg-brand-dark whitespace-nowrap"
        >
          {t("admin:roomTypes.createButton")}
        </button>
      </div>

      {error && (
        <div className="rounded-xl sm:rounded-2xl bg-rose-50 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-rose-600">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-brand"></div>
        </div>
      ) : sortedRoomTypes.length === 0 ? (
        <div className="rounded-xl sm:rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 sm:p-12 text-center">
          <span className="text-3xl sm:text-4xl">🏨</span>
          <h3 className="mt-3 sm:mt-4 text-base sm:text-lg font-semibold text-gray-900">
            {t("admin:roomTypes.noRoomTypes")}
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-gray-600">
            {t("admin:roomTypes.noRoomTypesDescription")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {sortedRoomTypes.map((roomType) => (
            <div
              key={roomType.id}
              className={`group relative flex flex-col overflow-hidden rounded-xl border transition-all hover:shadow-md ${
                roomType.isActive
                  ? "border-gray-200 bg-white shadow-sm"
                  : "border-gray-300 bg-gray-50/80"
              }`}
            >
              {/* Compact Header */}
              <div
                className={`flex items-center gap-2.5 px-3.5 pt-3.5 pb-2 ${!roomType.isActive ? "opacity-60" : ""}`}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand/10 text-lg">
                  🏨
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-gray-900 truncate leading-tight">
                    {roomType.name}
                  </h3>
                  <p className="text-[11px] text-gray-500 truncate leading-tight mt-0.5">
                    {roomType.squareMeters} m² ·{" "}
                    {t("admin:roomTypes.petsCount", { count: roomType.maxCapacity })}
                  </p>
                </div>
                {!roomType.isActive && (
                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 flex-shrink-0">
                    {t("admin:roomTypes.inactive")}
                  </span>
                )}
              </div>

              {/* Description */}
              <div className={`px-3.5 ${!roomType.isActive ? "opacity-60" : ""}`}>
                <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                  {roomType.description}
                </p>
              </div>

              {/* Price Block */}
              <div
                className={`mx-3.5 mt-2.5 rounded-lg bg-gray-50 p-2.5 ${!roomType.isActive ? "opacity-60" : ""}`}
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] text-gray-500">
                    {t("admin:roomTypes.pricePerDay")}
                  </span>
                  <span className="text-sm font-bold text-brand">
                    {formatCurrency(roomType.pricePerNight)}
                  </span>
                </div>
                {roomType.pricePerAdditionalPet > 0 && (
                  <div className="flex items-baseline justify-between mt-1">
                    <span className="text-[11px] text-gray-400">
                      {t("admin:roomTypes.additionalPet")}
                    </span>
                    <span className="text-xs font-semibold text-gray-600">
                      {formatCurrency(roomType.pricePerAdditionalPet)}
                    </span>
                  </div>
                )}
              </div>

              {/* Features */}
              {roomType.features && roomType.features.length > 0 && (
                <div className={`px-3.5 mt-2.5 ${!roomType.isActive ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap gap-1">
                    {roomType.features.slice(0, 3).map((feature, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600"
                      >
                        {feature}
                      </span>
                    ))}
                    {roomType.features.length > 3 && (
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
                        +{roomType.features.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="mt-auto px-3.5 pb-3.5 pt-3">
                <div className="flex gap-1.5 border-t border-gray-100 pt-2.5">
                  <button
                    onClick={() => openEditModal(roomType)}
                    className="flex-1 rounded-lg bg-gray-100 px-2 py-1.5 text-[10px] sm:text-xs font-semibold text-gray-700 transition hover:bg-gray-200"
                  >
                    {t("admin:roomTypes.edit")}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(roomType.id)}
                    disabled={deletingId === roomType.id}
                    className="flex-1 rounded-lg bg-red-50 px-2 py-1.5 text-[10px] sm:text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                  >
                    {deletingId === roomType.id ? "..." : t("admin:roomTypes.delete")}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl sm:rounded-2xl bg-white p-4 sm:p-6 lg:p-8 shadow-2xl">
            <div className="mb-4 sm:mb-6 flex items-center justify-between sticky top-0 bg-white z-10 pb-2 border-b border-gray-100">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                {activeRoomTypeId
                  ? t("admin:roomTypes.editTitle")
                  : t("admin:roomTypes.createTitle")}
              </h2>
              <button
                onClick={() => {
                  setFormOpen(false);
                  resetForm();
                }}
                className="rounded-lg p-1.5 sm:p-2 text-gray-500 hover:bg-gray-100 flex-shrink-0"
              >
                <svg
                  className="h-5 w-5 sm:h-6 sm:w-6"
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
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 lg:space-y-6">
              {formError && (
                <div className="rounded-xl bg-rose-50 px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-rose-600">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700">
                  {t("admin:roomTypes.nameLabel")} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={formState.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  className="mt-1 w-full rounded-lg sm:rounded-xl border border-gray-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  placeholder={t("admin:roomTypes.namePlaceholder")}
                  required
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700">
                  {t("admin:roomTypes.descriptionLabel")} <span className="text-red-600">*</span>
                </label>
                <textarea
                  value={formState.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg sm:rounded-xl border border-gray-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  placeholder={t("admin:roomTypes.descriptionPlaceholder")}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700">
                    {t("admin:roomTypes.capacityLabel")} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formState.maxCapacity}
                    onChange={(e) => updateField("maxCapacity", e.target.value)}
                    className="mt-1 w-full rounded-lg sm:rounded-xl border border-gray-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700">
                    {t("admin:roomTypes.areaLabel")} <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={formState.squareMeters}
                    onChange={(e) => updateField("squareMeters", e.target.value)}
                    className="mt-1 w-full rounded-lg sm:rounded-xl border border-gray-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700">
                    {t("admin:roomTypes.pricePerNightLabel")} (
                    {i18n.language.startsWith("en") ? "$" : "₽"}){" "}
                    <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.pricePerNight}
                    onChange={(e) => updateField("pricePerNight", e.target.value)}
                    className="mt-1 w-full rounded-lg sm:rounded-xl border border-gray-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700">
                    {t("admin:roomTypes.additionalPetLabel")} (
                    {i18n.language.startsWith("en") ? "$" : "₽"})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.pricePerAdditionalPet}
                    onChange={(e) => updateField("pricePerAdditionalPet", e.target.value)}
                    className="mt-1 w-full rounded-lg sm:rounded-xl border border-gray-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">
                  {t("admin:roomTypes.amenitiesLabel")}
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={formState.featureInput}
                    onChange={(e) => updateField("featureInput", e.target.value)}
                    onKeyDown={handleFeatureKeyDown}
                    className="flex-1 rounded-lg sm:rounded-xl border border-gray-300 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    placeholder={t("admin:roomTypes.amenityPlaceholder")}
                  />
                  <button
                    type="button"
                    onClick={addFeature}
                    className="w-full sm:w-auto rounded-lg sm:rounded-xl bg-brand px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-brand-dark whitespace-nowrap"
                  >
                    {t("admin:roomTypes.addAmenity")}
                  </button>
                </div>
                {formState.features.length > 0 && (
                  <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                    {formState.features.map((feature, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 sm:gap-2 rounded-lg bg-gray-100 px-2 sm:px-3 py-1 text-xs sm:text-sm"
                      >
                        <span className="break-words">{feature}</span>
                        <button
                          type="button"
                          onClick={() => removeFeature(feature)}
                          className="text-gray-500 hover:text-red-600 flex-shrink-0 text-base sm:text-lg leading-none"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formState.isActive}
                  onChange={(e) => updateField("isActive", e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand flex-shrink-0"
                />
                <label
                  htmlFor="isActive"
                  className="text-xs sm:text-sm font-semibold text-gray-700"
                >
                  {t("admin:roomTypes.activeLabel")}
                </label>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormOpen(false);
                    resetForm();
                  }}
                  className="w-full sm:flex-1 rounded-lg sm:rounded-xl border-2 border-gray-300 px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  {t("admin:roomTypes.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full sm:flex-1 rounded-lg sm:rounded-xl bg-brand px-4 sm:px-6 py-2 sm:py-3 text-xs sm:text-sm font-semibold text-white shadow-lg transition hover:bg-brand-dark disabled:opacity-50"
                >
                  {submitting
                    ? t("admin:roomTypes.saving")
                    : activeRoomTypeId
                      ? t("admin:roomTypes.save")
                      : t("admin:roomTypes.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={() => {
          if (confirmDeleteId) handleDeleteConfirmed(confirmDeleteId);
        }}
        message={t("admin:roomTypes.confirmDelete")}
        type="danger"
        zIndex={100}
      />

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal({ isOpen: false, message: "" })}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
};

export default AdminRoomTypesManager;
