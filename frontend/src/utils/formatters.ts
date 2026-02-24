import i18n from "../i18n";

// Get current locale for Intl APIs
export const getLocale = (): string => {
  const lng = i18n.language;
  return lng?.startsWith("en") ? "en-US" : "ru-RU";
};

// Format date with current locale
export const formatDate = (date: string | Date, options?: Intl.DateTimeFormatOptions): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(getLocale(), options);
};

// Format date short (e.g., "Jan 15")
export const formatDateShort = (date: string | Date): string => {
  return formatDate(date, { day: "2-digit", month: "short" });
};

// Format date medium (e.g., "January 15, 2024")
export const formatDateMedium = (date: string | Date): string => {
  return formatDate(date, { day: "numeric", month: "long", year: "numeric" });
};

// Format date with time
export const formatDateTime = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(getLocale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Format time only
export const formatTime = (date: string | Date): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString(getLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Get currency code based on locale
export const getCurrencyCode = (): string => {
  const locale = getLocale();
  return locale === "en-US" ? "USD" : "RUB";
};

// Format currency
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat(getLocale(), {
    style: "currency",
    currency: getCurrencyCode(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Format number with locale
export const formatNumber = (num: number, decimals = 0): string => {
  return new Intl.NumberFormat(getLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
};

// Get weekday name
export const getWeekdayName = (date: string | Date, format: "long" | "short" = "short"): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(getLocale(), { weekday: format });
};

// Get month name
export const getMonthName = (date: string | Date, format: "long" | "short" = "long"): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(getLocale(), { month: format });
};
