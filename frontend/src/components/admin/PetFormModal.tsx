import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../Modal";
import DateInput from "../DateInput";
import { getSpeciesOptions, getGenderOptions, getDogGenderOptions } from "../../constants/pet";

export type PetFormData = {
  name: string;
  species: number;
  gender: number;
  breed?: string;
  birthDate?: string;
  weight?: number;
  color?: string;
  microchip?: string;
  specialNeeds?: string;
  internalNotes?: string;
  id?: string;
};

type PetFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PetFormData) => Promise<void>;
  clientName?: string;
  initialData?: Partial<PetFormData>;
  mode?: "create" | "edit";
};

const initialForm: PetFormData = {
  name: "",
  species: 0,
  gender: 0,
  breed: "",
  birthDate: "",
  weight: undefined,
  color: "",
  microchip: "",
  specialNeeds: "",
  internalNotes: "",
};

export const PetFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  clientName,
  initialData,
  mode = "create",
}: PetFormModalProps) => {
  const { t } = useTranslation();
  const [form, setForm] = useState<PetFormData>(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const speciesOptions = getSpeciesOptions();
  const genderOptions = getGenderOptions();
  const dogGenderOptions = getDogGenderOptions();

  useEffect(() => {
    if (isOpen && initialData) {
      setForm({
        id: initialData.id,
        name: initialData.name || "",
        species: initialData.species || 0,
        gender: initialData.gender || 0,
        breed: initialData.breed || "",
        birthDate: initialData.birthDate || "",
        weight: initialData.weight,
        color: initialData.color || "",
        microchip: initialData.microchip || "",
        specialNeeds: initialData.specialNeeds || "",
        internalNotes: initialData.internalNotes || "",
      });
    } else if (isOpen && mode === "create") {
      setForm(initialForm);
    }
  }, [isOpen, initialData, mode]);

  const handleInputChange = <K extends keyof PetFormData>(key: K, value: PetFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await onSubmit(form);
      if (mode === "create") {
        setForm(initialForm);
      }
      onClose();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : t("admin:petForm.saveError");
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setForm(initialForm);
    setError(null);
    onClose();
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all";
  const labelClass = "block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5";

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={mode === "create" ? t("admin:petForm.createTitle") : t("admin:petForm.editTitle")}
      size="lg"
    >
      {clientName && mode === "create" && (
        <div className="mb-6 p-4 rounded-xl bg-brand/5 border border-brand/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center text-brand">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
              {t("admin:petForm.owner")}
            </p>
            <p className="text-sm font-bold text-slate-900">{clientName}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className={labelClass}>
            {t("admin:petForm.name")} <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            className={inputClass}
            placeholder={t("admin:petForm.namePlaceholder")}
            required
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className={labelClass}>
              {t("admin:petForm.species")} <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.species}
              onChange={(e) => handleInputChange("species", Number(e.target.value))}
              className={inputClass}
              required
            >
              {speciesOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>
              {t("admin:petForm.gender")} <span className="text-rose-500">*</span>
            </label>
            <select
              value={form.gender}
              onChange={(e) => handleInputChange("gender", Number(e.target.value))}
              className={inputClass}
              required
            >
              {(form.species === 0 ? dogGenderOptions : genderOptions).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className={labelClass}>{t("admin:petForm.breed")}</label>
            <input
              type="text"
              value={form.breed}
              onChange={(e) => handleInputChange("breed", e.target.value)}
              className={inputClass}
              placeholder={t("admin:petForm.breedPlaceholder")}
            />
          </div>

          <div>
            <label className={labelClass}>{t("admin:petForm.birthDate")}</label>
            <DateInput
              value={form.birthDate || ""}
              onChange={(v) => handleInputChange("birthDate", v)}
              className={inputClass}
              disablePastDates={false}
              maxDate={new Date()}
            />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label className={labelClass}>{t("pet:weight")} (kg)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={form.weight ?? ""}
              onChange={(e) =>
                handleInputChange("weight", e.target.value ? Number(e.target.value) : undefined)
              }
              className={inputClass}
              placeholder="0.0"
            />
          </div>

          <div>
            <label className={labelClass}>{t("admin:petForm.color")}</label>
            <input
              type="text"
              value={form.color}
              onChange={(e) => handleInputChange("color", e.target.value)}
              className={inputClass}
              placeholder={t("admin:petForm.colorPlaceholder")}
            />
          </div>

          <div>
            <label className={labelClass}>{t("admin:petForm.chipId")}</label>
            <input
              type="text"
              value={form.microchip}
              onChange={(e) => handleInputChange("microchip", e.target.value)}
              className={inputClass}
              placeholder="№"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>{t("admin:petForm.healthNotes")}</label>
          <textarea
            value={form.specialNeeds}
            onChange={(e) => handleInputChange("specialNeeds", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 min-h-[80px]"
            placeholder={t("admin:petForm.healthNotesPlaceholder")}
          />
        </div>

        <div>
          <label className={labelClass}>{t("admin:petForm.internalNotes")}</label>
          <textarea
            value={form.internalNotes}
            onChange={(e) => handleInputChange("internalNotes", e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 min-h-[80px]"
            placeholder={t("admin:petForm.internalNotesPlaceholder")}
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            disabled={loading}
          >
            {t("admin:petForm.cancel")}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-dark hover:shadow-xl disabled:opacity-50"
          >
            {loading
              ? t("admin:petForm.saving")
              : mode === "create"
                ? t("admin:petForm.create")
                : t("admin:petForm.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
};
