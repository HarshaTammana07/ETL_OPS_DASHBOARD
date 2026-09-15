import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar, NAV_ITEMS } from "./AppSidebar";
import { AppLogo } from "./AppLogo";
import { GlobalFilterBar } from "./GlobalFilterBar";
import { useEffectiveFilters } from "../hooks/useEffectiveFilters";
import { useGlobalFilters } from "../hooks/useGlobalFilters";
import type { FilterContext } from "../hooks/useFilterContext";

const SIDEBAR_KEY = "etl-ops-sidebar-collapsed";

function pageTitle(pathname: string): string {
  if (pathname === "/") return "Home";
  const match = NAV_ITEMS.find((item) => item.to !== "/" && pathname.startsWith(item.to));
  return match?.label ?? "ETL Operations";
}

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

export function AppLayout() {
  const { filters, setFilters } = useGlobalFilters();
  const effectiveFilters = useEffectiveFilters(filters);
  const location = useLocation();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed));
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  const title = pageTitle(location.pathname);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <AppSidebar items={NAV_ITEMS} collapsed={sidebarCollapsed} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="z-30 flex h-14 shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-900/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            onClick={() => setSidebarCollapsed((v) => !v)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <HamburgerIcon />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <AppLogo variant="full" />
            <div className="min-w-0 hidden md:block">
              <h1 className="truncate text-sm font-semibold text-slate-100">ETL Operations Center</h1>
              <p className="truncate text-[11px] text-slate-500">Fabric pipeline health & audit</p>
            </div>
          </div>

          <div className="ml-auto text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto space-y-4 px-4 py-5 sm:px-6 lg:px-8">
          <GlobalFilterBar filters={filters} setFilters={setFilters} />
          <Outlet context={{ filters: effectiveFilters, setFilters } satisfies FilterContext} />
        </main>
      </div>
    </div>
  );
}
