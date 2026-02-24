import React, { useState, useCallback, useMemo } from "react";
import { Sidebar, SidebarGroup, SidebarItem } from "./Sidebar";
import { TopBar } from "./TopBar";
import { BottomNavigation } from "./BottomNavigation";

interface LayoutProps {
  sidebarGroups: SidebarGroup[];
  children: React.ReactNode;
  showBottomNav?: boolean; // Show bottom nav (for clients only)
  noPadding?: boolean; // Remove padding for fullscreen components (schedule)
}

export const Layout: React.FC<LayoutProps> = React.memo(
  ({ sidebarGroups, children, showBottomNav = false, noPadding = false }) => {
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const handleToggleSidebar = useCallback(() => {
      setSidebarCollapsed((prev) => !prev);
    }, []);

    const handleMobileMenuClose = useCallback(() => {
      setMobileMenuOpen(false);
    }, []);

    const handleMobileMenuOpen = useCallback(() => {
      setMobileMenuOpen(true);
    }, []);

    const mainClassName = useMemo(
      () =>
        `pt-16 min-h-screen transition-all duration-300 w-full ${
          sidebarCollapsed ? "md:pl-20" : "md:pl-64"
        } ${showBottomNav ? "pb-20 md:pb-0" : "pb-0"}`,
      [sidebarCollapsed, showBottomNav]
    );

    // Extract items for bottom navigation (mobile only)
    const bottomNavItems = useMemo(() => {
      const allItems: SidebarItem[] = [];
      sidebarGroups.forEach((group) => {
        group.items.forEach((item) => {
          allItems.push(item);
        });
      });
      return allItems;
    }, [sidebarGroups]);

    return (
      <div className="min-h-screen bg-gray-50">
        {/* Sidebar - always accessible via mobile menu button ☰ */}
        <Sidebar
          groups={sidebarGroups}
          collapsed={sidebarCollapsed}
          onToggle={handleToggleSidebar}
          mobileOpen={mobileMenuOpen}
          onMobileClose={handleMobileMenuClose}
        />

        <TopBar onMenuClick={handleMobileMenuOpen} sidebarCollapsed={sidebarCollapsed} />

        <main className={mainClassName}>
          {noPadding ? <>{children}</> : <div className="p-4 sm:p-6 mx-auto">{children}</div>}
        </main>

        {/* Mobile Bottom Navigation - for clients on mobile only */}
        {showBottomNav && <BottomNavigation items={bottomNavItems} />}
      </div>
    );
  }
);

Layout.displayName = "Layout";
