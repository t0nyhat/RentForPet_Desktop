import React from "react";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";

type ConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "warning" | "info";
  zIndex?: number;
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  type = "warning",
  zIndex,
}) => {
  const { t } = useTranslation("common");

  const typeConfig = {
    danger: {
      iconColor: "text-rose-600",
      bgColor: "bg-rose-50",
      borderColor: "border-rose-200",
      textColor: "text-rose-900",
      buttonColor: "bg-rose-600 hover:bg-rose-700",
    },
    warning: {
      iconColor: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      textColor: "text-amber-900",
      buttonColor: "bg-amber-600 hover:bg-amber-700",
    },
    info: {
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      textColor: "text-blue-900",
      buttonColor: "bg-blue-600 hover:bg-blue-700",
    },
  };

  const config = typeConfig[type];
  const defaultTitle =
    type === "danger"
      ? t("messages.warning")
      : type === "warning"
        ? t("messages.warning")
        : t("messages.info");
  const defaultConfirmText = confirmText ?? t("buttons.confirm");
  const defaultCancelText = cancelText ?? t("buttons.cancel");

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || defaultTitle}
      size="sm"
      zIndex={zIndex}
    >
      <div className="space-y-4">
        <div
          className={`flex items-start gap-3 rounded-lg border ${config.borderColor} ${config.bgColor} p-4`}
        >
          <ExclamationTriangleIcon className={`h-6 w-6 flex-shrink-0 ${config.iconColor}`} />
          <p className={`flex-1 text-sm ${config.textColor}`}>{message}</p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            {defaultCancelText}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${config.buttonColor}`}
          >
            {defaultConfirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
