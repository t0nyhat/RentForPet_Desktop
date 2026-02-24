import React from "react";
import { useTranslation } from "react-i18next";
import Modal from "./Modal";
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

type AlertType = "info" | "success" | "warning" | "error";

type AlertModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: AlertType;
};

const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  onClose,
  title,
  message,
  type = "info",
}) => {
  const { t } = useTranslation("common");

  const typeConfig = {
    info: {
      icon: InformationCircleIcon,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-50",
      borderColor: "border-blue-200",
      textColor: "text-blue-900",
      buttonColor: "bg-blue-600 hover:bg-blue-700",
    },
    success: {
      icon: CheckCircleIcon,
      iconColor: "text-emerald-600",
      bgColor: "bg-emerald-50",
      borderColor: "border-emerald-200",
      textColor: "text-emerald-900",
      buttonColor: "bg-emerald-600 hover:bg-emerald-700",
    },
    warning: {
      icon: ExclamationTriangleIcon,
      iconColor: "text-amber-600",
      bgColor: "bg-amber-50",
      borderColor: "border-amber-200",
      textColor: "text-amber-900",
      buttonColor: "bg-amber-600 hover:bg-amber-700",
    },
    error: {
      icon: XCircleIcon,
      iconColor: "text-rose-600",
      bgColor: "bg-rose-50",
      borderColor: "border-rose-200",
      textColor: "text-rose-900",
      buttonColor: "bg-rose-600 hover:bg-rose-700",
    },
  };

  const config = typeConfig[type];
  const Icon = config.icon;
  const defaultTitle =
    type === "info"
      ? t("messages.info")
      : type === "success"
        ? t("messages.success")
        : type === "warning"
          ? t("messages.warning")
          : t("messages.error");

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || defaultTitle} size="sm">
      <div className="space-y-4">
        <div
          className={`flex items-start gap-3 rounded-lg border ${config.borderColor} ${config.bgColor} p-4`}
        >
          <Icon className={`h-6 w-6 flex-shrink-0 ${config.iconColor}`} />
          <p className={`flex-1 text-sm ${config.textColor}`}>{message}</p>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${config.buttonColor}`}
          >
            OK
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default AlertModal;
