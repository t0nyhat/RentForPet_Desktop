import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type DocSection = {
  id: "overview" | "workflows" | "screenshots";
  label: string;
  path: string;
};

const HelpDocs = () => {
  const { i18n } = useTranslation();
  const initialLang = i18n.language.startsWith("en") ? "en" : "ru";

  const [language, setLanguage] = useState<"ru" | "en">(initialLang);
  const [section, setSection] = useState<DocSection["id"]>("overview");
  const [markdown, setMarkdown] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isFileProtocol =
    typeof window !== "undefined" && window.location.protocol.toLowerCase() === "file:";

  const dictionary = useMemo(
    () => ({
      ru: {
        title: "Справка",
        subtitle: "Документация по возможностям приложения",
        back: "Назад в панель",
        sections: [
          {
            id: "overview" as const,
            label: "Обзор возможностей",
            path: "/help/ru/functional-overview.md",
          },
          { id: "workflows" as const, label: "Рабочие сценарии", path: "/help/ru/workflows.md" },
          {
            id: "screenshots" as const,
            label: "Чек-лист скриншотов",
            path: "/help/ru/screenshots-checklist.md",
          },
        ],
        ru: "Русский",
        en: "English",
        failed: "Не удалось загрузить документацию",
      },
      en: {
        title: "Help",
        subtitle: "Documentation for app capabilities",
        back: "Back to Admin",
        sections: [
          {
            id: "overview" as const,
            label: "Feature Overview",
            path: "/help/en/functional-overview.md",
          },
          { id: "workflows" as const, label: "Workflows", path: "/help/en/workflows.md" },
          {
            id: "screenshots" as const,
            label: "Screenshot Checklist",
            path: "/help/en/screenshots-checklist.md",
          },
        ],
        ru: "Russian",
        en: "English",
        failed: "Failed to load documentation",
      },
    }),
    []
  );

  useEffect(() => {
    setLanguage(i18n.language.startsWith("en") ? "en" : "ru");
  }, [i18n.language]);

  const sections = dictionary[language].sections;
  const selectedSection = sections.find((item) => item.id === section) ?? sections[0];

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const requestPath = isFileProtocol ? `.${selectedSection.path}` : selectedSection.path;
        const response = await fetch(requestPath, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`${response.status}`);
        }
        const text = await response.text();
        setMarkdown(text);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setMarkdown("");
        setError(dictionary[language].failed);
      } finally {
        setLoading(false);
      }
    };

    void load();
    return () => controller.abort();
  }, [selectedSection.path, dictionary, isFileProtocol, language]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-full flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{dictionary[language].title}</h1>
            <p className="text-sm text-slate-500">{dictionary[language].subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLanguage("ru")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${language === "ru"
                ? "bg-brand text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
            >
              {dictionary[language].ru}
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${language === "en"
                ? "bg-brand text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                }`}
            >
              {dictionary[language].en}
            </button>
            <Link
              to="/admin"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {dictionary[language].back}
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-full grid-cols-1 gap-4 px-6 py-6 md:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="space-y-1">
            {sections.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${item.id === section
                  ? "bg-brand text-white"
                  : "text-slate-700 hover:bg-slate-100"
                  }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </aside>

        <main className="rounded-2xl border border-slate-200 bg-white p-8">
          {loading && <p className="text-sm text-slate-500">Loading...</p>}
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {!loading && !error && (
            <article className="prose prose-slate max-w-none prose-img:max-w-4xl prose-img:h-auto prose-img:rounded-lg prose-img:shadow-md">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                urlTransform={(url) => {
                  if (isFileProtocol && url.startsWith("/help/")) {
                    return `.${url}`;
                  }
                  return url;
                }}
              >
                {markdown}
              </ReactMarkdown>
            </article>
          )}
        </main>
      </div>
    </div>
  );
};

export default HelpDocs;
