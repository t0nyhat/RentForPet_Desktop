import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "../Modal";

export type ClientFormData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address?: string;
  emergencyContact?: string;
  internalNotes?: string;
  loyaltyDiscountPercent: number;
};

type ClientFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ClientFormData) => Promise<void>;
  initialData?: Partial<ClientFormData>;
  mode: "create" | "edit";
};

const buildInitialFormData = (source?: Partial<ClientFormData>): ClientFormData => ({
  firstName: source?.firstName || "",
  lastName: source?.lastName || "",
  email: source?.email || "",
  phone: source?.phone || "",
  address: source?.address || "",
  emergencyContact: source?.emergencyContact || "",
  internalNotes: source?.internalNotes || "",
  loyaltyDiscountPercent: source?.loyaltyDiscountPercent ?? 0,
});

export const ClientFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
}: ClientFormModalProps) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<ClientFormData>(() => buildInitialFormData(initialData));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData(buildInitialFormData(initialData));
      setError(null);
    }
  }, [initialData, isOpen, mode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onSubmit(formData);
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t("admin:clientForm.error");
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all";
  const labelClass = "block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        mode === "create" ? t("admin:clientForm.createTitle") : t("admin:clientForm.editTitle")
      }
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600 flex items-center gap-2">
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

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className={labelClass}>
              {t("admin:clientForm.firstName")} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              className={inputClass}
              placeholder={t("admin:clientForm.firstNamePlaceholder")}
            />
          </div>

          <div>
            <label className={labelClass}>
              {t("admin:clientForm.lastName")} <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              className={inputClass}
              placeholder={t("admin:clientForm.lastNamePlaceholder")}
            />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className={labelClass}>{t("admin:clientForm.email")}</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className={inputClass}
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className={labelClass}>{t("admin:clientForm.phone")}</label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className={inputClass}
              placeholder="+7 (999) 000-00-00"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>{t("admin:clientForm.address")}</label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className={inputClass}
            placeholder={t("admin:clientForm.addressPlaceholder")}
          />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className={labelClass}>{t("admin:clientForm.emergencyContact")}</label>
            <input
              type="text"
              value={formData.emergencyContact}
              onChange={(e) => setFormData({ ...formData, emergencyContact: e.target.value })}
              className={inputClass}
              placeholder={t("admin:clientForm.emergencyContactPlaceholder")}
            />
          </div>
          <div>
            <label className={labelClass}>{t("admin:clientForm.discount")}</label>
            <input
              type="number"
              min={0}
              max={100}
              step="1"
              value={formData.loyaltyDiscountPercent}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                setFormData({
                  ...formData,
                  loyaltyDiscountPercent: isNaN(val) ? 0 : Math.min(100, Math.max(0, val)),
                });
              }}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>{t("admin:clientForm.notes")}</label>
          <textarea
            value={formData.internalNotes}
            onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 min-h-[100px]"
            placeholder={t("admin:clientForm.notesPlaceholder")}
          />
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            {t("admin:clientForm.cancel")}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-dark hover:shadow-xl disabled:opacity-50"
          >
            {loading
              ? t("admin:clientForm.saving")
              : mode === "create"
                ? t("admin:clientForm.create")
                : t("admin:clientForm.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default ClientFormModal;
