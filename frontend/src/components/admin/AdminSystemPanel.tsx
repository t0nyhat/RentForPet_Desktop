import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { exportRowsToXlsx } from "../../utils/xlsxExport";
import useLocale from "../../hooks/useLocale";
import { resolveBookingStatus } from "../../constants/bookingStatusTheme";

type BackupInfo = {
  fileName: string;
  sizeBytes: number;
  createdAt: string;
};

type DbInfo = {
  databasePath: string;
  databaseSizeBytes: number;
  backupDirectory: string;
  auditLogPath?: string;
  backups: BackupInfo[];
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const SEPARATOR = "════════════════════════════════════════════════════════════════";

/** Parse the text-based audit log into individual entry objects */
function parseAuditLog(
  raw: string
): Array<{ action: string; description: string; details: string; timestamp: string }> {
  if (!raw.trim()) return [];
  const blocks = raw.split(SEPARATOR).filter((b) => b.trim());
  const entries: Array<{
    action: string;
    description: string;
    details: string;
    timestamp: string;
  }> = [];

  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim());
    if (lines.length === 0) continue;

    // First line: [yyyy-MM-dd HH:mm:ss]  ACTION
    const headerMatch = lines[0].match(/\[(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\]\s+(.+)/);
    const timestamp = headerMatch?.[1] ?? "";
    const action = headerMatch?.[2]?.trim() ?? lines[0].trim();

    // Second line: description
    const description = lines[1]?.trim() ?? "";

    // Remaining lines: details (indented with 4 spaces)
    const detailLines = lines.slice(2).map((l) => l.replace(/^\s{4}/, ""));
    const details = detailLines.join("\n").trim();

    entries.push({ action, description, details, timestamp });
  }

  // Reverse so latest entries are first
  entries.reverse();
  return entries;
}

/** Color by action keyword */
function getActionColor(action: string): string {
  const a = action.toUpperCase();
  if (a.includes("СОЗДАН") || a.includes("ЗАСЕЛЕН"))
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (a.includes("ПОДТВЕРЖДЕН") || a.includes("ОПЛАТ"))
    return "bg-blue-50 text-blue-700 border-blue-200";
  if (a.includes("ОТМЕН") || a.includes("УДАЛЕН") || a.includes("ОТКЛОНЕН"))
    return "bg-rose-50 text-rose-700 border-rose-200";
  if (a.includes("ИЗМЕНЕН") || a.includes("ОБНОВЛЕН") || a.includes("НАЗНАЧЕН"))
    return "bg-amber-50 text-amber-700 border-amber-200";
  if (a.includes("ВЫСЕЛЕН")) return "bg-violet-50 text-violet-700 border-violet-200";
  if (a.includes("ВОЗВРАТ") || a.includes("КОНВЕРТ") || a.includes("ПЕРЕНОС"))
    return "bg-orange-50 text-orange-700 border-orange-200";
  if (a.includes("БЭКАП") || a.includes("ВОССТАНОВЛЕН"))
    return "bg-cyan-50 text-cyan-700 border-cyan-200";
  if (a.includes("НАСТРО") || a.includes("ЗАМЕТ"))
    return "bg-slate-50 text-slate-700 border-slate-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

/** Icon by action keyword */
function getActionIcon(action: string): string {
  const a = action.toUpperCase();
  if (a.includes("БРОНИРОВАН") || a.includes("ЗАСЕЛЕН") || a.includes("ВЫСЕЛЕН")) return "📋";
  if (a.includes("ОПЛАТ") || a.includes("ПЛАТЕЖ") || a.includes("ПОДТВЕРЖД")) return "💳";
  if (a.includes("КЛИЕНТ")) return "👤";
  if (a.includes("ПИТОМЦ")) return "🐾";
  if (a.includes("НОМЕР") && !a.includes("ТИП")) return "🏠";
  if (a.includes("ТИП НОМЕРА")) return "🏨";
  if (a.includes("УСЛУГ")) return "🔧";
  if (a.includes("НАСТРО")) return "⚙️";
  if (a.includes("БЭКАП") || a.includes("ВОССТАНОВЛЕН")) return "💾";
  if (a.includes("ВОЗВРАТ")) return "↩️";
  if (a.includes("ПЕРЕНОС")) return "🔄";
  if (a.includes("КОНВЕРТ")) return "💰";
  if (a.includes("ОБЪЕДИН")) return "🔗";
  if (a.includes("ЗАМЕТ")) return "📝";
  return "📝";
}

export default function AdminSystemPanel() {
  const { t } = useTranslation("admin");
  const { authFetch } = useAuth();

  // ── Database info ─────────────────────────────────────
  const [dbInfo, setDbInfo] = useState<DbInfo | null>(null);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);

  const fetchDbInfo = useCallback(async () => {
    try {
      setDbLoading(true);
      setDbError(null);
      const res = await authFetch("/api/admin/system/database/info");
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Error");
      setDbInfo(await res.json());
    } catch (err) {
      setDbError((err as Error).message);
    } finally {
      setDbLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchDbInfo();
  }, [fetchDbInfo]);

  // ── Backup / restore ──────────────────────────────────
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );
  const [selectedRestoreFileName, setSelectedRestoreFileName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createBackup = useCallback(async () => {
    try {
      setCreatingBackup(true);
      const res = await authFetch("/api/admin/system/database/backup", { method: "POST" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Error");
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i);
      const fileName = decodeURIComponent(match?.[1] ?? match?.[2] ?? "pethotel-backup.db");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      await fetchDbInfo();
    } catch (err) {
      setRestoreMsg({ type: "error", text: (err as Error).message });
    } finally {
      setCreatingBackup(false);
    }
  }, [authFetch, fetchDbInfo]);

  const restoreFromBackup = useCallback(
    async (fileName: string) => {
      if (!confirm(t("systemPanel.restoreConfirm"))) return;
      try {
        setRestoring(true);
        setRestoreMsg(null);
        const res = await authFetch("/api/admin/system/database/restore-from-backup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Error");
        setRestoreMsg({ type: "success", text: t("systemPanel.restoreSuccess") });
        await fetchDbInfo();
      } catch (err) {
        setRestoreMsg({
          type: "error",
          text: `${t("systemPanel.restoreFailed")}: ${(err as Error).message}`,
        });
      } finally {
        setRestoring(false);
      }
    },
    [authFetch, fetchDbInfo, t]
  );

  const restoreFromFile = useCallback(
    async (file: File) => {
      if (!confirm(t("systemPanel.restoreConfirm"))) return;
      try {
        setRestoring(true);
        setRestoreMsg(null);
        const formData = new FormData();
        formData.append("file", file);
        const res = await authFetch("/api/admin/system/database/restore", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Error");
        setRestoreMsg({ type: "success", text: t("systemPanel.restoreSuccess") });
        await fetchDbInfo();
      } catch (err) {
        setRestoreMsg({
          type: "error",
          text: `${t("systemPanel.restoreFailed")}: ${(err as Error).message}`,
        });
      } finally {
        setRestoring(false);
        setSelectedRestoreFileName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [authFetch, fetchDbInfo, t]
  );

  // ── Audit log (text file) ─────────────────────────────
  const [auditLogContent, setAuditLogContent] = useState("");
  const [auditLogPath, setAuditLogPath] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const autoRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAuditLog = useCallback(async () => {
    try {
      setAuditLoading(true);
      const res = await authFetch("/api/admin/system/audit-log");
      if (!res.ok) return;
      const data = await res.json();
      setAuditLogContent(data.content ?? "");
      setAuditLogPath(data.logFilePath ?? "");
    } catch {
      /* ignore */
    } finally {
      setAuditLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchAuditLog();
  }, [fetchAuditLog]);

  useEffect(() => {
    if (autoRefresh) {
      autoRefreshRef.current = setInterval(() => fetchAuditLog(), 5000);
    }
    return () => {
      if (autoRefreshRef.current) clearInterval(autoRefreshRef.current);
    };
  }, [autoRefresh, fetchAuditLog]);

  const entries = parseAuditLog(auditLogContent);

  // ── Locale hook ────────────────────────────────────
  const { locale } = useLocale();

  // ── Date parsing functions ─────────────────────────

  const parseIsoDay = useCallback((isoDate: string) => {
    const MS_IN_DAY = 1000 * 60 * 60 * 24;
    const [datePart = ""] = isoDate.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const y = year ?? 1970;
    const m = (month ?? 1) - 1;
    const d = day ?? 1;
    const date = new Date(Date.UTC(y, m, d));
    const dayNumber = Math.floor(date.getTime() / MS_IN_DAY);
    return { dayNumber, date };
  }, []);

  const fromDayNumber = useCallback((dayNumber: number) => {
    const MS_IN_DAY = 1000 * 60 * 60 * 24;
    return new Date(dayNumber * MS_IN_DAY);
  }, []);

  // ── Export schedule to Excel ──────────────────────
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const exportScheduleToExcel = useCallback(async () => {
    try {
      setExporting(true);
      setExportMsg(null);

      const now = new Date();
      const from = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 6, 1);

      const params = new URLSearchParams();
      params.set("from", from.toISOString());
      params.set("to", to.toISOString());

      const res = await authFetch(`/api/admin/bookings?${params.toString()}`);
      if (!res.ok) throw new Error(t("schedule.exportFailed"));

      const allBookings = (await res.json()) as Array<{
        id: string;
        checkInDate: string;
        checkOutDate: string;
        status: string;
        assignedRoom?: { id: string; roomNumber: string; roomTypeName: string };
        client?: { firstName: string; lastName: string };
        pets?: Array<{ name: string }>;
      }> | null;

      if (!Array.isArray(allBookings) || allBookings.length === 0) {
        setExportMsg({ type: "error", text: t("schedule.noDataForExport") });
        return;
      }

      const bookings = allBookings.filter(
        (b) =>
          b.assignedRoom &&
          b.checkInDate &&
          b.checkOutDate &&
          resolveBookingStatus(b.status) !== "Cancelled"
      );

      if (bookings.length === 0) {
        setExportMsg({ type: "error", text: t("schedule.noDataForExport") });
        return;
      }

      const roomMap = new Map<string, { id: string; roomNumber: string; roomTypeName: string }>();
      bookings.forEach((b) => {
        const room = b.assignedRoom;
        if (room && !roomMap.has(room.id)) {
          roomMap.set(room.id, {
            id: room.id,
            roomNumber: room.roomNumber,
            roomTypeName: room.roomTypeName || "-",
          });
        }
      });

      if (roomMap.size === 0) {
        setExportMsg({
          type: "error",
          text: `${t("schedule.noDataForExport")} (rooms: ${roomMap.size}, bookings: ${bookings.length})`,
        });
        return;
      }

      const usedLabels = new Set<string>();
      const roomColumns = Array.from(roomMap.values())
        .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, "ru-RU"))
        .map((room) => {
          const baseLabel = `${room.roomNumber} • ${room.roomTypeName}`.trim();
          let label = baseLabel;
          let idx = 2;
          while (usedLabels.has(label)) {
            label = `${baseLabel} (${idx})`;
            idx += 1;
          }
          usedLabels.add(label);
          return { id: room.id, label };
        });

      const occupancy = new Map<string, string[]>();
      let minDay = Number.POSITIVE_INFINITY;
      let maxDay = Number.NEGATIVE_INFINITY;

      bookings.forEach((b) => {
        const roomId = b.assignedRoom?.id;
        if (!roomId) return;

        const checkInInfo = parseIsoDay(b.checkInDate);
        const checkOutInfo = parseIsoDay(b.checkOutDate);
        const checkIn = checkInInfo.dayNumber;
        const checkOut = checkOutInfo.dayNumber;

        if (!Number.isFinite(checkIn) || !Number.isFinite(checkOut)) {
          return;
        }

        minDay = Math.min(minDay, checkIn);
        maxDay = Math.max(maxDay, checkOut);

        const pets = (b.pets ?? [])
          .map((p: { name: string }) => p.name)
          .filter(Boolean)
          .join(", ");
        const owner = b.client ? `${b.client.firstName} ${b.client.lastName}`.trim() : "Unknown";
        const cellText = pets ? `${pets} - ${owner}` : owner;

        for (let day = checkIn; day <= checkOut; day += 1) {
          const key = `${roomId}:${day}`;
          const existing = occupancy.get(key) ?? [];
          if (!existing.includes(cellText)) {
            existing.push(cellText);
          }
          occupancy.set(key, existing);
        }
      });

      if (!Number.isFinite(minDay) || !Number.isFinite(maxDay)) {
        setExportMsg({ type: "error", text: t("schedule.noDataForExport") });
        return;
      }

      const dateLabel = "Date";
      const headers = [dateLabel, ...roomColumns.map((r) => r.label)];
      const rows: Array<Record<string, unknown>> = [];

      for (let day = minDay; day <= maxDay; day += 1) {
        const currentDate = fromDayNumber(day);
        const formattedDate = currentDate.toLocaleDateString(locale, {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          weekday: "short",
        });
        const row: Record<string, unknown> = { [dateLabel]: formattedDate };
        roomColumns.forEach((room) => {
          const key = `${room.id}:${day}`;
          row[room.label] = (occupancy.get(key) ?? []).join("\n");
        });
        rows.push(row);
      }

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      exportRowsToXlsx({
        fileName: `schedule-export-${stamp}.xlsx`,
        sheetName: t("schedule.gantt"),
        headers,
        rows,
      });

      setExportMsg({ type: "success", text: t("schedule.exportSuccess") });
    } catch (err) {
      setExportMsg({
        type: "error",
        text: `${t("schedule.exportFailed")}: ${(err as Error).message}`,
      });
    } finally {
      setExporting(false);
    }
  }, [authFetch, locale, t, parseIsoDay, fromDayNumber]);

  // ── Render ────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Export Schedule ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">{t("schedule.exportExcel")}</h2>

        <p className="text-sm text-slate-600 mb-4">{t("systemPanel.exportScheduleDesc")}</p>

        {exportMsg && (
          <div
            className={`mb-4 rounded-xl px-4 py-3 text-sm ${
              exportMsg.type === "success"
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-rose-50 text-rose-700 border border-rose-200"
            }`}
          >
            {exportMsg.text}
          </div>
        )}

        <button
          type="button"
          onClick={() => void exportScheduleToExcel()}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 transition hover:border-green-400 hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          {exporting ? t("schedule.exportInProgress") : t("schedule.exportExcel")}
        </button>
      </section>

      {/* ── Database Info ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{t("systemPanel.databaseInfo")}</h2>
          <button
            type="button"
            onClick={() => void createBackup()}
            disabled={creatingBackup}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
          >
            {creatingBackup ? t("systemPanel.creatingBackup") : t("systemPanel.createBackup")}
          </button>
        </div>

        {dbLoading && <p className="text-sm text-slate-500">{t("systemPanel.loading")}</p>}
        {dbError && <p className="text-sm text-rose-600">{dbError}</p>}

        {dbInfo && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <span className="font-medium text-slate-600">{t("systemPanel.databasePath")}</span>
              <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-800 break-all select-all">
                {dbInfo.databasePath}
              </code>

              <span className="font-medium text-slate-600">{t("systemPanel.databaseSize")}</span>
              <span className="text-slate-800">{formatBytes(dbInfo.databaseSizeBytes)}</span>

              <span className="font-medium text-slate-600">{t("systemPanel.backupDirectory")}</span>
              <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-800 break-all select-all">
                {dbInfo.backupDirectory}
              </code>

              {auditLogPath && (
                <>
                  <span className="font-medium text-slate-600">
                    {t("systemPanel.auditLogFile")}
                  </span>
                  <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-mono text-slate-800 break-all select-all">
                    {auditLogPath}
                  </code>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Backups ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">{t("systemPanel.backups")}</h2>
          {restoreMsg && (
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                restoreMsg.type === "success"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700"
              }`}
            >
              {restoreMsg.text}
            </span>
          )}
        </div>

        {dbInfo?.backups?.length ? (
          <div className="overflow-hidden rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-4">{t("systemPanel.backupDate")}</th>
                  <th className="py-2 pr-4">{t("systemPanel.backupSize")}</th>
                  <th className="py-2">{t("systemPanel.backupActions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dbInfo.backups.map((b) => (
                  <tr key={b.fileName} className="hover:bg-slate-50/50">
                    <td className="py-2 pr-4">
                      <div className="font-mono text-xs text-slate-700">{b.fileName}</div>
                      <div className="text-xs text-slate-400">
                        {new Date(b.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-slate-600">{formatBytes(b.sizeBytes)}</td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => void restoreFromBackup(b.fileName)}
                        disabled={restoring}
                        className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
                      >
                        <svg
                          className="h-3 w-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        {restoring
                          ? t("systemPanel.restoring")
                          : t("systemPanel.restoreFromBackup")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !dbLoading && <p className="text-sm text-slate-500">{t("systemPanel.noBackups")}</p>
        )}

        <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4">
          <p className="text-sm font-medium text-slate-700 mb-1">
            {t("systemPanel.restoreFromFile")}
          </p>
          <p className="text-xs text-slate-500 mb-3">{t("systemPanel.restoreFromFileHint")}</p>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".db"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) {
                  setSelectedRestoreFileName("");
                  return;
                }

                setSelectedRestoreFileName(file.name);
                void restoreFromFile(file);
              }}
              disabled={restoring}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={restoring}
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              {t("systemPanel.selectFile")}
            </button>
            <span className="text-xs text-slate-500 truncate max-w-[240px]">
              {selectedRestoreFileName || t("systemPanel.noFileSelected")}
            </span>
            {restoring && (
              <span className="text-xs text-slate-500">{t("systemPanel.restoring")}</span>
            )}
          </div>
        </div>
      </section>

      {/* ── Audit Log (text file) ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t("systemPanel.auditLog")}</h2>
            <p className="text-xs text-slate-500">
              {t("systemPanel.auditLogHint")}
              {entries.length > 0 && (
                <span className="ml-2 text-slate-400">
                  ({t("systemPanel.total")}: {entries.length})
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-slate-300 text-brand focus:ring-brand h-3.5 w-3.5"
              />
              {t("systemPanel.autoRefresh")}
            </label>
            <button
              type="button"
              onClick={() => void fetchAuditLog()}
              disabled={auditLoading}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {t("systemPanel.refresh")}
            </button>
          </div>
        </div>

        {entries.length > 0 ? (
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {entries.map((entry, idx) => (
              <div
                key={`${entry.timestamp}-${idx}`}
                className={`rounded-xl border px-4 py-3 transition cursor-pointer ${getActionColor(entry.action)}`}
                onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 text-base flex-shrink-0">
                    {getActionIcon(entry.action)}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm">{entry.action}</span>
                    </div>
                    <p className="text-sm mt-0.5 opacity-80">{entry.description}</p>
                  </div>

                  <div className="text-[11px] opacity-60 whitespace-nowrap flex-shrink-0 font-mono">
                    {entry.timestamp}
                  </div>
                </div>

                {/* Expandable details */}
                {entry.details && expandedIdx === idx && (
                  <div className="mt-3 pt-3 border-t border-current/10">
                    <pre className="text-xs font-mono whitespace-pre-wrap opacity-70 leading-relaxed">
                      {entry.details}
                    </pre>
                  </div>
                )}

                {/* Expand indicator */}
                {entry.details && (
                  <div className="mt-1 text-[10px] opacity-40 text-center">
                    {expandedIdx === idx ? "▲" : "▼ " + t("systemPanel.clickToExpand")}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          !auditLoading && <p className="text-sm text-slate-500">{t("systemPanel.noEntries")}</p>
        )}
      </section>
    </div>
  );
}
