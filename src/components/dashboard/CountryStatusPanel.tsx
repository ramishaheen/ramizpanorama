import { useState } from "react";
import { Globe, Plane, Ship, Zap, AlertTriangle, Flame, Eye, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import type { GeoFusionData, CountryStatus } from "@/hooks/useGeoFusion";

interface CountryStatusPanelProps {
  data: GeoFusionData | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

const alertColors: Record<string, string> = {
  green: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  red: "bg-red-500/20 text-red-400 border-red-500/30",
};

const statusIcons: Record<string, string> = {
  normal: "✅",
  disrupted: "⚠️",
  closed: "🚫",
  congested: "🔶",
  partial_disruption: "⚠️",
  major_disruption: "🔴",
  clear: "☀️",
  hazy: "🌫️",
  obscured: "🌑",
};

const countryFlags: Record<string, string> = {
  Iran: "🇮🇷",
  Israel: "🇮🇱",
  Jordan: "🇯🇴",
  UAE: "🇦🇪",
  Bahrain: "🇧🇭",
  Kuwait: "🇰🇼",
  Qatar: "🇶🇦",
  Oman: "🇴🇲",
};

function StatusBadge({ status, label }: { status: string; label: string }) {
  const icon = statusIcons[status] || "ℹ️";
  const isNormal = status === "normal" || status === "clear" || status === "low";
  return (
    <div className={`flex items-center gap-1 text-[9px] font-mono ${isNormal ? "text-muted-foreground" : "text-warning"}`}>
      <span>{icon}</span>
      <span className="uppercase tracking-wider">{label}</span>
    </div>
  );
}

function CountryCard({ country, status }: { country: string; status: CountryStatus }) {
  const [expanded, setExpanded] = useState(false);
  const alertClass = alertColors[status.public_alert_level] || alertColors.green;

  return (
    <div
      className={`border rounded-md p-2 cursor-pointer transition-all hover:bg-secondary/30 ${alertClass}`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">{countryFlags[country] || "🏳️"}</span>
          <span className="text-xs font-semibold">{country}</span>
          {status.fire_hotspots > 0 && (
            <span className="flex items-center gap-0.5 text-[9px] text-orange-400">
              <Flame className="h-2.5 w-2.5" />
              {status.fire_hotspots}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <span className={`text-[8px] font-mono uppercase px-1 py-0.5 rounded ${alertClass}`}>
            {status.public_alert_level}
          </span>
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </div>
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-current/10 space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <StatusBadge status={status.visibility_status} label={`VIS: ${status.visibility_status}`} />
            <StatusBadge status={status.weather_risk} label={`WX: ${status.weather_risk}`} />
            <StatusBadge status={status.aviation_status} label={`AVI: ${status.aviation_status}`} />
            <StatusBadge status={status.shipping_status} label={`MAR: ${status.shipping_status}`} />
            <StatusBadge status={status.infrastructure_status} label={`INF: ${status.infrastructure_status}`} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{status.latest_summary}</p>
        </div>
      )}
    </div>
  );
}

export function CountryStatusPanel({ data, loading, error, onRefresh }: CountryStatusPanelProps) {
  if (loading && !data) {
    return (
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Geo Fusion Loading...</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 bg-secondary/30 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-card border border-border rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-xs text-destructive">Fusion Error</span>
          </div>
          <button onClick={onRefresh} className="text-xs text-primary hover:underline">Retry</button>
        </div>
        <p className="text-[10px] text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!data?.country_status) return null;

  const eventCount = data.events?.length || 0;

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Geospatial Fusion
          </span>
          {eventCount > 0 && (
            <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-mono">
              {eventCount} events
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          className="p-1 hover:bg-secondary/50 rounded transition-colors"
          title="Refresh fusion data"
        >
          <RefreshCw className={`h-3 w-3 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {data._cached && (
        <div className="text-[9px] text-yellow-500/70 font-mono mb-2">⚡ Cached data (rate limited)</div>
      )}

      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {Object.entries(data.country_status).map(([country, status]) => (
          <CountryCard key={country} country={country} status={status as CountryStatus} />
        ))}
      </div>

      {data.generated_at_utc && (
        <div className="mt-2 text-[8px] text-muted-foreground/50 font-mono text-right">
          Updated: {new Date(data.generated_at_utc).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
