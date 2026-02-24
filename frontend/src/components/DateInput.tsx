import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ChangeEventHandler,
  type FocusEventHandler,
} from "react";
import { createPortal } from "react-dom";
import i18n from "../i18n";

type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  value: string;
  onChange: (value: string) => void; // expects ISO yyyy-MM-dd or empty string
  disablePastDates?: boolean;
  maxDate?: Date;
  popoverClassName?: string;
  centerOnScreen?: boolean;
};

// Hook to detect mobile viewport
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return isMobile;
};

// Format ISO (yyyy-MM-dd) to display (dd.MM.yyyy)
const isoToDisplay = (iso: string): string => {
  if (!iso) return "";
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(iso);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${d}.${mo}.${y}`;
};

// Convert display (dd.MM.yyyy) to ISO (yyyy-MM-dd) if valid
const displayToIso = (display: string): string | null => {
  const m = /^([0-9]{2})\.([0-9]{2})\.([0-9]{4})$/.exec(display);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (!y || !mo || !d) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  const dd = String(d).padStart(2, "0");
  const mm = String(mo).padStart(2, "0");
  const yyyy = String(y).padStart(4, "0");
  return `${yyyy}-${mm}-${dd}`;
};

// Build masked display string from digits only
const maskDigits = (raw: string): string => {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd}.${mm}`;
  return `${dd}.${mm}.${yyyy}`;
};

const getMonthNames = () => i18n.t("common:calendar.months", { returnObjects: true }) as string[];
const getWeekDays = () => i18n.t("common:calendar.weekDays", { returnObjects: true }) as string[];

const toISO = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const DateInput = ({
  value,
  onChange,
  placeholder,
  className,
  onBlur,
  disablePastDates = true,
  maxDate,
  popoverClassName,
  centerOnScreen = false,
  ...rest
}: DateInputProps) => {
  const [text, setText] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState<Date>(() => {
    const iso = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toISO(new Date());
    const [y, m] = iso.split("-").map(Number);
    return new Date(y || new Date().getFullYear(), (m || 1) - 1, 1);
  });
  const anchorRef = useRef<HTMLInputElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });
  const isMobile = useIsMobile();
  // On mobile or when centerOnScreen is true, show calendar centered
  const shouldCenter = isMobile || centerOnScreen;

  // Keep display text in sync with external ISO value
  useEffect(() => {
    setText(isoToDisplay(value));
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      const dt = new Date(Number(y), Number(m) - 1, Number(d));
      setMonth(new Date(dt.getFullYear(), dt.getMonth(), 1));
    }
  }, [value]);

  const inputPlaceholder = useMemo(
    () => placeholder ?? i18n.t("common:calendar.placeholder"),
    [placeholder]
  );

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const masked = maskDigits(e.target.value);
    setText(masked);

    if (masked.length === 0) {
      onChange("");
      return;
    }

    if (masked.length === 10) {
      const iso = displayToIso(masked);
      if (iso) onChange(iso);
    }
  };

  const handleBlur: FocusEventHandler<HTMLInputElement> = (e) => {
    // Try to finalize on blur
    const current = e.target.value;
    const iso = displayToIso(current);
    if (current && iso) {
      // Normalize display in case of missing zeros
      setText(isoToDisplay(iso));
      onChange(iso);
    }
    if (onBlur) onBlur(e);
  };

  const recalcPosition = () => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // For position: fixed, top/left are viewport-relative, no scroll offsets
    const top = Math.round(rect.bottom + 6);
    const left = Math.round(rect.left);
    setPosition({ top, left, width: rect.width });
  };

  useEffect(() => {
    if (!open) return;
    recalcPosition();
    const onScroll = () => recalcPosition();
    const onResize = () => recalcPosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!open) return;
      const a = anchorRef.current;
      const p = popoverRef.current;
      const target = e.target as Node;
      if (a && a.contains(target)) return;
      if (p && p.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const firstDayOfMonth = useMemo(
    () => new Date(month.getFullYear(), month.getMonth(), 1),
    [month]
  );
  const daysInMonth = useMemo(
    () => new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate(),
    [month]
  );
  const startWeekDay = useMemo(() => (firstDayOfMonth.getDay() + 6) % 7, [firstDayOfMonth]); // Monday-first

  const daysArray = useMemo(() => {
    const arr: Array<Date | null> = [];
    for (let i = 0; i < startWeekDay; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++)
      arr.push(new Date(month.getFullYear(), month.getMonth(), d));
    return arr;
  }, [month, daysInMonth, startWeekDay]);

  const currentIso = value;
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const normalizedMaxDate = useMemo(() => {
    if (!maxDate) return null;
    const d = new Date(maxDate);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [maxDate]);

  const yearOptions = useMemo(() => {
    const maxY = (normalizedMaxDate ?? today).getFullYear() + 5;
    const minY = 1980;
    const list: number[] = [];
    for (let y = maxY; y >= minY; y--) {
      list.push(y);
    }
    return list;
  }, [normalizedMaxDate, today]);

  return (
    <>
      <input
        ref={anchorRef}
        type="text"
        inputMode="numeric"
        placeholder={inputPlaceholder}
        value={text}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={handleChange}
        onBlur={handleBlur}
        className={className}
        {...rest}
      />
      {open &&
        createPortal(
          shouldCenter ? (
            // Mobile/centered: Full-screen overlay with centered calendar
            <div
              className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setOpen(false);
              }}
            >
              <div
                ref={popoverRef}
                className={`w-full max-w-sm rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-2xl ${
                  popoverClassName ?? ""
                }`}
                style={{ animation: "calendarFadeIn 0.2s ease-out" }}
              >
                {/* Header with month/year navigation */}
                <div className="mb-4 flex items-center justify-between">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-all hover:bg-brand hover:text-white active:scale-95"
                    aria-label={i18n.t("common:calendar.prevMonth")}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 19l-7-7 7-7"
                      />
                    </svg>
                  </button>
                  <div className="flex items-center gap-2">
                    <div className="text-lg font-bold text-slate-900">
                      {getMonthNames()[month.getMonth()]}
                    </div>
                    <select
                      className="rounded-lg border-2 border-slate-200 bg-white px-3 py-1.5 text-base font-semibold text-slate-700 focus:border-brand focus:outline-none"
                      value={month.getFullYear()}
                      onChange={(e) => {
                        const newYear = Number(e.target.value);
                        setMonth(new Date(newYear, month.getMonth(), 1));
                      }}
                    >
                      {yearOptions.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-all hover:bg-brand hover:text-white active:scale-95"
                    aria-label={i18n.t("common:calendar.nextMonth")}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </div>

                {/* Week days header */}
                <div className="mb-2 grid grid-cols-7 gap-1 text-center">
                  {getWeekDays().map((d, idx) => (
                    <div
                      key={d}
                      className={`py-2 text-xs font-bold uppercase ${
                        idx >= 5 ? "text-rose-500" : "text-slate-500"
                      }`}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1 text-center">
                  {daysArray.map((d, i) => {
                    if (!d) return <div key={`e-${i}`} className="h-11" />;
                    const iso = toISO(d);
                    const isSelected = currentIso && iso === currentIso;
                    const compareDate = new Date(d);
                    compareDate.setHours(0, 0, 0, 0);
                    const isToday = iso === toISO(today);
                    const isPast = disablePastDates ? compareDate < today && !isToday : false;
                    const isAfterMax = normalizedMaxDate ? compareDate > normalizedMaxDate : false;
                    const isDisabled = isPast || isAfterMax;

                    return (
                      <button
                        key={iso}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const isoStr = toISO(d);
                          setText(isoToDisplay(isoStr));
                          onChange(isoStr);
                          setOpen(false);
                        }}
                        disabled={isDisabled}
                        className={`flex h-11 w-full items-center justify-center rounded-xl text-base font-semibold transition-all ${
                          isSelected
                            ? "bg-brand text-white shadow-lg"
                            : isToday
                              ? "bg-brand/10 text-brand ring-2 ring-brand/30 font-bold"
                              : isDisabled
                                ? "text-slate-300 cursor-not-allowed"
                                : "text-slate-700 hover:bg-slate-100 active:bg-slate-200"
                        }`}
                      >
                        {d.getDate()}
                      </button>
                    );
                  })}
                </div>

                {/* Footer with buttons */}
                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-semibold text-slate-600 transition-all hover:bg-slate-200 active:scale-[0.98]"
                  >
                    {i18n.t("common:calendar.close")}
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      const todayIso = toISO(new Date());
                      setText(isoToDisplay(todayIso));
                      onChange(todayIso);
                      setOpen(false);
                    }}
                    className="flex-1 rounded-xl bg-brand py-3 text-sm font-semibold text-white transition-all hover:bg-brand-dark active:scale-[0.98]"
                  >
                    {i18n.t("common:time.today")}
                  </button>
                </div>
              </div>
              <style>{`
                @keyframes calendarFadeIn {
                  from { transform: scale(0.95); opacity: 0; }
                  to { transform: scale(1); opacity: 1; }
                }
              `}</style>
            </div>
          ) : (
            // Desktop: Dropdown positioned below input
            <div
              ref={popoverRef}
              style={{
                top: position.top,
                left: position.left,
                width: Math.max(300, position.width),
              }}
              className={`fixed z-[300] rounded-2xl border-2 border-slate-200 bg-gradient-to-br from-white via-white to-slate-50/50 p-4 shadow-2xl backdrop-blur-sm transition-all duration-200 ease-out ${
                popoverClassName ?? ""
              }`}
            >
              {/* Header with month/year navigation */}
              <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  className="group flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:border-brand hover:bg-brand hover:text-white hover:shadow-md active:scale-95"
                  aria-label={i18n.t("common:calendar.prevMonth")}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div className="flex items-center gap-2">
                  <div className="text-base font-bold text-slate-900">
                    {getMonthNames()[month.getMonth()]}
                  </div>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                    value={month.getFullYear()}
                    onChange={(e) => {
                      const newYear = Number(e.target.value);
                      setMonth(new Date(newYear, month.getMonth(), 1));
                    }}
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                  className="group flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:border-brand hover:bg-brand hover:text-white hover:shadow-md active:scale-95"
                  aria-label={i18n.t("common:calendar.nextMonth")}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>

              {/* Week days header */}
              <div className="mb-2 grid grid-cols-7 gap-1.5 text-center">
                {getWeekDays().map((d, idx) => (
                  <div
                    key={d}
                    className={`py-1.5 text-xs font-bold uppercase ${
                      idx >= 5 ? "text-rose-500" : "text-slate-500"
                    }`}
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1.5 text-center">
                {daysArray.map((d, i) => {
                  if (!d) return <div key={`e-${i}`} className="h-10" />;
                  const iso = toISO(d);
                  const isSelected = currentIso && iso === currentIso;
                  const compareDate = new Date(d);
                  compareDate.setHours(0, 0, 0, 0);
                  const isToday = iso === toISO(today);
                  const isPast = disablePastDates ? compareDate < today && !isToday : false;
                  const isAfterMax = normalizedMaxDate ? compareDate > normalizedMaxDate : false;
                  const isDisabled = isPast || isAfterMax;

                  return (
                    <button
                      key={iso}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        const isoStr = toISO(d);
                        setText(isoToDisplay(isoStr));
                        onChange(isoStr);
                        setOpen(false);
                      }}
                      disabled={isDisabled}
                      className={`group relative flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                        isSelected
                          ? "bg-gradient-to-br from-brand to-brand-dark text-white shadow-lg scale-110 z-10"
                          : isToday
                            ? "bg-brand/10 text-brand ring-2 ring-brand/20 font-bold"
                            : isDisabled
                              ? "text-slate-300 cursor-not-allowed"
                              : "text-slate-700 hover:bg-gradient-to-br hover:from-brand/10 hover:to-brand/5 hover:text-brand hover:scale-105 hover:shadow-md"
                      }`}
                    >
                      {d.getDate()}
                      {isSelected && (
                        <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-brand/20 to-brand-dark/20 animate-pulse"></span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Footer with today button */}
              <div className="mt-4 flex justify-center border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const todayIso = toISO(new Date());
                    setText(isoToDisplay(todayIso));
                    onChange(todayIso);
                    setOpen(false);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-slate-600 transition-all hover:border-brand hover:bg-brand hover:text-white hover:shadow-md"
                >
                  {i18n.t("common:time.today")}
                </button>
              </div>
            </div>
          ),
          document.body
        )}
    </>
  );
};

export default DateInput;
