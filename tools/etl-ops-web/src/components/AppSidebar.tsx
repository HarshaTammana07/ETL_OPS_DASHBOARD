import { NavLink } from "react-router-dom";
import clsx from "clsx";

export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  icon: React.ReactNode;
}

interface AppSidebarProps {
  items: NavItem[];
  collapsed: boolean;
}

function NavIcon({ children }: { children: React.ReactNode }) {
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">{children}</span>;
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: "/",
    label: "Home",
    end: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10.5Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/trends",
    label: "Trends",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M4 19V5M4 19h16M8 17V11M12 17V7M16 17v-4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: "/alerts",
    label: "Alerts",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5M10 21a2 2 0 0 0 4 0" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/pipelines",
    label: "Pipelines",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M4 6h6v4H4V6ZM14 6h6v4h-6V6ZM4 14h6v4H4v-4ZM14 14h6v4h-6v-4Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/failures",
    label: "Site Failures",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v5M12 16h.01" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: "/data-quality",
    label: "Data Quality",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M9 12l2 2 4-4M12 3l8 4v6c0 4.4-3.6 8-8 8s-8-3.6-8-8V7l8-4Z" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    to: "/runs",
    label: "Run Explorer",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: "/chat",
    label: "Chat",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
        <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H8l-4 4V6a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export function AppSidebar({ items, collapsed }: AppSidebarProps) {
  return (
    <aside
      className={clsx(
        "flex h-full shrink-0 flex-col border-r border-slate-800 bg-slate-900 transition-[width] duration-200 ease-in-out",
        collapsed ? "w-[4.25rem]" : "w-56",
      )}
    >
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-x-hidden overflow-y-auto p-2 pt-3">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={collapsed ? item.label : undefined}
            className={({ isActive }) =>
              clsx(
                "group relative flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition",
                collapsed && "justify-center px-2",
                isActive
                  ? "bg-sky-950/60 text-sky-100"
                  : "text-slate-400 hover:bg-slate-800/80 hover:text-slate-200",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-sky-500" />
                )}
                <NavIcon>{item.icon}</NavIcon>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
