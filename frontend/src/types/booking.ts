import i18n from "../i18n";

/**
 * Booking calculation mode (Days vs Nights)
 */
export enum BookingCalculationMode {
  Days = 0,
  Nights = 1,
}

/**
 * Booking settings singleton
 */
export interface BookingSettings {
  id: string;
  calculationMode: BookingCalculationMode;
  checkInTime: string; // Time format: "HH:mm:ss"
  checkOutTime: string; // Time format: "HH:mm:ss"
  isSingleton: boolean;
}

/**
 * Booking settings update DTO
 */
export interface BookingSettingsUpdateDto {
  calculationMode: BookingCalculationMode;
  checkInTime: string;
  checkOutTime: string;
}

/**
 * Helper to format time from "HH:mm:ss" to "HH:mm"
 */
export function formatBookingTime(time: string): string {
  const parts = time.split(":");
  return `${parts[0]}:${parts[1]}`;
}

/**
 * Helper to get user-friendly mode name
 */
export function getCalculationModeName(mode: BookingCalculationMode): string {
  return mode === BookingCalculationMode.Days
    ? i18n.t("admin:unitNames.calculationMode_days")
    : i18n.t("admin:unitNames.calculationMode_nights");
}

/**
 * Helper to get unit name (day/days or night/nights) with proper pluralization
 */
export function getUnitName(mode: BookingCalculationMode, count: number): string {
  if (mode === BookingCalculationMode.Days) {
    return i18n.t("admin:unitNames.day", { count });
  } else {
    return i18n.t("admin:unitNames.night", { count });
  }
}
