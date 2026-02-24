import { useMemo } from "react";
import { useTranslation } from "react-i18next";

type DateRange = {
  checkInDate: string;
  checkOutDate: string;
};

type DateRangeCalendarProps = {
  month: Date;
  onMonthChange: (month: Date) => void;
  checkInDate: string;
  checkOutDate: string;
  busyDates: Set<string>;
  onChange: (range: DateRange) => void;
  minDate?: Date;
  onInvalidRange?: (message: string) => void;
  blockBusyDates?: boolean;
};

const toDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const startOfDay = (date: Date) => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

const addMonths = (date: Date, count: number) => {
  const newDate = new Date(date);
  newDate.setMonth(newDate.getMonth() + count);
  return newDate;
};

const addDays = (date: Date, count: number) => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + count);
  return newDate;
};

const parseDateKey = (value: string) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if ([year, month, day].some((part) => Number.isNaN(part))) return null;
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

const DateRangeCalendar = ({
  month,
  onMonthChange,
  checkInDate,
  checkOutDate,
  busyDates,
  onChange,
  minDate,
  onInvalidRange,
  blockBusyDates = true,
}: DateRangeCalendarProps) => {
  const { t } = useTranslation();
  const monthNames = t("admin:calendar.months", { returnObjects: true }) as string[];
  const weekDays = t("admin:calendar.weekDays", { returnObjects: true }) as string[];

  const today = startOfDay(minDate ?? new Date());
  const startDate = parseDateKey(checkInDate);
  const endDate = parseDateKey(checkOutDate);

  const monthMetadata = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthDays = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const startWeekDay = (firstDay.getDay() + 6) % 7; // Monday first
    const days: Array<Date | null> = [];

    for (let i = 0; i < startWeekDay; i++) {
      days.push(null);
    }
    for (let day = 1; day <= monthDays; day++) {
      days.push(new Date(month.getFullYear(), month.getMonth(), day));
    }
    return { days };
  }, [month]);

  const isBusy = (date: Date) => busyDates.has(toDateKey(date));

  const hasBusyBetween = (from: Date, to: Date) => {
    let current = addDays(from, 1);
    while (current < to) {
      if (isBusy(current)) {
        return true;
      }
      current = addDays(current, 1);
    }
    return false;
  };

  const handleDayClick = (day: Date | null) => {
    if (!day) return;
    const dayStart = startOfDay(day);
    const dayIso = toDateKey(dayStart);

    if (dayStart < today) {
      onInvalidRange?.(t("admin:calendar.cannotSelectPastDate"));
      return;
    }

    if (blockBusyDates && isBusy(dayStart)) {
      onInvalidRange?.(t("admin:calendar.dayAlreadyOccupied"));
      return;
    }

    if (!startDate || (startDate && endDate)) {
      onInvalidRange?.("");
      onChange({ checkInDate: dayIso, checkOutDate: "" });
      return;
    }

    if (dayStart <= startDate) {
      onChange({ checkInDate: dayIso, checkOutDate: "" });
      return;
    }

    if (blockBusyDates && hasBusyBetween(startDate, dayStart)) {
      onInvalidRange?.(t("admin:calendar.rangeHasOccupiedDates"));
      return;
    }

    onInvalidRange?.("");
    onChange({ checkInDate: toDateKey(startDate), checkOutDate: dayIso });
  };

  const changeMonth = (delta: number) => {
    const next = addMonths(month, delta);
    const minMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    if (next < minMonth) return;
    onMonthChange(next);
  };

  const renderDay = (day: Date | null, index: number) => {
    if (!day) {
      return <div key={`empty-${index}`} className="h-10" />;
    }

    const iso = toDateKey(day);
    const isPast = day < today;
    const busy = isBusy(day);
    const isSelectedStart = !!startDate && iso === toDateKey(startDate);
    const isSelectedEnd = !!endDate && iso === toDateKey(endDate);
    const isInRange = startDate && endDate && day > startDate && day < endDate;

    let classes = "flex h-10 w-10 items-center justify-center rounded-full text-sm transition";

    if (isSelectedStart || isSelectedEnd) {
      classes += " bg-emerald-600 text-white";
    } else if (isInRange) {
      classes += " bg-emerald-50 text-emerald-700 font-semibold";
    } else if (busy) {
      classes += " bg-rose-100 text-rose-700";
    } else if (isPast) {
      classes += " text-slate-300";
    } else {
      classes += " text-slate-700 hover:bg-emerald-50 hover:text-emerald-700";
    }

    return (
      <button
        key={iso}
        type="button"
        onClick={() => handleDayClick(day)}
        disabled={isPast || (blockBusyDates && busy)}
        className={classes}
      >
        {day.getDate()}
      </button>
    );
  };

  return (
    <div className="rounded-3xl border border-slate-100 p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600"
        >
          ←
        </button>
        <p className="text-sm font-semibold text-slate-900">
          {monthNames[month.getMonth()]} {month.getFullYear()}
        </p>
        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600"
        >
          →
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-slate-400">
        {weekDays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-7 gap-2 text-center">
        {monthMetadata.days.map((day, index) => renderDay(day, index))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-emerald-600" />
          <span>{t("admin:calendar.selectedDates")}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-rose-400" />
          <span>{t("admin:calendar.roomOccupied")}</span>
        </div>
      </div>
    </div>
  );
};

export default DateRangeCalendar;
