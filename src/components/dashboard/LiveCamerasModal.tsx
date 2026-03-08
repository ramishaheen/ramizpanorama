import { useState, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import {
  X, Search, Camera, MapPin, ExternalLink, RefreshCw, AlertTriangle,
  Video, Eye, Sparkles, Globe, Copy, Activity, Radio, Signal,
  Shield, ChevronLeft, ChevronRight, Crosshair, Wifi, WifiOff,
  Layers, Flag, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// ═══════════════ TYPES ═══════════════
interface CameraData {
  id: string; name: string; country: string; city: string;
  category: string; source_type: string; source_name: string;
  stream_url: string | null; snapshot_url: string | null;
  embed_url: string | null; thumbnail_url: string | null;
  lat: number; lng: number; is_active: boolean; status: string;
  error_message: string | null; last_checked_at?: string;
}

interface LiveCamerasModalProps {
  onClose: () => void;
  onShowOnMap?: (lat: number, lng: number, name: string) => void;
}

interface Stats {
  total: number; online: number; offline: number; unknown: number;
  byCountry: Record<string, { total: number; online: number }>;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  byContinent: Record<string, number>;
}

// ═══════════════ CONSTANTS ═══════════════
const REGIONS: Record<string, { center: [number, number]; zoom: number }> = {
  "GLOBAL": { center: [20, 0], zoom: 2 },
  "MIDDLE EAST": { center: [28, 45], zoom: 5 },
  "EUROPE": { center: [50, 10], zoom: 4 },
  "N. AMERICA": { center: [40, -95], zoom: 4 },
  "ASIA": { center: [35, 105], zoom: 4 },
  "AFRICA": { center: [5, 20], zoom: 4 },
  "S. AMERICA": { center: [-15, -55], zoom: 4 },
};

const CATEGORIES = ["traffic", "tourism", "ports", "weather", "public"];
const SOURCES = ["EarthCam", "SkylineWebcams", "WebCamera24", "OpenWebcamDB", "Insecam", "Opentopia", "GeoCam"];

// ═══════════════ MAP HELPERS ═══════════════
function MapEventHandler({ onMoveEnd }: { onMoveEnd: (bounds: any) => void }) {
  useMapEvents({
    moveend: (e) => {
      const map = e.target;
      const b = map.getBounds();
      onMoveEnd({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest(), zoom: map.getZoom() });
    },
  });
  return null;
}

function FlyToHandler({ target }: { target: { center: [number, number]; zoom: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target.center, target.zoom, { duration: 1.5 });
  }, [target, map]);
  return null;
}

// ═══════════════ FEED VIEWER ═══════════════
function FeedViewer({ cam }: { cam: CameraData }) {
  const [error, setError] = useState(false);

  if (cam.source_type === "embed_page" && cam.embed_url && !error) {
    const isYouTube = cam.embed_url.includes("youtube.com/embed");
    return (
      <iframe
        src={cam.embed_url}
        className="w-full h-full"
        allow="autoplay; fullscreen; encrypted-media; accelerometer; gyroscope; picture-in-picture"
        allowFullScreen
        onError={() => setError(true)}
        {...(!isYouTube ? { sandbox: "allow-scripts allow-same-origin allow-popups" } : {})}
        referrerPolicy="no-referrer"
      />
    );
  }

  if (cam.source_type === "snapshot" && cam.snapshot_url) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <img src={cam.snapshot_url} alt={cam.name} className="max-w-full max-h-full object-contain" />
      </div>
    );
  }

  const fallbackUrl = cam.embed_url || cam.stream_url || cam.snapshot_url;
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
      <Video className="h-8 w-8 text-gray-600" />
      <span className="text-[10px] text-gray-500 font-mono">PREVIEW UNAVAILABLE</span>
      {fallbackUrl && (
        <a href={fallbackUrl} target="_blank" rel="noopener noreferrer"
          className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/20 rounded text-[10px] text-cyan-400 hover:bg-cyan-500/20 transition-all flex items-center gap-1 font-mono">
          <ExternalLink className="h-3 w-3" /> OPEN SOURCE
        </a>
      )}
    </div>
  );
}

// ═══════════════ MAIN COMPONENT ═══════════════
export const LiveCamerasModal = ({ onClose, onShowOnMap }: LiveCamerasModalProps) => {
  // ── State ──
  const [cameras, setCameras] = useState<CameraData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState<CameraData | null>(null);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [flyTarget, setFlyTarget] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState("GLOBAL");

  // Actions
  const [scraping, setScraping] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);

  // ── Data Fetching ──
  const fetchCameras = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cameras", {
        method: "POST",
        body: {
          action: "list",
          country: selectedCountry,
          category: selectedCategory,
          source: selectedSource,
          status: selectedStatus,
          search: searchQuery,
          limit: 500,
        },
      });
      if (error) throw error;
      setCameras((data?.cameras as CameraData[]) || []);
    } catch (e) {
      console.error("Failed to fetch cameras:", e);
      setCameras([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCountry, selectedCategory, selectedSource, selectedStatus, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("cameras", {
        method: "POST",
        body: { action: "stats" },
      });
      if (error) throw error;
      setStats(data as Stats);
    } catch (e) {
      console.error("Failed to fetch stats:", e);
    }
  }, []);

  useEffect(() => { fetchCameras(); }, [fetchCameras]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedCamera) setSelectedCamera(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, selectedCamera]);

  useEffect(() => {
    if (flyTarget) {
      const timer = setTimeout(() => setFlyTarget(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [flyTarget]);

  // ── Actions ──
  const handleRegionSelect = (region: string) => {
    setSelectedRegion(region);
    setFlyTarget(REGIONS[region]);
    setSelectedCountry(null);
  };

  const handleCameraClick = (cam: CameraData) => {
    setSelectedCamera(cam);
    setRightPanelOpen(true);
  };

  const openCameraSource = (cam: CameraData) => {
    const rawUrl = cam.embed_url || cam.stream_url || cam.snapshot_url;
    if (!rawUrl) return;
    const match = rawUrl.match(/youtube\.com\/embed\/([^?&/]+)/i);
    window.open(match ? `https://www.youtube.com/watch?v=${match[1]}` : rawUrl, "_blank", "noopener,noreferrer");
  };

  const copyLink = (cam: CameraData) => {
    const url = cam.embed_url || cam.stream_url || cam.snapshot_url || "";
    navigator.clipboard.writeText(url);
  };

  const scrapeAggregators = async () => {
    setScraping(true);
    try {
      await supabase.functions.invoke("cameras", { method: "POST", body: { action: "scrape_aggregators", country: selectedCountry } });
      await Promise.all([fetchCameras(), fetchStats()]);
    } catch (e) { console.error("Scrape failed:", e); }
    finally { setScraping(false); }
  };

  const discoverMore = async () => {
    setDiscovering(true);
    try {
      await supabase.functions.invoke("cameras", { method: "POST", body: { action: "discover", country: selectedCountry || "worldwide" } });
      await Promise.all([fetchCameras(), fetchStats()]);
    } catch (e) { console.error("Discovery failed:", e); }
    finally { setDiscovering(false); }
  };

  const runHealthCheck = async () => {
    setCheckingHealth(true);
    try {
      await supabase.functions.invoke("cameras", { method: "POST", body: { action: "health_check" } });
      await Promise.all([fetchCameras(), fetchStats()]);
    } catch (e) { console.error("Health check failed:", e); }
    finally { setCheckingHealth(false); }
  };

  // ── Computed ──
  const nearbyCameras = useMemo(() => {
    if (!selectedCamera) return [];
    return cameras
      .filter(c => c.id !== selectedCamera.id)
      .map(c => ({ ...c, dist: Math.sqrt(Math.pow(c.lat - selectedCamera.lat, 2) + Math.pow(c.lng - selectedCamera.lng, 2)) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 8);
  }, [selectedCamera, cameras]);

  const sortedCountries = useMemo(() => {
    if (!stats?.byCountry) return [];
    return Object.entries(stats.byCountry).sort((a, b) => b[1].total - a[1].total);
  }, [stats]);

  const getMarkerColor = (status: string) => {
    if (status === "active") return { fill: "#22c55e", stroke: "#15803d" };
    if (status === "error") return { fill: "#ef4444", stroke: "#b91c1c" };
    return { fill: "#f59e0b", stroke: "#d97706" };
  };

  // ═══════════════ RENDER ═══════════════
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex flex-col" style={{ background: "#080c12", fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
      {/* Custom tooltip styles */}
      <style>{`
        .leaflet-tooltip.cctv-tip { background: #0d1320 !important; border: 1px solid rgba(6,182,212,0.25) !important; color: #e2e8f0 !important; font-family: monospace !important; font-size: 10px !important; padding: 6px 10px !important; border-radius: 4px !important; box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important; }
        .leaflet-tooltip.cctv-tip::before { border-top-color: rgba(6,182,212,0.25) !important; }
        .cctv-scrollbar::-webkit-scrollbar { width: 4px; }
        .cctv-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .cctv-scrollbar::-webkit-scrollbar-thumb { background: rgba(6,182,212,0.2); border-radius: 2px; }
      `}</style>

      {/* ═══ COMMAND BAR ═══ */}
      <div className="h-11 border-b flex items-center px-3 gap-2 flex-shrink-0" style={{ borderColor: "rgba(6,182,212,0.15)", background: "#0a0f18" }}>
        <div className="flex items-center gap-2 mr-3">
          <Shield className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-bold tracking-[0.15em] text-cyan-400">STRATEGIC VISION MAP</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded text-cyan-300" style={{ background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)" }}>
            CCTV COMMAND
          </span>
        </div>

        {/* Region Presets */}
        <div className="flex items-center gap-0.5 mr-2">
          {Object.keys(REGIONS).map(region => (
            <button key={region} onClick={() => handleRegionSelect(region)}
              className={`px-1.5 py-1 rounded text-[8px] font-bold tracking-wider transition-all ${
                selectedRegion === region
                  ? "text-cyan-300" : "text-gray-600 hover:text-gray-400"
              }`}
              style={selectedRegion === region ? { background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)" } : { border: "1px solid transparent" }}
            >
              {region}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-600" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search cameras, cities, countries..."
            className="w-full pl-7 pr-3 py-1.5 rounded text-[10px] text-gray-200 placeholder:text-gray-600 focus:outline-none"
            style={{ background: "#111827", border: "1px solid rgba(6,182,212,0.15)" }}
          />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 ml-1">
          <button onClick={() => setSelectedStatus(selectedStatus === "online" ? null : "online")}
            className={`px-1.5 py-1 rounded text-[8px] font-bold flex items-center gap-1 transition-all ${
              selectedStatus === "online" ? "text-green-400" : "text-gray-600 hover:text-gray-400"
            }`}
            style={selectedStatus === "online" ? { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" } : { border: "1px solid transparent" }}
          >
            <Wifi className="h-3 w-3" /> ONLINE
          </button>
          <button onClick={() => setSelectedStatus(selectedStatus === "offline" ? null : "offline")}
            className={`px-1.5 py-1 rounded text-[8px] font-bold flex items-center gap-1 transition-all ${
              selectedStatus === "offline" ? "text-red-400" : "text-gray-600 hover:text-gray-400"
            }`}
            style={selectedStatus === "offline" ? { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" } : { border: "1px solid transparent" }}
          >
            <WifiOff className="h-3 w-3" /> OFFLINE
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={scrapeAggregators} disabled={scraping}
            className="px-2 py-1 rounded text-[8px] font-bold flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-all"
            style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)" }}>
            <Globe className={`h-3 w-3 ${scraping ? "animate-spin" : ""}`} /> {scraping ? "SCRAPING..." : "SCRAPE SOURCES"}
          </button>
          <button onClick={discoverMore} disabled={discovering}
            className="px-2 py-1 rounded text-[8px] font-bold flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-all"
            style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
            <Sparkles className={`h-3 w-3 ${discovering ? "animate-pulse" : ""}`} /> {discovering ? "FINDING..." : "AI FIND"}
          </button>
          <button onClick={runHealthCheck} disabled={checkingHealth} className="p-1.5 rounded hover:bg-white/5 transition-all" title="Health Check">
            <RefreshCw className={`h-3.5 w-3.5 text-gray-500 ${checkingHealth ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setLeftPanelOpen(!leftPanelOpen)} className="p-1.5 rounded hover:bg-white/5 transition-all">
            {leftPanelOpen ? <ChevronLeft className="h-3.5 w-3.5 text-gray-500" /> : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />}
          </button>
          <button onClick={onClose} className="p-1.5 rounded hover:bg-red-500/20 transition-all">
            <X className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT PANEL ── */}
        {leftPanelOpen && (
          <div className="w-60 flex flex-col overflow-hidden flex-shrink-0 cctv-scrollbar" style={{ borderRight: "1px solid rgba(6,182,212,0.12)", background: "#0a0f18ee" }}>
            {/* Stats */}
            <div className="p-3" style={{ borderBottom: "1px solid rgba(6,182,212,0.08)" }}>
              <div className="text-[8px] text-cyan-500/50 tracking-[0.2em] mb-2">GLOBAL OVERVIEW</div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { label: "TOTAL", value: stats?.total || cameras.length, color: "text-white" },
                  { label: "ONLINE", value: stats?.online || cameras.filter(c => c.status === "active").length, color: "text-green-400" },
                  { label: "OFFLINE", value: stats?.offline || cameras.filter(c => c.status !== "active").length, color: "text-red-400" },
                ].map(s => (
                  <div key={s.label} className="rounded p-1.5 text-center" style={{ background: "#111827" }}>
                    <div className={`text-base font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-[7px] text-gray-600">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: "#111827" }}>
                <div className="h-full rounded-full transition-all" style={{
                  width: `${(stats?.total || cameras.length) > 0 ? ((stats?.online || 0) / (stats?.total || cameras.length)) * 100 : 0}%`,
                  background: "linear-gradient(90deg, #22c55e, #06b6d4)"
                }} />
              </div>
            </div>

            {/* Continents */}
            {stats?.byContinent && (
              <div className="p-3" style={{ borderBottom: "1px solid rgba(6,182,212,0.08)" }}>
                <div className="text-[8px] text-cyan-500/50 tracking-[0.2em] mb-1.5">BY CONTINENT</div>
                <div className="space-y-0.5">
                  {Object.entries(stats.byContinent).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).map(([continent, count]) => (
                    <div key={continent} className="flex items-center justify-between px-1.5 py-1 rounded text-[9px]" style={{ background: "#111827" }}>
                      <span className="text-gray-400">{continent}</span>
                      <span className="text-cyan-400 font-bold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Categories */}
            <div className="p-3" style={{ borderBottom: "1px solid rgba(6,182,212,0.08)" }}>
              <div className="text-[8px] text-cyan-500/50 tracking-[0.2em] mb-1.5">CATEGORIES</div>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setSelectedCategory(null)}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-all ${!selectedCategory ? "text-cyan-300" : "text-gray-600 hover:text-gray-400"}`}
                  style={!selectedCategory ? { background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.25)" } : { border: "1px solid rgba(55,65,81,0.5)" }}>
                  ALL
                </button>
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                    className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase transition-all ${selectedCategory === cat ? "text-cyan-300" : "text-gray-600 hover:text-gray-400"}`}
                    style={selectedCategory === cat ? { background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.25)" } : { border: "1px solid rgba(55,65,81,0.5)" }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Countries */}
            <div className="flex-1 overflow-y-auto cctv-scrollbar p-3">
              <div className="text-[8px] text-cyan-500/50 tracking-[0.2em] mb-1.5">COUNTRY INTELLIGENCE</div>
              <div className="space-y-0.5">
                {sortedCountries.map(([country, data]) => (
                  <button key={country} onClick={() => setSelectedCountry(selectedCountry === country ? null : country)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[9px] transition-all ${
                      selectedCountry === country ? "text-cyan-300" : "text-gray-500 hover:text-gray-300"
                    }`}
                    style={selectedCountry === country ? { background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)" } : { border: "1px solid transparent" }}>
                    <span className="truncate flex items-center gap-1.5">
                      <Flag className="h-2.5 w-2.5" />{country}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-green-500/70 text-[8px]">{data.online}</span>
                      <span className="text-gray-700">/</span>
                      <span className="font-bold" style={{ background: "#111827", padding: "1px 5px", borderRadius: "3px" }}>{data.total}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Sources */}
            <div className="p-3" style={{ borderTop: "1px solid rgba(6,182,212,0.08)" }}>
              <div className="text-[8px] text-cyan-500/50 tracking-[0.2em] mb-1.5">DATA SOURCES</div>
              <div className="flex flex-wrap gap-1">
                {SOURCES.map(src => (
                  <button key={src} onClick={() => setSelectedSource(selectedSource === src ? null : src)}
                    className={`px-1.5 py-0.5 rounded text-[7px] font-bold transition-all ${
                      selectedSource === src ? "text-purple-300" : "text-gray-600 hover:text-gray-400"
                    }`}
                    style={selectedSource === src ? { background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.25)" } : { border: "1px solid rgba(55,65,81,0.4)" }}>
                    {src}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CENTER: TACTICAL MAP ── */}
        <div className="flex-1 relative">
          {loading && (
            <div className="absolute inset-0 z-[10] flex items-center justify-center" style={{ background: "rgba(8,12,18,0.85)" }}>
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5 text-cyan-400 animate-spin" />
                <span className="text-sm text-cyan-400 tracking-wider text-[11px] font-bold">LOADING FEEDS...</span>
              </div>
            </div>
          )}

          <MapContainer center={[20, 0]} zoom={2} className="w-full h-full" zoomControl={false} attributionControl={false} style={{ background: "#080c12" }}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <MapEventHandler onMoveEnd={() => {}} />
            <FlyToHandler target={flyTarget} />

            {cameras.map(cam => {
              if (!cam.lat || !cam.lng) return null;
              const colors = getMarkerColor(cam.status);
              const isSelected = selectedCamera?.id === cam.id;
              return (
                <CircleMarker key={cam.id} center={[cam.lat, cam.lng]}
                  radius={isSelected ? 8 : 5}
                  fillColor={colors.fill} color={isSelected ? "#06b6d4" : colors.stroke}
                  weight={isSelected ? 3 : 1.5} fillOpacity={0.85}
                  eventHandlers={{ click: () => handleCameraClick(cam) }}>
                  <Tooltip direction="top" offset={[0, -8]} className="cctv-tip">
                    <div>
                      <div style={{ fontWeight: "bold" }}>{cam.name}</div>
                      <div style={{ color: "#9ca3af" }}>{cam.city}, {cam.country}</div>
                      <div style={{ color: cam.status === "active" ? "#22c55e" : "#ef4444" }}>
                        {cam.status === "active" ? "● ONLINE" : "● OFFLINE"}
                      </div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* Map Overlay - Legend */}
          <div className="absolute bottom-3 left-3 z-[5] flex items-center gap-2">
            <div className="rounded px-3 py-1.5 flex items-center gap-3" style={{ background: "rgba(10,15,24,0.9)", border: "1px solid rgba(6,182,212,0.15)" }}>
              {[
                { color: "#22c55e", label: "ONLINE" },
                { color: "#ef4444", label: "OFFLINE" },
                { color: "#f59e0b", label: "UNKNOWN" },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                  <span className="text-[8px] text-gray-500">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Map Overlay - Feed Count */}
          <div className="absolute top-3 right-3 z-[5]">
            <div className="rounded px-3 py-1.5" style={{ background: "rgba(10,15,24,0.9)", border: "1px solid rgba(6,182,212,0.15)" }}>
              <span className="text-[8px] text-gray-500">FEEDS IN VIEW: </span>
              <span className="text-sm font-bold text-cyan-400">{cameras.length}</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        {rightPanelOpen && (
          <div className="w-72 flex flex-col overflow-hidden flex-shrink-0 cctv-scrollbar" style={{ borderLeft: "1px solid rgba(6,182,212,0.12)", background: "#0a0f18ee" }}>
            {selectedCamera ? (
              <>
                {/* Camera Detail */}
                <div className="p-3" style={{ borderBottom: "1px solid rgba(6,182,212,0.08)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[8px] text-cyan-500/50 tracking-[0.2em]">CAMERA INTELLIGENCE</div>
                    <button onClick={() => setSelectedCamera(null)} className="p-1 hover:bg-white/5 rounded">
                      <X className="h-3 w-3 text-gray-500" />
                    </button>
                  </div>
                  <div className="text-xs font-bold text-white">{selectedCamera.name}</div>
                  <div className="text-[9px] text-gray-400 mt-0.5">{selectedCamera.city}, {selectedCamera.country}</div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold ${
                      selectedCamera.status === "active" ? "text-green-400" : "text-red-400"
                    }`} style={{
                      background: selectedCamera.status === "active" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                      border: `1px solid ${selectedCamera.status === "active" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`
                    }}>
                      <span className={`w-1.5 h-1.5 rounded-full ${selectedCamera.status === "active" ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
                      {selectedCamera.status === "active" ? "ONLINE" : "OFFLINE"}
                    </span>
                    <span className="text-[8px] px-1.5 py-0.5 rounded text-gray-400 uppercase font-bold" style={{ background: "#111827", border: "1px solid rgba(55,65,81,0.5)" }}>
                      {selectedCamera.category}
                    </span>
                    {selectedCamera.source_name && (
                      <span className="text-[8px] px-1.5 py-0.5 rounded text-purple-300 font-bold" style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.2)" }}>
                        {selectedCamera.source_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Feed Viewer */}
                <div className="h-44 flex-shrink-0" style={{ borderBottom: "1px solid rgba(6,182,212,0.08)", background: "rgba(0,0,0,0.4)" }}>
                  <FeedViewer cam={selectedCamera} />
                </div>

                {/* Actions */}
                <div className="p-2 grid grid-cols-2 gap-1" style={{ borderBottom: "1px solid rgba(6,182,212,0.08)" }}>
                  <button onClick={() => openCameraSource(selectedCamera)}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[8px] text-cyan-400 font-bold hover:bg-cyan-500/10 transition-all"
                    style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)" }}>
                    <ExternalLink className="h-3 w-3" /> OPEN LIVE
                  </button>
                  <button onClick={() => copyLink(selectedCamera)}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[8px] text-gray-400 font-bold hover:bg-white/5 transition-all"
                    style={{ background: "#111827", border: "1px solid rgba(55,65,81,0.5)" }}>
                    <Copy className="h-3 w-3" /> COPY LINK
                  </button>
                  {selectedCamera.lat !== 0 && onShowOnMap && (
                    <button onClick={() => { onShowOnMap(selectedCamera.lat, selectedCamera.lng, selectedCamera.name); onClose(); }}
                      className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[8px] text-gray-400 font-bold hover:bg-white/5 transition-all"
                      style={{ background: "#111827", border: "1px solid rgba(55,65,81,0.5)" }}>
                      <Crosshair className="h-3 w-3" /> MAP
                    </button>
                  )}
                  <button className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[8px] text-amber-400 font-bold hover:bg-amber-500/10 transition-all"
                    style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }}>
                    <AlertTriangle className="h-3 w-3" /> REPORT
                  </button>
                </div>

                {/* Nearby Cameras */}
                <div className="flex-1 overflow-y-auto cctv-scrollbar p-3">
                  <div className="text-[8px] text-cyan-500/50 tracking-[0.2em] mb-2">NEARBY CAMERAS</div>
                  <div className="space-y-1">
                    {nearbyCameras.map(cam => (
                      <button key={cam.id} onClick={() => handleCameraClick(cam)}
                        className="w-full text-left p-2 rounded hover:bg-white/[0.03] transition-all"
                        style={{ background: "#111827", border: "1px solid rgba(55,65,81,0.3)" }}>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cam.status === "active" ? "bg-green-500" : "bg-red-500"}`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] font-bold text-gray-300 truncate">{cam.name}</div>
                            <div className="text-[8px] text-gray-600">{cam.city} • {cam.category}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                    {nearbyCameras.length === 0 && <div className="text-[9px] text-gray-700 text-center py-4">No nearby cameras</div>}
                  </div>
                </div>
              </>
            ) : (
              /* Camera List */
              <div className="flex flex-col h-full">
                <div className="p-3" style={{ borderBottom: "1px solid rgba(6,182,212,0.08)" }}>
                  <div className="text-[8px] text-cyan-500/50 tracking-[0.2em]">CAMERA FEEDS ({cameras.length})</div>
                </div>
                <div className="flex-1 overflow-y-auto cctv-scrollbar">
                  {cameras.map(cam => (
                    <button key={cam.id} onClick={() => handleCameraClick(cam)}
                      className="w-full text-left p-2.5 hover:bg-white/[0.02] transition-all"
                      style={{ borderBottom: "1px solid rgba(6,182,212,0.05)" }}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          cam.status === "active" ? "bg-green-500" : cam.status === "error" ? "bg-red-500" : "bg-amber-500"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] font-bold text-gray-300 truncate">{cam.name}</div>
                          <div className="text-[8px] text-gray-600">{cam.city}, {cam.country}</div>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[7px] text-gray-600 uppercase">{cam.category}</span>
                          {cam.source_name && <span className="text-[7px] text-purple-400/60">{cam.source_name}</span>}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ BOTTOM STATUS BAR ═══ */}
      <div className="h-7 flex items-center px-4 justify-between flex-shrink-0" style={{ borderTop: "1px solid rgba(6,182,212,0.12)", background: "#0a0f18" }}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-green-500" />
            <span className="text-[8px] text-gray-500">SYSTEM OPERATIONAL</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Radio className="h-3 w-3 text-cyan-400" />
            <span className="text-[8px] text-gray-500">SOURCES: {SOURCES.length} AGGREGATORS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Signal className="h-3 w-3 text-cyan-400" />
            <span className="text-[8px] text-gray-500">FEEDS: {stats?.total || cameras.length} TOTAL • {stats?.online || 0} ACTIVE</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="h-3 w-3 text-cyan-400" />
            <span className="text-[8px] text-gray-500">COUNTRIES: {sortedCountries.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[8px] text-gray-700">⚠ AUTHORIZED PUBLIC SOURCES ONLY • OSINT COMPLIANT</span>
          <span className="text-[8px] text-gray-700">ESC TO CLOSE</span>
        </div>
      </div>
    </div>,
    document.body
  );
};
