import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useTranslation } from "react-i18next";
import ConfirmModal from "../ConfirmModal";
import {
  BookingSettings,
  BookingCalculationMode,
  getCalculationModeName,
  formatBookingTime,
} from "../../types/booking";
import {
  ClockIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from "@heroicons/react/24/outline";

const AdminBookingSettings = () => {
  const { authFetch } = useAuth();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<BookingSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showActiveBookingsWarning, setShowActiveBookingsWarning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasActiveBookings, setHasActiveBookings] = useState(false);

  // Form state
  const [calculationMode, setCalculationMode] = useState<BookingCalculationMode>(
    BookingCalculationMode.Days
  );
  const [checkInTime, setCheckInTime] = useState("15:00");
  const [checkOutTime, setCheckOutTime] = useState("12:00");

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await authFetch("/api/admin/settings/booking");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
        setCalculationMode(data.calculationMode);
        setCheckInTime(formatBookingTime(data.checkInTime));
        setCheckOutTime(formatBookingTime(data.checkOutTime));
      } else {
        const body = await res.json();
        setError(body.error || t("admin:bookingSettingsPage.loadError"));
      }
    } catch (err) {
      setError((err as Error).message || t("admin:bookingSettingsPage.loadErrorGeneric"));
    } finally {
      setLoading(false);
    }
  }, [authFetch, t]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const checkActiveBookings = async () => {
    try {
      const res = await authFetch("/api/admin/settings/booking/has-active-bookings");
      if (res.ok) {
        const data = await res.json();
        setHasActiveBookings(data.hasActiveBookings);
        return data.hasActiveBookings;
      }
      return false;
    } catch (err) {
      console.error("Error checking active bookings:", err);
      return false;
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      // Check for active bookings before saving
      const activeBookingsExist = await checkActiveBookings();
      if (activeBookingsExist) {
        setSaving(false);
        setShowActiveBookingsWarning(true);
        return;
      }

      doSave();
    } catch (err) {
      setError((err as Error).message || t("admin:bookingSettingsPage.saveError"));
      setSaving(false);
    }
  };

  const doSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const payload = {
        calculationMode,
        checkInTime: checkInTime,
        checkOutTime: checkOutTime,
      };

      const res = await authFetch("/api/admin/settings/booking", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        setSettings(updated);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const body = await res.json();
        setError(body.error || t("admin:bookingSettingsPage.saveError"));
      }
    } catch (err) {
      setError((err as Error).message || t("admin:bookingSettingsPage.saveErrorGeneric"));
    } finally {
      setSaving(false);
    }
  };

  const isModified = () => {
    if (!settings) return false;
    return (
      calculationMode !== settings.calculationMode ||
      checkInTime !== formatBookingTime(settings.checkInTime) ||
      checkOutTime !== formatBookingTime(settings.checkOutTime)
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-brand border-r-transparent"></div>
          <p className="mt-2 text-sm text-slate-600">{t("admin:bookingSettingsPage.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-900">
            {t("admin:bookingSettingsPage.title")}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{t("admin:bookingSettingsPage.subtitle")}</p>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-600 shrink-0" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-4">
            <CheckCircleIcon className="h-5 w-5 text-green-600 shrink-0" />
            <p className="text-sm text-green-800">{t("admin:bookingSettingsPage.saveSuccess")}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Calculation Mode */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              <CalendarIcon className="inline h-5 w-5 mr-1.5 -mt-0.5" />
              {t("admin:bookingSettingsPage.calculationMode")}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setCalculationMode(BookingCalculationMode.Days)}
                className={`relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition ${
                  calculationMode === BookingCalculationMode.Days
                    ? "border-brand bg-brand/5 ring-2 ring-brand/20"
                    : "border-slate-200 bg-white hover:border-brand/50"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-base font-bold text-slate-900">
                    {t("admin:bookingSettingsPage.daysMode")}
                  </span>
                  {calculationMode === BookingCalculationMode.Days && (
                    <CheckCircleIcon className="h-5 w-5 text-brand" />
                  )}
                </div>
                <p className="text-sm text-slate-600">
                  {t("admin:bookingSettingsPage.daysModeDescription")}
                </p>
                <p className="text-xs text-slate-500 bg-slate-100 rounded-lg px-2 py-1">
                  {t("admin:bookingSettingsPage.daysModeExample")}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setCalculationMode(BookingCalculationMode.Nights)}
                className={`relative flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition ${
                  calculationMode === BookingCalculationMode.Nights
                    ? "border-brand bg-brand/5 ring-2 ring-brand/20"
                    : "border-slate-200 bg-white hover:border-brand/50"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-base font-bold text-slate-900">
                    {t("admin:bookingSettingsPage.nightsMode")}
                  </span>
                  {calculationMode === BookingCalculationMode.Nights && (
                    <CheckCircleIcon className="h-5 w-5 text-brand" />
                  )}
                </div>
                <p className="text-sm text-slate-600">
                  {t("admin:bookingSettingsPage.nightsModeDescription")}
                </p>
                <p className="text-xs text-slate-500 bg-slate-100 rounded-lg px-2 py-1">
                  {t("admin:bookingSettingsPage.nightsModeExample")}
                </p>
              </button>
            </div>
          </div>

          {/* Check-in/Check-out Times */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="checkInTime"
                className="block text-sm font-semibold text-slate-700 mb-2"
              >
                <ClockIcon className="inline h-5 w-5 mr-1.5 -mt-0.5" />
                {t("admin:bookingSettingsPage.checkInTime")}
              </label>
              <input
                type="time"
                id="checkInTime"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                {t("admin:bookingSettingsPage.checkInTimeDescription")}
              </p>
            </div>

            <div>
              <label
                htmlFor="checkOutTime"
                className="block text-sm font-semibold text-slate-700 mb-2"
              >
                <ClockIcon className="inline h-5 w-5 mr-1.5 -mt-0.5" />
                {t("admin:bookingSettingsPage.checkOutTime")}
              </label>
              <input
                type="time"
                id="checkOutTime"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm focus:border-brand focus:ring-2 focus:ring-brand/20 outline-none transition"
              />
              <p className="mt-1.5 text-xs text-slate-500">
                {t("admin:bookingSettingsPage.checkOutTimeDescription")}
              </p>
            </div>
          </div>

          {/* Current settings display */}
          {settings && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                {t("admin:bookingSettingsPage.currentSettings")}
              </h3>
              <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-slate-600 mb-1">
                    {t("admin:bookingSettingsPage.calculationModeLabel")}
                  </dt>
                  <dd className="font-semibold text-slate-900">
                    {getCalculationModeName(settings.calculationMode)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600 mb-1">
                    {t("admin:bookingSettingsPage.checkInTime")}
                  </dt>
                  <dd className="font-semibold text-slate-900">
                    {formatBookingTime(settings.checkInTime)}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-600 mb-1">
                    {t("admin:bookingSettingsPage.checkOutTime")}
                  </dt>
                  <dd className="font-semibold text-slate-900">
                    {formatBookingTime(settings.checkOutTime)}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {/* Warning about active bookings */}
          {hasActiveBookings && isModified() && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <ExclamationTriangleIcon className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900 mb-1">
                  {t("admin:bookingSettingsPage.activeBookingsAlert")}
                </p>
                <p className="text-sm text-amber-800">
                  {t("admin:bookingSettingsPage.activeBookingsAlertText")}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={fetchSettings}
              disabled={saving}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t("admin:bookingSettingsPage.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !isModified()}
              className="rounded-lg bg-brand px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="inline-block animate-spin mr-2">⏳</span>
                  {t("admin:bookingSettingsPage.saving")}
                </>
              ) : (
                t("admin:bookingSettingsPage.save")
              )}
            </button>
          </div>
        </div>
      </div>
      {/* Active Bookings Warning Modal */}
      <ConfirmModal
        isOpen={showActiveBookingsWarning}
        onClose={() => setShowActiveBookingsWarning(false)}
        onConfirm={() => doSave()}
        message={t("admin:bookingSettingsPage.activeBookingsWarning")}
        type="warning"
      />
    </div>
  );
};

export default AdminBookingSettings;
