import { useTranslation } from "react-i18next";

interface LanguageSwitcherProps {
  collapsed?: boolean;
}

const LanguageSwitcher = ({ collapsed = false }: LanguageSwitcherProps) => {
  const { i18n } = useTranslation();

  const currentLang = i18n.language?.startsWith("en") ? "en" : "ru";

  const setLanguage = (lang: "ru" | "en") => {
    i18n.changeLanguage(lang);
  };

  // Compact version for collapsed sidebar
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={() => setLanguage("ru")}
          className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
            currentLang === "ru"
              ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
          }`}
          title="Русский"
        >
          RU
        </button>
        <button
          onClick={() => setLanguage("en")}
          className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
            currentLang === "en"
              ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
              : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
          }`}
          title="English"
        >
          EN
        </button>
      </div>
    );
  }

  // Full version for expanded sidebar
  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => setLanguage("ru")}
        className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 ${
          currentLang === "ru"
            ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
            : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
        }`}
        title="Русский"
      >
        RU
      </button>
      <button
        onClick={() => setLanguage("en")}
        className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all duration-200 ${
          currentLang === "en"
            ? "bg-white text-gray-900 shadow-sm ring-1 ring-gray-200"
            : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
        }`}
        title="English"
      >
        EN
      </button>
    </div>
  );
};

export default LanguageSwitcher;
