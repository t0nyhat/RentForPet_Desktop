import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import DateInput from "../DateInput";

// Autocomplete filter component - exact copy from AdminBookingsTable
type AutocompleteOption = {
  value: string;
  label: string;
  sublabel?: string;
};

type AutocompleteFilterProps = {
  label: string;
  placeholder: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: AutocompleteOption[];
  nothingFoundText?: string;
};

const AutocompleteFilter = ({
  label,
  placeholder,
  value,
  onChange,
  options,
  nothingFoundText = "Nothing found",
}: AutocompleteFilterProps) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const match = value ? options.find((option) => option.value === value) : null;
    setQuery(match?.label ?? "");
  }, [value, options]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) {
      return options.slice(0, 8);
    }
    return options
      .filter((option) => {
        const base = option.label.toLowerCase();
        const extra = option.sublabel?.toLowerCase() ?? "";
        return base.includes(normalizedQuery) || extra.includes(normalizedQuery);
      })
      .slice(0, 8);
  }, [normalizedQuery, options]);

  const handleSelect = (option: AutocompleteOption) => {
    setQuery(option.label);
    onChange(option.value);
    setOpen(false);
  };

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
    onChange(null);
    setOpen(true);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && filtered[0]) {
      event.preventDefault();
      handleSelect(filtered[0]);
    }
    if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5 text-sm" ref={containerRef}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <div className="relative">
        <input
          type="search"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setQuery("");
              setOpen(false);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-rose-500"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
        {open && (
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500">{nothingFoundText}</div>
            ) : (
              filtered.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(option)}
                  className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm text-slate-700 hover:bg-brand/5"
                >
                  <span className="font-medium">{option.label}</span>
                  {option.sublabel && (
                    <span className="text-[11px] text-slate-500">{option.sublabel}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Format currency with proper symbol based on locale
const formatCurrency = (amount: number, locale: string): string => {
  const currencySymbol = locale.startsWith("en") ? "$" : "₽";
  return `${amount.toLocaleString(locale === "en" ? "en-US" : "ru-RU")} ${currencySymbol}`;
};

// Helper to get payment status label and colors from i18n
const getPaymentStatusMap = (
  t: TFunction
): Record<number, { label: string; color: string; bgColor: string }> => ({
  0: {
    label: t("admin:payments.statuses.pending"),
    color: "text-amber-700",
    bgColor: "bg-amber-100 border-amber-300",
  },
  1: {
    label: t("admin:payments.statuses.completed"),
    color: "text-emerald-700",
    bgColor: "bg-emerald-100 border-emerald-300",
  },
  2: {
    label: t("admin:payments.statuses.failed"),
    color: "text-rose-700",
    bgColor: "bg-rose-100 border-rose-300",
  },
  3: {
    label: t("admin:payments.statuses.refund"),
    color: "text-purple-700",
    bgColor: "bg-purple-100 border-purple-300",
  },
});

// Helper to get payment method labels from i18n
const getPaymentMethodMap = (t: TFunction): Record<number, string> => ({
  0: t("admin:payments.methods.card"),
  1: t("admin:payments.methods.cash"),
  2: t("admin:payments.methods.online"),
  3: t("admin:payments.methods.qr"),
  4: t("admin:payments.methods.phone"),
});

// Helper to get payment type labels from i18n
const getPaymentTypeMap = (t: TFunction): Record<number, string> => ({
  0: t("admin:payments.types.prepayment"),
  1: t("admin:payments.types.fullPayment"),
});

export type Payment = {
  id: string;
  bookingId: string;
  amount: number;
  paymentMethod: number;
  paymentStatus: number;
  paymentType: number;
  prepaymentPercentage?: number | null;
  transactionId?: string | null;
  paidAt?: string | null;
  paymentProof?: string | null;
  adminComment?: string | null;
  confirmedAt?: string | null;
  confirmedByAdminId?: string | null;
  createdAt: string;
  booking?: {
    id: string;
    checkInDate: string;
    checkOutDate: string;
    totalPrice: number;
    status: number;
    client: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
      phone: string;
    };
    roomTypeName?: string;
    assignedRoom?: {
      id: string;
      roomNumber: string;
      roomTypeName: string;
    };
  };
};

type AdminPaymentsHistoryProps = {
  payments: Payment[];
  loading: boolean;
  error?: string | null;
};

const AdminPaymentsHistory = ({ payments, loading, error }: AdminPaymentsHistoryProps) => {
  const { t, i18n } = useTranslation();
  const paymentStatusMap = getPaymentStatusMap(t);
  const paymentMethodMap = getPaymentMethodMap(t);
  const paymentTypeMap = getPaymentTypeMap(t);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<number | "all">("all");
  const [selectedMethod, setSelectedMethod] = useState<number | "all">("all");
  const [selectedType, setSelectedType] = useState<number | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [expandedPayment, setExpandedPayment] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [showFilters, setShowFilters] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 1024;
    }
    return true;
  });

  // Filter and sort payments
  const filteredPayments = useMemo(() => {
    let result = [...payments];

    // Search filter (client name, email, booking ID, transaction ID)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((payment) => {
        const client = payment.booking?.client;
        const clientName = client
          ? `${client.firstName ?? ""} ${client.lastName ?? ""}`.toLowerCase()
          : "";
        const email = client?.email?.toLowerCase() ?? "";
        const bookingId = payment.bookingId?.toLowerCase() ?? "";
        const transactionId = payment.transactionId?.toLowerCase() ?? "";

        return (
          clientName.includes(query) ||
          email.includes(query) ||
          bookingId.includes(query) ||
          transactionId.includes(query)
        );
      });
    }

    // Status filter
    if (selectedStatus !== "all") {
      result = result.filter((p) => p.paymentStatus === selectedStatus);
    }

    // Method filter
    if (selectedMethod !== "all") {
      result = result.filter((p) => p.paymentMethod === selectedMethod);
    }

    // Type filter
    if (selectedType !== "all") {
      result = result.filter((p) => p.paymentType === selectedType);
    }

    // Date range filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      result = result.filter((p) => new Date(p.createdAt) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      result = result.filter((p) => new Date(p.createdAt) <= toDate);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "date") {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
      } else {
        // Sort by amount
        return sortOrder === "asc" ? a.amount - b.amount : b.amount - a.amount;
      }
    });

    return result;
  }, [
    payments,
    searchQuery,
    selectedStatus,
    selectedMethod,
    selectedType,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
  ]);

  // Calculate statistics
  const statistics = useMemo(() => {
    const total = filteredPayments.reduce((sum, p) => sum + p.amount, 0);
    const count = filteredPayments.length;
    const average = count > 0 ? total / count : 0;

    const byStatus = filteredPayments.reduce(
      (acc, p) => {
        acc[p.paymentStatus] = (acc[p.paymentStatus] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>
    );

    const byMethod = filteredPayments.reduce(
      (acc, p) => {
        acc[p.paymentMethod] = (acc[p.paymentMethod] || 0) + 1;
        return acc;
      },
      {} as Record<number, number>
    );

    const completed = filteredPayments.filter(
      (p) => p.paymentStatus === 1 || p.paymentStatus === 3
    ); // 3 = Refund
    const completedTotal = completed.reduce((sum, p) => sum + p.amount, 0);

    return {
      total,
      count,
      average,
      byStatus,
      byMethod,
      completedTotal,
      completedCount: completed.length,
    };
  }, [filteredPayments]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedStatus("all");
    setSelectedMethod("all");
    setSelectedType("all");
    setDateFrom("");
    setDateTo("");
  };

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (searchQuery) count++;
    if (selectedStatus !== "all") count++;
    if (selectedMethod !== "all") count++;
    if (selectedType !== "all") count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [searchQuery, selectedStatus, selectedMethod, selectedType, dateFrom, dateTo]);

  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return filteredPayments.slice(start, end);
  }, [currentPage, filteredPayments]);

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
    setExpandedPayment(null);
  }, [
    searchQuery,
    selectedStatus,
    selectedMethod,
    selectedType,
    dateFrom,
    dateTo,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-brand" />
          <p className="text-sm text-slate-600">{t("admin:payments.loading")}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-rose-50 border border-rose-200 p-4">
        <p className="text-sm font-semibold text-rose-700">
          {t("admin:payments.loadingError")} {error}
        </p>
      </div>
    );
  }

  // Button styles
  const btn = {
    base: "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
    outline:
      "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300",
  };

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
            {t("admin:payments.completedPayments")}
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-900">
            {formatCurrency(statistics.completedTotal, i18n.language)}
          </p>
          <p className="text-xs text-emerald-700">
            {statistics.completedCount} {t("admin:payments.operations")}
          </p>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
            {t("admin:payments.totalPayments")}
          </p>
          <p className="mt-2 text-2xl font-bold text-indigo-900">
            {formatCurrency(statistics.total, i18n.language)}
          </p>
          <p className="text-xs text-indigo-700">
            {statistics.count} {t("admin:payments.operations")}
          </p>
        </div>

        <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
            {t("admin:payments.averageCheck")}
          </p>
          <p className="mt-2 text-2xl font-bold text-purple-900">
            {formatCurrency(Math.round(statistics.average), i18n.language)}
          </p>
          <p className="text-xs text-purple-700">{t("admin:common.averagePerOperation")}</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            {t("admin:payments.inProcessing")}
          </p>
          <p className="mt-2 text-2xl font-bold text-amber-900">{statistics.byStatus[0] || 0}</p>
          <p className="text-xs text-amber-700">{t("admin:payments.awaitingConfirmation")}</p>
        </div>
      </div>

      {/* Header Card with Filters */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-slate-900">
                {t("admin:navigation.paymentHistory")}
              </h2>
              {!loading && (
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {filteredPayments.length}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-600">{t("admin:payments.title")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`${btn.base} relative transition-all ${
                showFilters ? "bg-brand text-white hover:bg-brand-dark shadow-sm" : `${btn.outline}`
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              <span className="hidden sm:inline">{t("admin:payments.filters")}</span>
              <span className="inline sm:hidden">
                {showFilters ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                )}
              </span>
              {activeFiltersCount > 0 && (
                <span
                  className={`absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                    showFilters ? "bg-white text-brand" : "bg-brand text-white"
                  }`}
                >
                  {activeFiltersCount}
                </span>
              )}
            </button>
            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className={`${btn.base} text-rose-600 hover:bg-rose-50`}
              >
                {t("admin:bookings.reset")}
              </button>
            )}
          </div>
        </div>

        {/* Active filters chips */}
        {activeFiltersCount > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500">
              {t("admin:bookings.activeFilters")}:
            </span>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="group inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand transition hover:bg-brand hover:text-white"
              >
                {t("admin:bookings.search")}: &quot;{searchQuery.slice(0, 20)}
                {searchQuery.length > 20 ? "..." : ""}&quot;
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
            {selectedStatus !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedStatus("all")}
                className={`group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition ${paymentStatusMap[selectedStatus].bgColor} ${paymentStatusMap[selectedStatus].color} hover:opacity-80`}
              >
                {paymentStatusMap[selectedStatus].label}
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
            {selectedMethod !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedMethod("all")}
                className="group inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-600 hover:text-white"
              >
                {paymentMethodMap[selectedMethod]}
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
            {selectedType !== "all" && (
              <button
                type="button"
                onClick={() => setSelectedType("all")}
                className="group inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700 transition hover:bg-blue-600 hover:text-white"
              >
                {paymentTypeMap[selectedType]}
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
            {dateFrom && (
              <button
                type="button"
                onClick={() => setDateFrom("")}
                className="group inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-600 hover:text-white"
              >
                {t("admin:payments.from")}: {dateFrom}
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
            {dateTo && (
              <button
                type="button"
                onClick={() => setDateTo("")}
                className="group inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-600 hover:text-white"
              >
                {t("admin:payments.to")}: {dateTo}
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="mt-4 space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* Search */}
              <div className="flex flex-col gap-1.5 text-sm sm:col-span-2">
                <span className="text-xs font-medium text-slate-600">
                  {t("admin:bookings.search")}
                </span>
                <div className="relative">
                  <svg
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("admin:payments.searchPlaceholder")}
                    className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-4 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                </div>
              </div>

              {/* Date From */}
              <div className="flex flex-col gap-1.5 text-sm">
                <span className="text-xs font-medium text-slate-600">
                  {t("admin:payments.from")}
                </span>
                <DateInput
                  value={dateFrom}
                  onChange={(v) => setDateFrom(v)}
                  disablePastDates={false}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>

              {/* Date To */}
              <div className="flex flex-col gap-1.5 text-sm">
                <span className="text-xs font-medium text-slate-600">{t("admin:payments.to")}</span>
                <DateInput
                  value={dateTo}
                  onChange={(v) => setDateTo(v)}
                  disablePastDates={false}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              {/* Status */}
              <AutocompleteFilter
                label={t("admin:payments.status")}
                placeholder={t("admin:payments.allStatuses")}
                value={selectedStatus === "all" ? null : String(selectedStatus)}
                onChange={(v) => setSelectedStatus(v === null ? "all" : Number(v))}
                options={Object.entries(paymentStatusMap).map(([value, { label }]) => ({
                  value,
                  label,
                }))}
                nothingFoundText={t("admin:common.nothingFound")}
              />

              {/* Method */}
              <AutocompleteFilter
                label={t("admin:payments.paymentMethod")}
                placeholder={t("admin:payments.allMethods")}
                value={selectedMethod === "all" ? null : String(selectedMethod)}
                onChange={(v) => setSelectedMethod(v === null ? "all" : Number(v))}
                options={Object.entries(paymentMethodMap).map(([value, label]) => ({
                  value,
                  label,
                }))}
                nothingFoundText={t("admin:common.nothingFound")}
              />

              {/* Type */}
              <AutocompleteFilter
                label={t("admin:payments.paymentType")}
                placeholder={t("admin:payments.allTypes")}
                value={selectedType === "all" ? null : String(selectedType)}
                onChange={(v) => setSelectedType(v === null ? "all" : Number(v))}
                options={Object.entries(paymentTypeMap).map(([value, label]) => ({
                  value,
                  label,
                }))}
                nothingFoundText={t("admin:common.nothingFound")}
              />
            </div>

            {/* Sort options */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-slate-600">{t("admin:payments.sort")}</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (sortBy === "date") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("date");
                      setSortOrder("desc");
                    }
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    sortBy === "date"
                      ? "bg-brand/10 text-brand shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-brand hover:bg-brand/5"
                  }`}
                >
                  {t("admin:payments.sortByDate")}{" "}
                  {sortBy === "date" && (sortOrder === "asc" ? "↑" : "↓")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (sortBy === "amount") {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy("amount");
                      setSortOrder("desc");
                    }
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    sortBy === "amount"
                      ? "bg-brand/10 text-brand shadow-sm"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-brand hover:bg-brand/5"
                  }`}
                >
                  {t("admin:payments.sortByAmount")}{" "}
                  {sortBy === "amount" && (sortOrder === "asc" ? "↑" : "↓")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Payments List */}
      <div className="space-y-3">
        {filteredPayments.length === 0 ? (
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-8 text-center">
            <p className="text-sm text-slate-600">
              {searchQuery ||
              selectedStatus !== "all" ||
              selectedMethod !== "all" ||
              selectedType !== "all" ||
              dateFrom ||
              dateTo
                ? t("admin:payments.noPaymentsFound")
                : t("admin:payments.noPayments")}
            </p>
          </div>
        ) : (
          paginatedPayments.map((payment) => {
            const statusInfo = paymentStatusMap[payment.paymentStatus];
            const isExpanded = expandedPayment === payment.id;

            return (
              <div
                key={payment.id}
                className="rounded-xl border-2 border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {/* Main card */}
                <button
                  type="button"
                  onClick={() => setExpandedPayment(isExpanded ? null : payment.id)}
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Client and booking info */}
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold text-slate-900 truncate">
                            {payment.booking?.client.lastName} {payment.booking?.client.firstName}
                          </p>
                          <p className="text-sm text-slate-600 truncate">
                            {payment.booking?.client.email}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {payment.booking?.assignedRoom
                              ? `${payment.booking.assignedRoom.roomTypeName} #${payment.booking.assignedRoom.roomNumber}`
                              : payment.booking?.roomTypeName
                                ? `${payment.booking.roomTypeName} (${t("admin:payments.roomNotAssigned")})`
                                : t("admin:payments.noRoom")}
                          </p>
                        </div>
                      </div>

                      {/* Payment details */}
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusInfo.bgColor} ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-300 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          {paymentMethodMap[payment.paymentMethod]}
                        </span>
                        <span className="inline-flex items-center rounded-full bg-blue-100 border border-blue-300 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {paymentTypeMap[payment.paymentType]}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(payment.createdAt).toLocaleDateString("ru-RU")}{" "}
                          {new Date(payment.createdAt).toLocaleTimeString("ru-RU", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="flex items-start gap-3">
                      <div className="text-right">
                        <p className="text-xl font-bold text-slate-900">
                          {formatCurrency(payment.amount, i18n.language)}
                        </p>
                        {payment.prepaymentPercentage && (
                          <p className="text-xs text-slate-500">
                            {payment.prepaymentPercentage}% {t("admin:payments.prepayment")}
                          </p>
                        )}
                      </div>
                      <svg
                        className={`mt-1 h-5 w-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 mb-2">
                          {t("admin:payments.bookingInfo")}
                        </h4>
                        <dl className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-slate-600">
                              {t("admin:payments.checkInCheckOut")}
                            </dt>
                            <dd className="text-slate-900">
                              {new Date(payment.booking?.checkInDate || "").toLocaleDateString(
                                "ru-RU"
                              )}{" "}
                              -{" "}
                              {new Date(payment.booking?.checkOutDate || "").toLocaleDateString(
                                "ru-RU"
                              )}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt className="text-slate-600">{t("admin:payments.costOfStay")}</dt>
                            <dd className="font-semibold text-slate-900">
                              {formatCurrency(payment.booking?.totalPrice || 0, i18n.language)}
                            </dd>
                          </div>
                        </dl>
                      </div>

                      <div>
                        <h4 className="text-sm font-bold text-slate-900 mb-2">
                          {t("admin:payments.paymentDetails")}
                        </h4>
                        <dl className="space-y-1 text-sm">
                          <div className="flex justify-between">
                            <dt className="text-slate-600">{t("admin:payments.paymentId")}</dt>
                            <dd className="font-mono text-xs text-slate-900">
                              {payment.id.substring(0, 8)}...
                            </dd>
                          </div>
                          {payment.transactionId && (
                            <div className="flex justify-between">
                              <dt className="text-slate-600">
                                {t("admin:payments.transactionId")}
                              </dt>
                              <dd className="font-mono text-xs text-slate-900">
                                {payment.transactionId}
                              </dd>
                            </div>
                          )}
                          {payment.paidAt && (
                            <div className="flex justify-between">
                              <dt className="text-slate-600">{t("admin:payments.paid")}</dt>
                              <dd className="text-slate-900">
                                {new Date(payment.paidAt).toLocaleString("ru-RU")}
                              </dd>
                            </div>
                          )}
                          {payment.confirmedAt && (
                            <div className="flex justify-between">
                              <dt className="text-slate-600">{t("admin:payments.confirmed")}</dt>
                              <dd className="text-slate-900">
                                {new Date(payment.confirmedAt).toLocaleString("ru-RU")}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    </div>

                    {payment.adminComment && (
                      <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                        <p className="text-xs font-semibold text-amber-900 mb-1">
                          {t("admin:payments.adminComment")}
                        </p>
                        <p className="text-sm text-amber-800">{payment.adminComment}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 sm:px-6 py-4">
          <div className="text-xs sm:text-sm text-slate-600 text-center sm:text-left">
            <span className="hidden sm:inline">{t("admin:bookings.showing")} </span>
            <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span>-
            <span className="font-medium">
              {Math.min(currentPage * itemsPerPage, filteredPayments.length)}
            </span>
            <span className="hidden sm:inline"> {t("admin:bookings.ofTotal")} </span>
            <span className="inline sm:hidden">/</span>
            <span className="font-medium">{filteredPayments.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className={`${btn.base} ${btn.outline}`}
              aria-label="Previous page"
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
            <div className="hidden md:flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  if (totalPages <= 7) return true;
                  if (page === 1 || page === totalPages) return true;
                  if (page >= currentPage - 1 && page <= currentPage + 1) return true;
                  return false;
                })
                .map((page, index, pages) => (
                  <div key={page} className="flex items-center gap-1">
                    {index > 0 && pages[index - 1] !== page - 1 && (
                      <span className="px-1 text-slate-400">...</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(page)}
                      className={`h-8 min-w-[2rem] rounded-lg px-2 text-sm font-medium transition ${
                        page === currentPage
                          ? "bg-brand text-white shadow-sm"
                          : "border border-slate-200 bg-white text-slate-700 hover:border-brand hover:text-brand"
                      }`}
                    >
                      {page}
                    </button>
                  </div>
                ))}
            </div>
            <div className="flex md:hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5">
              <span className="text-sm font-medium text-slate-700">{currentPage}</span>
              <span className="text-slate-400">/</span>
              <span className="text-sm text-slate-500">{totalPages}</span>
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className={`${btn.base} ${btn.outline}`}
              aria-label="Next page"
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
        </div>
      )}
    </div>
  );
};

export default AdminPaymentsHistory;
