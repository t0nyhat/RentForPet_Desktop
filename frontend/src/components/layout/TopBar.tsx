import React from "react";
import { useZoom } from "../../context/ZoomContext";

interface TopBarProps {
  onMenuClick: () => void;
  sidebarCollapsed?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onMenuClick, sidebarCollapsed = false }) => {
  const { increaseScale, decreaseScale, scaleLabel, canDecrease, canIncrease } = useZoom();

  const buildTimeRaw = import.meta.env.VITE_BUILD_TIME;
  const buildTime =
    typeof buildTimeRaw === "string" && buildTimeRaw.trim().length > 0 ? buildTimeRaw : null;
  const buildTimeDisplay = buildTime
    ? new Date(buildTime).toLocaleString("ru-RU", { timeZone: "UTC" }) + " UTC"
    : null;

  return (
    <header
      className={`
        fixed top-0 right-0 h-16 bg-white border-b border-gray-200 z-30
        transition-all duration-300 flex items-center justify-between px-4 sm:px-6
        ${sidebarCollapsed ? "md:left-20" : "md:left-64"} left-0
      `}
    >
      {/* Mobile Menu Button - only visible on mobile */}
      <button
        onClick={onMenuClick}
        className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label="Open menu"
      >
        <span className="text-2xl">☰</span>
      </button>

      <div className="flex items-center gap-2 ml-auto">
        <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1">
          <button
            onClick={decreaseScale}
            disabled={!canDecrease}
            className="h-7 w-7 rounded-full border border-gray-300 bg-white text-sm font-bold text-gray-700 disabled:opacity-40"
            aria-label="Zoom out"
            title="Zoom out"
          >
            −
          </button>
          <span className="min-w-12 text-center text-xs font-semibold text-gray-700">
            {scaleLabel}
          </span>
          <button
            onClick={increaseScale}
            disabled={!canIncrease}
            className="h-7 w-7 rounded-full border border-gray-300 bg-white text-sm font-bold text-gray-700 disabled:opacity-40"
            aria-label="Zoom in"
            title="Zoom in"
          >
            +
          </button>
        </div>

        {/* Desktop: Build Info */}
        {buildTimeDisplay && (
          <span className="rounded-full bg-gray-100 px-3 py-1 border border-gray-200">
            Build: {buildTimeDisplay}
          </span>
        )}
      </div>
    </header>
  );
};

export default TopBar;
