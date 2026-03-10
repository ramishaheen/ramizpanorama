import { ReactNode, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Shield, Map, Database, CheckSquare, Monitor, Route, Zap, AlertTriangle, List, Activity, Settings, LogOut, Menu, X, ChevronLeft } from "lucide-react";

const NAV_ITEMS = [
  { path: "/intel", label: "Global Map", icon: Map, roles: [] },
  { path: "/intel/sources", label: "Source Registry", icon: Database, roles: [] },
  { path: "/intel/review", label: "Review Queue", icon: CheckSquare, roles: ["admin", "analyst"] },
  { path: "/intel/monitor", label: "Monitor Wall", icon: Monitor, roles: [] },
  { path: "/intel/traffic", label: "Traffic Layer", icon: Route, roles: [] },
  { path: "/intel/events", label: "Events Feed", icon: Zap, roles: [] },
  { path: "/intel/incidents", label: "Incidents", icon: AlertTriangle, roles: ["admin", "analyst"] },
  { path: "/intel/watchlists", label: "Watchlists", icon: List, roles: [] },
  { path: "/intel/health", label: "Source Health", icon: Activity, roles: ["admin", "analyst"] },
  { path: "/intel/connectors", label: "Connectors", icon: Settings, roles: ["admin"] },
];

export function IntelLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { user, roles, signOut, isAdmin } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleNav = NAV_ITEMS.filter(item => {
    if (item.roles.length === 0) return true;
    return item.roles.some(r => roles.includes(r as any));
  });

  const sidebar = (
    <div className={`flex flex-col h-full bg-card border-r border-border transition-all ${collapsed ? "w-14" : "w-56"}`}>
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <Link to="/" className="flex items-center gap-2 min-w-0">
          <Shield className="h-5 w-5 text-primary flex-shrink-0" />
          {!collapsed && <span className="text-sm font-bold font-mono text-foreground truncate">SENTINEL</span>}
        </Link>
        <button onClick={() => setCollapsed(!collapsed)} className="ml-auto text-muted-foreground hover:text-foreground hidden md:block">
          <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {visibleNav.map(item => {
          const Icon = item.icon;
          const active = pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2.5 px-2.5 py-2 rounded-md text-xs font-mono uppercase tracking-wider transition-colors ${
                active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
              }`}
              title={item.label}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-2">
        {!collapsed && (
          <div className="text-[10px] text-muted-foreground font-mono px-2 mb-1 truncate">
            {user?.email} · {roles.join(", ")}
          </div>
        )}
        <div className="flex gap-1">
          <Link to="/" className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 font-mono" title="Dashboard">
            <Map className="h-3.5 w-3.5" />
            {!collapsed && <span>Dashboard</span>}
          </Link>
          <button onClick={signOut} className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-mono" title="Sign Out">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile hamburger */}
      <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden fixed top-3 left-3 z-50 bg-card border border-border rounded-md p-1.5 shadow-lg">
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && <div className="md:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <div className={`fixed md:relative z-40 h-full ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} transition-transform`}>
        {sidebar}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden flex flex-col min-w-0">
        {children}
      </div>
    </div>
  );
}
