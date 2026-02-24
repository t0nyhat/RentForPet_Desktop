import React from "react";
import { Link, useLocation } from "react-router-dom";
import { SidebarItem } from "./Sidebar";

interface BottomNavigationProps {
  items: SidebarItem[];
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({ items }) => {
  const location = useLocation();

  const isActive = (item: SidebarItem, currentPath: string): boolean => {
    if (item.path === currentPath) return true;
    return false;
  };

  // Filter out items with subitems and take only top-level items suitable for bottom nav
  const navigationItems = items.slice(0, 5); // Limit to 5 items for bottom nav

  return (
    <nav
      className={`
        fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 md:hidden
        flex justify-around items-center h-16 px-2
      `}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {navigationItems.map((item) => {
        const active = isActive(item, location.pathname);

        const itemContent = (
          <>
            <span className="flex items-center justify-center">{item.icon}</span>
            {item.badge !== undefined && item.badge > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center text-xs font-bold bg-red-500 text-white rounded-full">
                {item.badge}
              </span>
            )}
          </>
        );

        if (item.path) {
          return (
            <Link
              key={item.id}
              to={item.path}
              className={`
                flex flex-col items-center justify-center flex-1 h-full relative
                transition-colors duration-200
                ${active ? "text-brand" : "text-gray-600 hover:text-gray-900"}
              `}
            >
              {itemContent}
            </Link>
          );
        }

        if (item.onClick) {
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={`
                flex flex-col items-center justify-center flex-1 h-full relative
                transition-colors duration-200
                ${active ? "text-brand" : "text-gray-600 hover:text-gray-900"}
              `}
            >
              {itemContent}
            </button>
          );
        }

        return null;
      })}
    </nav>
  );
};
