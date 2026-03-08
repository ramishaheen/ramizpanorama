import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Newspaper, Clock, Zap } from "lucide-react";

interface Incident {
  id: string;
  title: string;
  severity: string;
  type: string;
  lat: number;
  lng: number;
  timestamp: string;
  source?: string;
}

interface LiveIncidentsOverlayProps {
  mapRef: React.MutableRefObject<any>;
  enabled: boolean;
  lat: number;
  lng: number;
}

export const LiveIncidentsOverlay = ({ mapRef, enabled, lat, lng }: LiveIncidentsOverlayProps) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const markersRef = useRef<any[]>([]);
  const pulseCirclesRef = useRef<any[]>([]);

  // Fetch live incidents from geo_alerts
  useEffect(() => {
    if (!enabled) return;
    const fetchIncidents = async () => {
      try {
        const { data, error } = await supabase
          .from("geo_alerts")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(50);
        if (!error && data) {
          setIncidents(data.map(d => ({
            id: d.id,
            title: d.title,
            severity: d.severity,
            type: d.type,
            lat: d.lat,
            lng: d.lng,
            timestamp: d.timestamp,
            source: d.source,
          })));
          setLastUpdate(new Date());
        }
      } catch (e) {
        console.error("Incident fetch error:", e);
      }
    };
    fetchIncidents();
    const iv = setInterval(fetchIncidents, 30_000); // 30s refresh
    return () => clearInterval(iv);
  }, [enabled]);

  // Render incident markers on map
  useEffect(() => {
    const map = mapRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps || !enabled) {
      markersRef.current.forEach(m => m.setMap(null));
      markersRef.current = [];
      pulseCirclesRef.current.forEach(c => c.setMap(null));
      pulseCirclesRef.current = [];
      return;
    }

    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    pulseCirclesRef.current.forEach(c => c.setMap(null));
    pulseCirclesRef.current = [];

    const sevColors: Record<string, string> = {
      critical: "#ef4444",
      high: "#f97316",
      medium: "#eab308",
      low: "#22c55e",
    };

    const typeEmojis: Record<string, string> = {
      MILITARY: "⚔️",
      DIPLOMATIC: "🏛️",
      ECONOMIC: "📊",
      HUMANITARIAN: "🏥",
    };

    incidents.forEach((inc) => {
      const color = sevColors[inc.severity] || "#eab308";
      const emoji = typeEmojis[inc.type] || "⚠️";
      const size = inc.severity === "critical" ? 36 : inc.severity === "high" ? 30 : 24;
      const isCritical = inc.severity === "critical";

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <defs>
          <filter id="ig${inc.id.slice(0,4)}"><feDropShadow dx="0" dy="0" stdDeviation="3" flood-color="${color}" flood-opacity="0.7"/></filter>
        </defs>
        ${isCritical ? `<circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="none" stroke="${color}" stroke-width="2" opacity="0.4">
          <animate attributeName="r" values="${size/2 - 4};${size/2};${size/2 - 4}" dur="1.5s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1.5s" repeatCount="indefinite"/>
        </circle>` : ""}
        <polygon points="${size/2},${size*0.1} ${size*0.85},${size*0.85} ${size*0.15},${size*0.85}" fill="${color}dd" stroke="${color}" stroke-width="1" filter="url(#ig${inc.id.slice(0,4)})"/>
        <text x="${size/2}" y="${size*0.65}" text-anchor="middle" font-size="${size*0.35}" fill="white" font-weight="bold">!</text>
      </svg>`;

      const marker = new google.maps.Marker({
        position: { lat: inc.lat, lng: inc.lng },
        map,
        icon: {
          url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
          scaledSize: new google.maps.Size(size, size),
          anchor: new google.maps.Point(size / 2, size / 2),
        },
        title: `${emoji} ${inc.title}`,
        zIndex: isCritical ? 200 : 100,
        optimized: false,
      });

      const timeAgo = getTimeAgo(inc.timestamp);
      const infoContent = `
        <div style="background:#0d1117;color:#e6edf3;padding:12px 16px;border-radius:10px;font-family:'JetBrains Mono',monospace;font-size:10px;min-width:260px;max-width:320px;border:1px solid ${color}60;box-shadow:0 0 30px ${color}20,0 8px 32px rgba(0,0,0,0.6);">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;">
            <span style="font-size:16px;">${emoji}</span>
            <span style="font-weight:700;font-size:12px;color:${color};flex:1;">${inc.title}</span>
          </div>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:10px;">
            <span style="color:#7d8590;">TYPE</span><span style="color:${color};font-weight:600;text-transform:uppercase;">${inc.type}</span>
            <span style="color:#7d8590;">SEVERITY</span><span style="color:${color};font-weight:700;text-transform:uppercase;">${inc.severity}</span>
            <span style="color:#7d8590;">TIME</span><span>${timeAgo}</span>
            ${inc.source ? `<span style="color:#7d8590;">SOURCE</span><span>${inc.source}</span>` : ""}
            <span style="color:#7d8590;">COORDS</span><span>${inc.lat.toFixed(4)}°N, ${inc.lng.toFixed(4)}°E</span>
          </div>
        </div>
      `;
      const infoWindow = new google.maps.InfoWindow({ content: infoContent });
      marker.addListener("mouseover", () => infoWindow.open(map, marker));
      marker.addListener("mouseout", () => infoWindow.close());

      markersRef.current.push(marker);

      // Add threat radius circle for critical incidents
      if (isCritical) {
        const circle = new google.maps.Circle({
          center: { lat: inc.lat, lng: inc.lng },
          radius: 25000, // 25km
          map,
          fillColor: color,
          fillOpacity: 0.05,
          strokeColor: color,
          strokeOpacity: 0.3,
          strokeWeight: 1,
        });
        pulseCirclesRef.current.push(circle);
      }
    });

    return () => {
      markersRef.current.forEach(m => m.setMap(null));
      pulseCirclesRef.current.forEach(c => c.setMap(null));
    };
  }, [incidents, enabled, mapRef]);

  if (!enabled) return null;

  return (
    <div className="absolute bottom-4 left-3 z-[14] pointer-events-auto">
      <div className="bg-black/85 backdrop-blur-xl border border-primary/25 rounded-lg p-2 w-48" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
        <div className="flex items-center gap-1.5 mb-1.5">
          <AlertTriangle className="h-3 w-3 text-amber-400" />
          <span className="text-[9px] font-mono font-bold text-amber-400 uppercase">Live Incidents</span>
          <span className="ml-auto text-[8px] font-mono text-muted-foreground">{incidents.length}</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          {["critical", "high", "medium", "low"].map(sev => {
            const count = incidents.filter(i => i.severity === sev).length;
            const colors: Record<string, string> = { critical: "#ef4444", high: "#f97316", medium: "#eab308", low: "#22c55e" };
            return count > 0 ? (
              <span key={sev} className="text-[7px] font-mono font-bold px-1 rounded" style={{ background: `${colors[sev]}20`, color: colors[sev] }}>
                {count} {sev.charAt(0).toUpperCase()}
              </span>
            ) : null;
          })}
        </div>
        <div className="flex items-center gap-1 text-[7px] font-mono text-muted-foreground/50">
          <Clock className="h-2 w-2" />
          <span>Updated {getTimeAgo(lastUpdate.toISOString())}</span>
          <Zap className="h-2 w-2 text-primary ml-auto" />
          <span className="text-primary">30s</span>
        </div>
      </div>
    </div>
  );
};

function getTimeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
