import i18n from "../i18n";

export type BookingStatusKey =
  | "Pending"
  | "WaitingForPaymentApproval"
  | "AwaitingPayment"
  | "PaymentPending"
  | "Confirmed"
  | "CheckedIn"
  | "CheckedOut"
  | "Cancelled"
  | "AwaitingRefund";

type BookingStatusDefinition = {
  labelKey: string;
  badgeClass: string;
  scheduleClass: string;
};

// Status theme with translation keys
const statusThemeConfig: Record<BookingStatusKey, BookingStatusDefinition> = {
  Pending: {
    labelKey: "booking:status.pending",
    badgeClass: "bg-amber-100 text-amber-700",
    scheduleClass: "bg-amber-100 border-amber-200 text-amber-800",
  },
  WaitingForPaymentApproval: {
    labelKey: "booking:status.awaitingPaymentApproval",
    badgeClass: "bg-orange-100 text-orange-700",
    scheduleClass: "bg-orange-100 border-orange-200 text-orange-800",
  },
  AwaitingPayment: {
    labelKey: "booking:status.awaitingPayment",
    badgeClass: "bg-purple-100 text-purple-700",
    scheduleClass: "bg-purple-100 border-purple-200 text-purple-800",
  },
  PaymentPending: {
    labelKey: "booking:status.paymentUnderReview",
    badgeClass: "bg-blue-100 text-blue-700",
    scheduleClass: "bg-blue-100 border-blue-200 text-blue-800",
  },
  Confirmed: {
    labelKey: "booking:status.confirmed",
    badgeClass: "bg-brand-light text-brand-dark",
    scheduleClass: "bg-brand-light border-brand text-brand-dark",
  },
  CheckedIn: {
    labelKey: "booking:status.checkedIn",
    badgeClass: "bg-sky-100 text-sky-700",
    scheduleClass: "bg-sky-100 border-sky-200 text-sky-700",
  },
  CheckedOut: {
    labelKey: "booking:status.checkedOut",
    badgeClass: "bg-slate-100 text-slate-600",
    scheduleClass: "bg-slate-100 border-slate-200 text-slate-600",
  },
  Cancelled: {
    labelKey: "booking:status.cancelled",
    badgeClass: "bg-rose-100 text-rose-700",
    scheduleClass: "bg-rose-100 border-rose-200 text-rose-700",
  },
  AwaitingRefund: {
    labelKey: "booking:status.awaitingRefund",
    badgeClass: "bg-rose-100 text-rose-700",
    scheduleClass: "bg-rose-100 border-rose-200 text-rose-700",
  },
};

// Get localized status label
export const getBookingStatusLabel = (status: BookingStatusKey): string => {
  const config = statusThemeConfig[status];
  return config ? i18n.t(config.labelKey) : status;
};

// Get status theme (classes + localized label)
export const getBookingStatusTheme = (status: BookingStatusKey) => {
  const config = statusThemeConfig[status];
  return {
    label: i18n.t(config.labelKey),
    badgeClass: config.badgeClass,
    scheduleClass: config.scheduleClass,
  };
};

// Legacy export for backward compatibility - now returns localized labels
export const bookingStatusTheme: Record<
  BookingStatusKey,
  { label: string; badgeClass: string; scheduleClass: string }
> = Object.fromEntries(
  (Object.keys(statusThemeConfig) as BookingStatusKey[]).map((key) => [
    key,
    {
      label: i18n.t(statusThemeConfig[key].labelKey),
      badgeClass: statusThemeConfig[key].badgeClass,
      scheduleClass: statusThemeConfig[key].scheduleClass,
    },
  ])
) as Record<BookingStatusKey, { label: string; badgeClass: string; scheduleClass: string }>;

const statusEnumToName: Record<number, BookingStatusKey> = {
  0: "Pending",
  1: "WaitingForPaymentApproval",
  2: "AwaitingPayment",
  3: "PaymentPending",
  4: "Confirmed",
  5: "CheckedIn",
  6: "CheckedOut",
  7: "Cancelled",
};

export const resolveBookingStatus = (status: string | number): BookingStatusKey => {
  if (typeof status === "number") {
    return statusEnumToName[status] ?? "Pending";
  }

  const normalized = status as BookingStatusKey;
  return bookingStatusTheme[normalized] ? normalized : "Pending";
};
