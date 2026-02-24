import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";

const SUPPORT_EMAIL = "exkitter@gmail.com";
const SUBJECT = "Feedback - PetHotel";

export default function AdminFeedbackPanel() {
  const { t } = useTranslation("admin");

  const [feedbackName, setFeedbackName] = useState("");
  const [feedbackEmail, setFeedbackEmail] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const [feedbackResult, setFeedbackResult] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const submitFeedback = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      setFeedbackResult(null);

      if (!feedbackName.trim() || !feedbackEmail.trim() || !feedbackMessage.trim()) {
        setFeedbackResult({ type: "error", text: t("systemPanel.feedbackValidation") });
        return;
      }

      setFeedbackSending(true);

      const bodyLines = [
        `Name: ${feedbackName.trim()}`,
        `Email: ${feedbackEmail.trim()}`,
        "",
        feedbackMessage.trim(),
      ];
      const body = bodyLines.join("\n");
      const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(body)}`;

      window.location.href = mailto;
      setFeedbackMessage("");
      setFeedbackResult({ type: "success", text: t("systemPanel.feedbackSuccess") });
      setFeedbackSending(false);
    },
    [feedbackEmail, feedbackMessage, feedbackName, t]
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-slate-900">{t("systemPanel.feedbackTitle")}</h2>
        <p className="text-xs text-slate-500">{t("systemPanel.feedbackHint")}</p>
      </div>

      <form onSubmit={submitFeedback} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">
              {t("systemPanel.feedbackName")}
            </span>
            <input
              type="text"
              value={feedbackName}
              onChange={(e) => setFeedbackName(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-brand focus:outline-none"
              placeholder={t("systemPanel.feedbackNamePlaceholder")}
              required
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-slate-600">
              {t("systemPanel.feedbackEmail")}
            </span>
            <input
              type="email"
              value={feedbackEmail}
              onChange={(e) => setFeedbackEmail(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-brand focus:outline-none"
              placeholder={t("systemPanel.feedbackEmailPlaceholder")}
              required
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-600">
            {t("systemPanel.feedbackMessage")}
          </span>
          <textarea
            value={feedbackMessage}
            onChange={(e) => setFeedbackMessage(e.target.value)}
            rows={4}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-brand focus:outline-none"
            placeholder={t("systemPanel.feedbackMessagePlaceholder")}
            required
          />
        </label>

        {feedbackResult && (
          <div
            className={`rounded-lg border px-3 py-2 text-xs font-medium ${
              feedbackResult.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {feedbackResult.text}
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={feedbackSending}
            className="inline-flex items-center gap-2 rounded-lg border border-brand bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-60"
          >
            {feedbackSending ? t("systemPanel.feedbackSending") : t("systemPanel.feedbackSend")}
          </button>
        </div>
      </form>
    </section>
  );
}
