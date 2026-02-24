import { useTranslation } from "react-i18next";
import Modal from "./Modal";

export type ReceiptDto = {
  bookingId: string;
  bookingNumber: string;
  checkInDate: string;
  checkOutDate: string;
  numberOfNights: number;
  roomTypeName: string;
  discountPercent: number;
  discountAmount: number;
  subtotal: number;
  total: number;
  paid: number;
  remaining: number;
  refundDue: number;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  pets: Array<{ id: string; name: string; species: number; gender: number }>;
  lines: Array<{ title: string; details?: string | null; amount: number }>;
  payments: Array<{
    id: string;
    amount: number;
    paymentMethod: number;
    paymentStatus: number;
    paymentType: number;
    createdAt: string;
    paidAt?: string | null;
    transactionId?: string | null;
  }>;
};

type ReceiptModalProps = {
  isOpen: boolean;
  onClose: () => void;
  receipt: ReceiptDto | null;
  loading?: boolean;
  error?: string | null;
  zIndex?: number;
};

const ReceiptModal = ({
  isOpen,
  onClose,
  receipt,
  loading,
  error,
  zIndex = 50,
}: ReceiptModalProps) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? "ru-RU" : "en-US";
  const currency = i18n.language === "ru" ? "₽" : "$";
  const printReceipt = () => window.print();

  const getPaymentMethodLabel = (method: number): string => {
    const labels: Record<number, string> = {
      0: t("admin:receiptModal.paymentMethods.unknown"),
      1: t("admin:receiptModal.paymentMethods.card"),
      2: t("admin:receiptModal.paymentMethods.cash"),
      3: t("admin:receiptModal.paymentMethods.online"),
    };
    return labels[method] || t("admin:receiptModal.method");
  };

  const getPaymentStatusLabel = (status: number): string => {
    const labels: Record<number, string> = {
      0: t("admin:receiptModal.paymentStatuses.pending"),
      1: t("admin:receiptModal.paymentStatuses.processing"),
      2: t("admin:receiptModal.paymentStatuses.paid"),
      3: t("admin:receiptModal.paymentStatuses.declined"),
    };
    return labels[status] || "—";
  };

  const getPaymentTypeLabel = (type: number): string => {
    if (type === 0) return t("admin:receiptModal.unknown");
    if (type === 1) return t("admin:receiptModal.prepayment");
    return t("admin:receiptModal.fullPayment");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("admin:receiptModal.title")}
      size="lg"
      zIndex={zIndex}
    >
      <div className="space-y-4 text-sm">
        {loading && <p className="text-slate-500">{t("admin:receiptModal.loading")}</p>}
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-rose-600">{error}</p>}
        {receipt && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {t("admin:receiptModal.booking")}
                </p>
                <p className="text-xs text-slate-500">{receipt.roomTypeName}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {t("admin:receiptModal.period")}
                </p>
                <p className="font-semibold text-slate-900">
                  {new Date(receipt.checkInDate).toLocaleDateString(locale)} —{" "}
                  {new Date(receipt.checkOutDate).toLocaleDateString(locale)}
                </p>
                <p className="text-xs text-slate-500">
                  {receipt.numberOfNights} {t("admin:receiptModal.nights")}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-2">
                {receipt.lines.map((line) => (
                  <div className="flex items-start justify-between text-sm" key={line.title}>
                    <div className="text-slate-700">
                      <span className="font-medium">{line.title}</span>
                      {line.details && (
                        <span className="ml-2 text-xs text-slate-500">{line.details}</span>
                      )}
                    </div>
                    <span
                      className={`font-semibold ${line.amount < 0 ? "text-emerald-700" : "text-slate-900"}`}
                    >
                      {line.amount.toLocaleString(locale)} {currency}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm">
                  <span className="font-semibold text-slate-900">
                    {t("admin:receiptModal.total")}
                  </span>
                  <span className="text-lg font-bold text-slate-900">
                    {receipt.total.toLocaleString(locale)} {currency}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{t("admin:receiptModal.paid")}</span>
                  <span className="font-semibold text-emerald-700">
                    {receipt.paid.toLocaleString(locale)} {currency}
                  </span>
                </div>
                {receipt.remaining > 0 && (
                  <div className="flex items-center justify-between text-xs text-orange-600">
                    <span>{t("admin:receiptModal.toPay")}</span>
                    <span className="font-semibold">
                      {receipt.remaining.toLocaleString(locale)} {currency}
                    </span>
                  </div>
                )}
                {receipt.refundDue > 0 && (
                  <div className="flex items-center justify-between text-xs text-rose-600">
                    <span>{t("admin:receiptModal.toRefund")}</span>
                    <span className="font-semibold">
                      {receipt.refundDue.toLocaleString(locale)} {currency}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-900">
                  {t("admin:receiptModal.payments")}
                </p>
                <p className="text-xs text-slate-500">
                  {t("admin:receiptModal.totalCount")} {receipt.payments.length}
                </p>
              </div>
              {receipt.payments.length === 0 ? (
                <p className="text-xs text-slate-500">{t("admin:receiptModal.noPayments")}</p>
              ) : (
                <div className="space-y-2">
                  {receipt.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <div>
                        <p className="text-xs text-slate-500">
                          {new Date(payment.createdAt).toLocaleString(locale)}
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {payment.amount.toLocaleString(locale)} {currency} •{" "}
                          {getPaymentStatusLabel(payment.paymentStatus)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {getPaymentMethodLabel(payment.paymentMethod)} ·{" "}
                          {getPaymentTypeLabel(payment.paymentType)}
                        </p>
                      </div>
                      {payment.transactionId && (
                        <p className="text-[11px] text-slate-500">TX: {payment.transactionId}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-brand hover:text-brand"
              >
                {t("admin:receiptModal.close")}
              </button>
              <button
                type="button"
                onClick={printReceipt}
                className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
              >
                {t("admin:receiptModal.print")}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ReceiptModal;
