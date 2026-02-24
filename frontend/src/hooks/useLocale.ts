import { useTranslation } from "react-i18next";
import { useMemo } from "react";

export const useLocale = () => {
  const { i18n } = useTranslation();

  const locale = useMemo(() => {
    return i18n.language?.startsWith("en") ? "en-US" : "ru-RU";
  }, [i18n.language]);

  const formatDate = useMemo(
    () =>
      (date: string | Date, options?: Intl.DateTimeFormatOptions): string => {
        const d = typeof date === "string" ? new Date(date) : date;
        return d.toLocaleDateString(locale, options);
      },
    [locale]
  );

  const formatDateShort = useMemo(
    () =>
      (date: string | Date): string => {
        return formatDate(date, { day: "2-digit", month: "short" });
      },
    [formatDate]
  );

  const formatDateTime = useMemo(
    () =>
      (date: string | Date): string => {
        const d = typeof date === "string" ? new Date(date) : date;
        return d.toLocaleString(locale, {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      },
    [locale]
  );

  const formatCurrency = useMemo(
    () =>
      (amount: number): string => {
        const currency = locale === "en-US" ? "USD" : "RUB";
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount);
      },
    [locale]
  );

  const formatNumber = useMemo(
    () =>
      (num: number, decimals = 0): string => {
        return new Intl.NumberFormat(locale, {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(num);
      },
    [locale]
  );

  return {
    locale,
    formatDate,
    formatDateShort,
    formatDateTime,
    formatCurrency,
    formatNumber,
  };
};

export default useLocale;
