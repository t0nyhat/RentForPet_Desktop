type ProgressBarProps = {
  progress: number; // 0-100
  label?: string;
  showPercentage?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "success" | "warning" | "error";
};

const ProgressBar = ({
  progress,
  label,
  showPercentage = true,
  size = "md",
  variant = "default",
}: ProgressBarProps) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  const sizeClasses = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  const variantClasses = {
    default: "bg-brand",
    success: "bg-emerald-600",
    warning: "bg-amber-600",
    error: "bg-red-600",
  };

  return (
    <div className="w-full">
      {(label || showPercentage) && (
        <div className="mb-1 flex items-center justify-between text-sm">
          {label && <span className="text-gray-700">{label}</span>}
          {showPercentage && (
            <span className="font-semibold text-gray-900">{Math.round(clampedProgress)}%</span>
          )}
        </div>
      )}
      <div className={`w-full overflow-hidden rounded-full bg-gray-200 ${sizeClasses[size]}`}>
        <div
          className={`${sizeClasses[size]} transition-all duration-300 ease-out ${variantClasses[variant]}`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;
