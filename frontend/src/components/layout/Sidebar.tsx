import React from "react";
import { Link, useLocation } from "react-router-dom";
import LanguageSwitcher from "../LanguageSwitcher";

export interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path?: string;
  badge?: number;
  onClick?: () => void;
  items?: SidebarItem[];
}

export interface SidebarGroup {
  label?: string;
  items: SidebarItem[];
}

interface SidebarProps {
  groups: SidebarGroup[];
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  groups,
  collapsed,
  onToggle,
  mobileOpen,
  onMobileClose,
}) => {
  const location = useLocation();

  const isActive = (item: SidebarItem, currentPath: string): boolean => {
    if (item.path === currentPath) return true;
    if (item.items?.some((subItem) => subItem.path === currentPath)) return true;
    return false;
  };

  const renderItem = (item: SidebarItem, isSubItem = false) => {
    const active = isActive(item, location.pathname);
    const hasSubItems = item.items && item.items.length > 0;

    const content = (
      <div
        className={`
          flex items-center justify-between px-4 py-2 rounded-xl transition-all duration-200
          ${
            active
              ? "bg-brand text-white shadow-lg shadow-brand/30"
              : "text-gray-700 hover:bg-gray-100"
          }
          ${isSubItem ? "ml-6 text-sm" : ""}
          ${collapsed && !isSubItem ? "justify-center px-2" : ""}
        `}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`flex-shrink-0 ${collapsed && !isSubItem ? "md:text-xl text-lg" : "text-lg"}`}
          >
            {item.icon}
          </span>
          {/* On mobile always show text, on desktop depends on collapsed */}
          <span
            className={`font-medium leading-tight break-words whitespace-normal text-xs sm:text-sm ${collapsed && !isSubItem ? "md:hidden" : ""}`}
          >
            {item.label}
          </span>
        </div>
        {!collapsed && item.badge !== undefined && item.badge > 0 && (
          <span className="ml-2 px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full flex-shrink-0">
            {item.badge}
          </span>
        )}
      </div>
    );

    if (item.path) {
      return (
        <Link
          key={item.id}
          to={item.path}
          onClick={() => {
            onMobileClose();
            item.onClick?.();
          }}
          className="block"
        >
          {content}
        </Link>
      );
    }

    if (item.onClick) {
      return (
        <button
          key={item.id}
          onClick={() => {
            onMobileClose();
            item.onClick?.();
          }}
          className="block w-full text-left"
        >
          {content}
        </button>
      );
    }

    return (
      <div key={item.id} className="block">
        {content}
        {hasSubItems && !collapsed && (
          <div className="mt-1 space-y-1">
            {item.items!.map((subItem) => renderItem(subItem, true))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 h-full bg-white border-r border-gray-200
          transition-all duration-300 ease-in-out flex flex-col
          ${
            // On mobile: show/hide via transform
            mobileOpen ? "left-0 z-50" : "-left-full z-50"
          }
          md:left-0 md:z-50
          ${collapsed ? "md:w-20" : "md:w-64"}
          w-64
        `}
      >
        {/* Logo Header */}
        <div className="h-16 flex items-center justify-center px-4 border-b border-gray-200 flex-shrink-0">
          {/* Close button for mobile */}
          <button
            onClick={onMobileClose}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title="Close menu"
          >
            <span className="text-xl">✕</span>
          </button>
          {/* Toggle collapse button for desktop */}
          <button
            onClick={onToggle}
            className="hidden md:block p-2 rounded-lg hover:bg-gray-100 transition-colors"
            title={collapsed ? "Expand menu" : "Collapse menu"}
          >
            <span className="text-xl">{collapsed ? "→" : "←"}</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-4">
          {groups.map((group, groupIndex) => (
            <div key={groupIndex}>
              {group.label && !collapsed && (
                <h3 className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {group.label}
                </h3>
              )}
              <div className="space-y-1">{group.items.map((item) => renderItem(item))}</div>
            </div>
          ))}
        </nav>

        {/* Language Switcher */}
        <div className={`border-t border-gray-200 ${collapsed ? "p-2" : "p-4"}`}>
          <LanguageSwitcher collapsed={collapsed} />
        </div>
      </aside>
    </>
  );
};
