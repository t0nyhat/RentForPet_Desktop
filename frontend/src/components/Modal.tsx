import React, { ReactNode, useEffect, useRef, useCallback, useMemo } from "react";

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  showCloseButton?: boolean;
  zIndex?: number;
};

/**
 * Universal modal component
 *
 * @example
 * <Modal isOpen={isOpen} onClose={handleClose} title="Add client" size="md">
 *   <form>...</form>
 * </Modal>
 */
export const Modal = React.memo(
  ({
    isOpen,
    onClose,
    title,
    children,
    size = "md",
    showCloseButton = true,
    zIndex = 50,
  }: ModalProps) => {
    const modalRef = useRef<HTMLDivElement>(null);

    // ALL hooks must be called BEFORE conditional return
    const sizeClasses = useMemo(
      () => ({
        sm: "max-w-md",
        md: "max-w-lg",
        lg: "max-w-2xl",
        xl: "max-w-4xl",
        "2xl": "max-w-6xl",
        full: "max-w-7xl",
      }),
      []
    );

    const handleBackdropClick = useCallback(
      (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      },
      [onClose]
    );

    // Handle Escape key
    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape" && isOpen) {
          onClose();
        }
      };

      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose]);

    // Lock body scroll when modal is open
    useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = "hidden";
      } else {
        document.body.style.overflow = "unset";
      }
      return () => {
        document.body.style.overflow = "unset";
      };
    }, [isOpen]);

    // Conditional return AFTER all hooks
    if (!isOpen) return null;

    return (
      <div
        className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        style={{ zIndex }}
        onClick={handleBackdropClick}
      >
        <div
          ref={modalRef}
          className={`relative w-full ${sizeClasses[size]} bg-white rounded-3xl shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-4 duration-200`}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-8 pt-8 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base md:text-2xl font-bold text-slate-900">{title}</h2>
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="flex-shrink-0 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

          {/* Content */}
          <div className="px-8 py-6 max-h-[calc(100vh-12rem)] overflow-y-auto">{children}</div>
        </div>
      </div>
    );
  }
);

Modal.displayName = "Modal";

export default Modal;
