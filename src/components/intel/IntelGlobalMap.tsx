import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { supabase } from "@/integrations/supabase/client";
import { useMapSync } from "@/hooks/useMapSync";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Layers, RefreshCw, Maximize2, Minimize2, Map as MapIcon } from "lucide-react";

type TilePreset = "carto-dark" | "osm" | "yandex-sat" | "yandex-map";

const TILE_PRESETS: Record<TilePreset, { url: string; attr: string; label: string; needsKey?: boolean }> = {
  "carto-dark": {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attr: '&copy; <a href="https://carto.com/">CARTO</a>',
    label: "CARTO Dark",
  },
  osm: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attr: '&copy; <a href="https://openstreetmap.org">OSM</a>',
    label: "OSM",
  },
  "yandex-sat": {
    url: "https://sat0{s}.maps.yandex.net/tiles?l=sat&x={x}&y={y}&z={z}&lang=en_US",
    attr: '&copy; <a href="https://yandex.com/maps">Yandex</a>',
    label: "Yandex Sat",
    needsKey: true,
  },
  "yandex-map": {
    url: "https://vec0{s}.maps.yandex.net/tiles?l=map&x={x}&y={y}&z={z}&lang=en_US",
    attr: '&copy; <a href="https://yandex.com/maps">Yandex</a>',
    label: "Yandex Map",
    needsKey: true,
  },
};

const SEV_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  info: "#6b7280",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#3b82f6",
  routine: "#6b7280",
};

function makeIcon(emoji: string, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;background:${color}22;border:2px solid ${color};font-size:14px;box-shadow:0 0 6px ${color}88;">${emoji}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
}

function popupHtml(title: string, rows: [string, string][]) {
  const body = rows.map(([k, v]) => `<div class="flex justify-between gap-3"><span style="color:#9ca3af;font-size:10px;">${k}</span><span style="font-size:10px;color:#e5e7eb;">${v}</span></div>`).join("");
  return `<div style="min-width:180px;font-family:monospace;"><div style="font-weight:700;font-size:12px;color:#f3f4f6;margin-bottom:6px;">${title}</div>${body}</div>`;
}

type LayerKey = "events" | "alerts" | "targets";

interface LayerState {
  visible: boolean;
  count: number;
}

export function IntelGlobalMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clustersRef = useRef<Record<LayerKey, L.MarkerClusterGroup>>({} as any);
  const { highlightedCoords, selectedEvent } = useMapSync();
  const highlightRef = useRef<L.CircleMarker | null>(null);

  const [layers, setLayers] = useState<Record<LayerKey, LayerState>>({
    events: { visible: true, count: 0 },
    alerts: { visible: true, count: 0 },
    targets: { visible: true, count: 0 },
  });
  const [loading, setLoading] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTile, setActiveTile] = useState<TilePreset>("carto-dark");
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [yandexKey, setYandexKey] = useState<string | null>(null);

  // Fetch Yandex key once
  useEffect(() => {
    supabase.functions.invoke("yandex-tiles").then(({ data }) => {
      if (data?.apiKey) setYandexKey(data.apiKey);
    });
  }, []);

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const preset = TILE_PRESETS["carto-dark"];
    const map = L.map(containerRef.current, {
      center: [30, 35],
      zoom: 4,
      zoomControl: false,
      attributionControl: false,
    });
    const tl = L.tileLayer(preset.url, { attribution: preset.attr, maxZoom: 18, subdomains: "1234" }).addTo(map);
    tileLayerRef.current = tl;
    L.control.zoom({ position: "bottomright" }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    const keys: LayerKey[] = ["events", "alerts", "targets"];
    keys.forEach(k => {
      const cg = L.markerClusterGroup({
        maxClusterRadius: 45,
        spiderfyOnMaxZoom: true,
        iconCreateFunction: (cluster) => {
          const count = cluster.getChildCount();
          return L.divIcon({
            html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;background:hsl(var(--primary)/0.25);border:2px solid hsl(var(--primary));color:hsl(var(--primary-foreground));font-size:11px;font-weight:700;font-family:monospace;">${count}</div>`,
            className: "",
            iconSize: [32, 32],
          });
        },
      });
      map.addLayer(cg);
      clustersRef.current[k] = cg;
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    const [evRes, alRes, ttRes] = await Promise.all([
      supabase.from("intel_events").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("geo_alerts").select("*").order("timestamp", { ascending: false }).limit(500),
      supabase.from("target_tracks").select("*").order("detected_at", { ascending: false }).limit(500),
    ]);

    const map = mapRef.current;
    if (!map) { setLoading(false); return; }

    // Events
    const evCluster = clustersRef.current.events;
    evCluster.clearLayers();
    const events = evRes.data || [];
    events.forEach(ev => {
      const color = SEV_COLORS[ev.severity] || SEV_COLORS.info;
      const m = L.marker([ev.lat, ev.lng], { icon: makeIcon("📡", color) });
      m.bindPopup(popupHtml(ev.title, [
        ["Type", ev.event_type],
        ["Severity", ev.severity],
        ["Confidence", `${Math.round(ev.confidence * 100)}%`],
        ["Location", `${ev.lat.toFixed(4)}, ${ev.lng.toFixed(4)}`],
        ["Time", new Date(ev.created_at).toLocaleString()],
        ["Status", ev.verification_status],
      ]));
      evCluster.addLayer(m);
    });

    // Alerts
    const alCluster = clustersRef.current.alerts;
    alCluster.clearLayers();
    const alerts = alRes.data || [];
    alerts.forEach(al => {
      const color = SEV_COLORS[al.severity] || SEV_COLORS.info;
      const m = L.marker([al.lat, al.lng], { icon: makeIcon("⚠️", color) });
      m.bindPopup(popupHtml(al.title, [
        ["Type", al.type],
        ["Severity", al.severity],
        ["Region", al.region],
        ["Source", al.source],
        ["Time", new Date(al.timestamp).toLocaleString()],
      ]));
      alCluster.addLayer(m);
    });

    // Targets
    const ttCluster = clustersRef.current.targets;
    ttCluster.clearLayers();
    const targets = ttRes.data || [];
    targets.forEach(tt => {
      const color = PRIORITY_COLORS[tt.priority] || PRIORITY_COLORS.routine;
      const m = L.marker([tt.lat, tt.lng], { icon: makeIcon("🎯", color) });
      m.bindPopup(popupHtml(tt.track_id, [
        ["Classification", tt.classification],
        ["Priority", tt.priority],
        ["Confidence", `${Math.round(tt.confidence * 100)}%`],
        ["Sensor", tt.source_sensor],
        ["Status", tt.status],
        ["Detected", new Date(tt.detected_at).toLocaleString()],
      ]));
      ttCluster.addLayer(m);
    });

    setLayers({
      events: { visible: true, count: events.length },
      alerts: { visible: true, count: alerts.length },
      targets: { visible: true, count: targets.length },
    });
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh 30s
  useEffect(() => {
    const iv = setInterval(fetchData, 30000);
    return () => clearInterval(iv);
  }, [fetchData]);

  // Layer toggle
  const toggleLayer = (key: LayerKey) => {
    const map = mapRef.current;
    if (!map) return;
    const cg = clustersRef.current[key];
    const isVisible = map.hasLayer(cg);
    if (isVisible) { map.removeLayer(cg); } else { map.addLayer(cg); }
    setLayers(prev => ({ ...prev, [key]: { ...prev[key], visible: !isVisible } }));
  };

  // Highlight coords from MapSync
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (highlightRef.current) { map.removeLayer(highlightRef.current); highlightRef.current = null; }
    if (highlightedCoords) {
      const c = L.circleMarker([highlightedCoords.lat, highlightedCoords.lng], {
        radius: 18, color: "#22d3ee", weight: 2, fillColor: "#22d3ee", fillOpacity: 0.15,
      }).addTo(map);
      highlightRef.current = c;
      map.flyTo([highlightedCoords.lat, highlightedCoords.lng], 10, { duration: 0.8 });
    }
  }, [highlightedCoords]);

  // Fly to selected event
  useEffect(() => {
    if (selectedEvent && mapRef.current) {
      mapRef.current.flyTo([selectedEvent.lat, selectedEvent.lng], 12, { duration: 0.8 });
    }
  }, [selectedEvent]);

  // Switch tile layer
  const switchTile = (preset: TilePreset) => {
    const map = mapRef.current;
    if (!map) return;
    const config = TILE_PRESETS[preset];
    if (config.needsKey && !yandexKey) return;
    if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);
    const tl = L.tileLayer(config.url, { attribution: config.attr, maxZoom: 18, subdomains: "1234" }).addTo(map);
    tileLayerRef.current = tl;
    setActiveTile(preset);
  };

  // Fit all
  const fitAll = () => {
    const map = mapRef.current;
    if (!map) return;
    const bounds = L.latLngBounds([]);
    (["events", "alerts", "targets"] as LayerKey[]).forEach(k => {
      if (map.hasLayer(clustersRef.current[k])) {
        const b = clustersRef.current[k].getBounds();
        if (b.isValid()) bounds.extend(b);
      }
    });
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
  };

  const toggleFullscreen = () => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    if (!document.fullscreenElement) { el.requestFullscreen(); setIsFullscreen(true); }
    else { document.exitFullscreen(); setIsFullscreen(false); }
  };

  const totalCount = layers.events.count + layers.alerts.count + layers.targets.count;

  return (
    <div className="relative flex-1 h-full">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-[1000] flex items-center gap-2 px-3 py-2 bg-card/80 backdrop-blur border-b border-border">
        <h1 className="text-sm font-mono font-bold text-foreground tracking-wider">GLOBAL INTEL MAP</h1>
        <Badge variant="secondary" className="text-[10px] font-mono">{totalCount} markers</Badge>
        <div className="flex-1" />
        <Button size="sm" variant="ghost" onClick={fetchData} disabled={loading} className="h-7 w-7 p-0">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setPanelOpen(!panelOpen)} className="h-7 w-7 p-0">
          <Layers className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={toggleFullscreen} className="h-7 w-7 p-0">
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* Layer panel */}
      {panelOpen && (
        <div className="absolute top-12 right-3 z-[1000] bg-card/90 backdrop-blur border border-border rounded-lg p-3 space-y-2 min-w-[180px]">
          {/* Tile Presets */}
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Basemap</div>
          <div className="flex flex-wrap gap-1 mb-2">
            {(Object.entries(TILE_PRESETS) as [TilePreset, typeof TILE_PRESETS[TilePreset]][]).map(([key, preset]) => {
              const disabled = preset.needsKey && !yandexKey;
              return (
                <button
                  key={key}
                  disabled={disabled}
                  onClick={() => switchTile(key)}
                  className={`text-[8px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                    activeTile === key
                      ? "bg-primary/20 text-primary border-primary/40"
                      : disabled
                      ? "text-muted-foreground/40 border-border/40 cursor-not-allowed"
                      : "text-muted-foreground border-border hover:text-foreground hover:border-foreground/30"
                  }`}
                  title={disabled ? "Yandex API key not configured" : preset.label}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="border-t border-border pt-2" />
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Layers</div>
          {([
            { key: "events" as LayerKey, label: "Events", emoji: "📡" },
            { key: "alerts" as LayerKey, label: "Alerts", emoji: "⚠️" },
            { key: "targets" as LayerKey, label: "Targets", emoji: "🎯" },
          ]).map(({ key, label, emoji }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer text-xs font-mono text-foreground">
              <Checkbox checked={layers[key].visible} onCheckedChange={() => toggleLayer(key)} />
              <span>{emoji} {label}</span>
              <span className="ml-auto text-muted-foreground text-[10px]">{layers[key].count}</span>
            </label>
          ))}
          <Button size="sm" variant="outline" onClick={fitAll} className="w-full h-7 text-[10px] font-mono mt-1">
            FIT ALL
          </Button>
        </div>
      )}

      {/* Map */}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
