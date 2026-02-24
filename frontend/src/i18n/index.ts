import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Import translations
import ruCommon from "./locales/ru/common.json";
import ruAdmin from "./locales/ru/admin.json";
import ruBooking from "./locales/ru/booking.json";
import ruPet from "./locales/ru/pet.json";

import enCommon from "./locales/en/common.json";
import enAdmin from "./locales/en/admin.json";
import enBooking from "./locales/en/booking.json";
import enPet from "./locales/en/pet.json";

const resources = {
  ru: {
    common: ruCommon,
    admin: ruAdmin,
    booking: ruBooking,
    pet: ruPet,
  },
  en: {
    common: enCommon,
    admin: enAdmin,
    booking: enBooking,
    pet: enPet,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: "ru",
    fallbackLng: "ru",
    defaultNS: "common",
    ns: ["common", "admin", "booking", "pet"],

    detection: {
      order: ["localStorage"],
      caches: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
    },

    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;

// Helper to get current locale for date/number formatting
export const getLocale = (): string => {
  const lng = i18n.language;
  return lng === "en" ? "en-US" : "ru-RU";
};

// Helper to change language
export const changeLanguage = (lng: "ru" | "en"): void => {
  i18n.changeLanguage(lng);
};
