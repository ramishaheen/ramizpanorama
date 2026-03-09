import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Hls from "hls.js";
import { MapContainer, TileLayer, Marker, Tooltip, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
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
  stream_type_detected?: string | null;
}

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const STREAM_PROXY_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stream-proxy`;

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

function MapZoomControls() {
  const map = useMap();
  const btnStyle: React.CSSProperties = {
    width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(10,15,24,0.92)", border: "1px solid rgba(6,182,212,0.2)",
    borderRadius: 6, color: "#06b6d4", cursor: "pointer", fontSize: 16, fontWeight: 700,
    transition: "all 0.15s",
  };
  return (
    <div style={{ position: "absolute", right: 12, bottom: 60, zIndex: 1000, display: "flex", flexDirection: "column", gap: 4 }}>
      <button style={btnStyle} onClick={() => map.zoomIn()} title="Zoom In">+</button>
      <button style={btnStyle} onClick={() => map.zoomOut()} title="Zoom Out">−</button>
      <button style={{ ...btnStyle, fontSize: 12 }} onClick={() => map.flyTo([28, 45], 5, { duration: 1.2 })} title="Reset View">⌂</button>
      <button style={{ ...btnStyle, fontSize: 11 }} onClick={() => map.panBy([0, -100])} title="Pan Up">↑</button>
      <button style={{ ...btnStyle, fontSize: 11 }} onClick={() => map.panBy([0, 100])} title="Pan Down">↓</button>
      <button style={{ ...btnStyle, fontSize: 11 }} onClick={() => map.panBy([-100, 0])} title="Pan Left">←</button>
      <button style={{ ...btnStyle, fontSize: 11 }} onClick={() => map.panBy([100, 0])} title="Pan Right">→</button>
    </div>
  );
}

// ═══════════════ FEED VIEWER ═══════════════
function FeedViewer({ cam, expanded }: { cam: CameraData; expanded?: boolean }) {
  const [embedState, setEmbedState] = useState<"loading" | "ok" | "blocked">("loading");
  const [snapTick, setSnapTick] = useState(0);

  // Reset state when camera changes
  useEffect(() => {
    setEmbedState("loading");
    setSnapTick(0);
  }, [cam.id]);

  // Auto-refresh snapshot every 5s
  useEffect(() => {
    if (cam.snapshot_url || embedState === "blocked") {
      const iv = setInterval(() => setSnapTick(t => t + 1), 5000);
      return () => clearInterval(iv);
    }
  }, [cam.snapshot_url, embedState]);

  const getEmbedUrl = (url: string): string | null => {
    // YouTube - convert any URL to embeddable format
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&mute=1&controls=1&modestbranding=1`;
    // Vimeo
    const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
    if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&muted=1`;
    // Dailymotion
    const dmMatch = url.match(/dailymotion\.com\/video\/([a-z0-9]+)/i);
    if (dmMatch) return `https://www.dailymotion.com/embed/video/${dmMatch[1]}?autoplay=1&mute=1`;
    // Already an embed URL with known embeddable domains
    const embeddableDomains = ["youtube.com/embed", "player.vimeo.com", "dailymotion.com/embed", "livestream.com/accounts", "ustream.tv", "twitch.tv/embed", "iframe.dacast.com", "video.ibm.com"];
    if (embeddableDomains.some(d => url.includes(d))) return url;
    // Windy webcams
    const windyMatch = url.match(/windy\.com\/webcams\/(\d+)/);
    if (windyMatch) return `https://webcams.windy.com/webcams/public/embed/player/${windyMatch[1]}/day`;
    return null;
  };

  // Try embeddable URL first
  const primaryUrl = cam.embed_url || cam.stream_url || "";
  const embeddableUrl = getEmbedUrl(primaryUrl);
  const snapshotSrc = cam.snapshot_url || cam.thumbnail_url;

  // Detect iframe block via timeout (onLoad fires but content is blocked)
  useEffect(() => {
    if (embeddableUrl && embedState === "loading") {
      const timer = setTimeout(() => {
        // If still loading after 8s, likely blocked
        setEmbedState(prev => prev === "loading" ? "blocked" : prev);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [embeddableUrl, embedState]);

  // Listen for YouTube postMessage "unavailable" signals
  useEffect(() => {
    if (!embeddableUrl?.includes("youtube.com")) return;
    const handler = (e: MessageEvent) => {
      try {
        if (typeof e.data === "string" && e.data.includes('"event":"onError"')) {
          setEmbedState("blocked");
        }
      } catch {}
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [embeddableUrl]);

  // Embeddable iframe available
  if (embeddableUrl && embedState !== "blocked") {
    return (
      <div className="w-full h-full relative">
        {embedState === "loading" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: "#0a0f18" }}>
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="h-5 w-5 text-cyan-400 animate-spin" />
              <span className="text-[9px] text-gray-500 font-mono">CONNECTING TO FEED...</span>
            </div>
          </div>
        )}
        <iframe
          key={cam.id}
          src={embeddableUrl + (embeddableUrl.includes("youtube.com") ? "&enablejsapi=1" : "")}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen; encrypted-media; accelerometer; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={() => setEmbedState("ok")}
          onError={() => setEmbedState("blocked")}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // Snapshot / thumbnail fallback with auto-refresh
  if (snapshotSrc) {
    const imgSrc = `${snapshotSrc}${snapshotSrc.includes("?") ? "&" : "?"}t=${snapTick}`;
    return (
      <div className="w-full h-full relative flex items-center justify-center" style={{ background: "#0a0f18" }}>
        <img src={imgSrc} alt={cam.name} className="max-w-full max-h-full object-contain"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded" style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(6,182,212,0.2)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-[8px] text-cyan-400 font-mono font-bold">SNAPSHOT • AUTO-REFRESH</span>
        </div>
        <div className="absolute bottom-2 left-2 text-[8px] text-gray-600 font-mono">
          FRAME #{snapTick}
        </div>
      </div>
    );
  }

  // HLS stream - open in-app via video element
  if (cam.stream_url && (cam.stream_url.endsWith(".m3u8") || cam.source_type === "hls")) {
    return (
      <div className="w-full h-full relative" style={{ background: "#0a0f18" }}>
        <video
          key={cam.id}
          src={cam.stream_url}
          className="w-full h-full object-contain"
          autoPlay muted controls playsInline
          onError={() => setEmbedState("blocked")}
        />
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded" style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(239,68,68,0.3)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[8px] text-red-400 font-mono font-bold">LIVE STREAM</span>
        </div>
      </div>
    );
  }

  // Final fallback - tactical "no feed" display
  const rawUrl = cam.embed_url || cam.stream_url || cam.snapshot_url;
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3" style={{ background: "#0a0f18" }}>
      <div className="relative">
        <Camera className="h-10 w-10 text-gray-700" />
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500/30 flex items-center justify-center">
          <AlertTriangle className="h-2 w-2 text-amber-400" />
        </span>
      </div>
      <div className="text-center">
        <div className="text-[10px] text-gray-400 font-mono font-bold">FEED RESTRICTED</div>
        <div className="text-[8px] text-gray-600 font-mono mt-0.5">Source blocks inline embedding</div>
      </div>
      {rawUrl && (
        <button onClick={() => {
          const ytM = rawUrl.match(/youtube\.com\/embed\/([^?&/]+)/i);
          window.open(ytM ? `https://www.youtube.com/watch?v=${ytM[1]}` : rawUrl, "_blank", "noopener,noreferrer");
        }}
          className="px-4 py-2 rounded text-[10px] text-white font-mono font-bold flex items-center gap-2 hover:bg-cyan-500/20 transition-all"
          style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)" }}>
          <Eye className="h-3.5 w-3.5" /> VIEW LIVE FEED
        </button>
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
  const [pipCamera, setPipCamera] = useState<CameraData | null>(null);
  const [pipSize, setPipSize] = useState<"sm" | "md" | "lg">("md");
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
              selectedStatus === "online" ? "text-white" : "text-white/60 hover:text-white"
            }`}
            style={selectedStatus === "online" ? { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" } : { border: "1px solid transparent" }}
          >
            <Wifi className="h-3 w-3" /> ONLINE
          </button>
          <button onClick={() => setSelectedStatus(selectedStatus === "offline" ? null : "offline")}
            className={`px-1.5 py-1 rounded text-[8px] font-bold flex items-center gap-1 transition-all ${
              selectedStatus === "offline" ? "text-white" : "text-white/60 hover:text-white"
            }`}
            style={selectedStatus === "offline" ? { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" } : { border: "1px solid transparent" }}
          >
            <WifiOff className="h-3 w-3" /> OFFLINE
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={scrapeAggregators} disabled={scraping}
            className="px-2 py-1 rounded text-[8px] font-bold flex items-center gap-1 text-white hover:text-white transition-all"
            style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)" }}>
            <Globe className={`h-3 w-3 ${scraping ? "animate-spin" : ""}`} /> {scraping ? "SCRAPING..." : "SCRAPE SOURCES"}
          </button>
          <button onClick={discoverMore} disabled={discovering}
            className="px-2 py-1 rounded text-[8px] font-bold flex items-center gap-1 text-white hover:text-white transition-all"
            style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)" }}>
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

          <MapContainer center={[28, 45]} zoom={5} className="w-full h-full" zoomControl={false} attributionControl={false} style={{ background: "#070b10" }}>
            {/* Dark 3D-style terrain tiles */}
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              opacity={0.6}
            />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
              opacity={0.8}
            />
            <MapEventHandler onMoveEnd={() => {}} />
            <FlyToHandler target={flyTarget} />
            <MapZoomControls />

            {cameras.map(cam => {
              if (!cam.lat || !cam.lng) return null;
              const isSelected = selectedCamera?.id === cam.id;
              const isOnline = cam.status === "active";
              const borderColor = isOnline ? "#22c55e" : "#ef4444";
              const glowColor = isOnline ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.4)";
              const size = isSelected ? 56 : 44;

              // Extract YouTube thumbnail
              const ytMatch = cam.embed_url?.match(/youtube\.com\/embed\/([^?&/]+)/i);
              const thumbUrl = ytMatch
                ? `https://img.youtube.com/vi/${ytMatch[1]}/mqdefault.jpg`
                : cam.thumbnail_url || cam.snapshot_url || null;

              const icon = L.divIcon({
                className: "",
                html: `<div style="position:relative;width:${size}px;height:${size + 14}px;cursor:pointer;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.7));">
                  ${thumbUrl
                    ? `<div style="width:${size}px;height:${size * 0.62}px;border-radius:6px 6px 0 0;overflow:hidden;border:2px solid ${isSelected ? '#06b6d4' : borderColor};border-bottom:none;box-shadow:0 0 12px ${glowColor};${isOnline ? 'animation:pulse 3s ease-in-out infinite;' : ''}">
                        <img src="${thumbUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#111827;font-size:16px;\\'>📹</div>'" />
                      </div>
                      <div style="width:${size}px;height:16px;border-radius:0 0 6px 6px;background:${isSelected ? 'rgba(6,182,212,0.9)' : 'rgba(10,15,24,0.95)'};border:2px solid ${isSelected ? '#06b6d4' : borderColor};border-top:none;display:flex;align-items:center;justify-content:center;gap:3px;">
                        <span style="width:5px;height:5px;border-radius:50%;background:${borderColor};${isOnline ? 'animation:pulse 2s infinite;' : ''}"></span>
                        <span style="font-size:7px;font-weight:800;color:${isSelected ? '#fff' : '#9ca3af'};font-family:monospace;letter-spacing:0.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:${size - 20}px;">${cam.city}</span>
                      </div>`
                    : `<div style="width:${size}px;height:${size * 0.62 + 16}px;border-radius:6px;background:rgba(10,15,24,0.9);border:2px solid ${isSelected ? '#06b6d4' : borderColor};box-shadow:0 0 12px ${glowColor};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;${isOnline ? 'animation:pulse 3s ease-in-out infinite;' : ''}">
                        <span style="font-size:18px;filter:drop-shadow(0 0 6px ${borderColor});">📹</span>
                        <span style="font-size:7px;font-weight:800;color:#9ca3af;font-family:monospace;">${cam.city}</span>
                      </div>`
                  }
                  ${isOnline ? `<div style="position:absolute;top:-2px;right:-2px;width:8px;height:8px;border-radius:50%;background:#22c55e;border:2px solid #070b10;z-index:2;"></div>` : ''}
                </div>`,
                iconSize: [size, size + 14],
                iconAnchor: [size / 2, size + 14],
              });
              return (
                <Marker key={cam.id} position={[cam.lat, cam.lng]} icon={icon}
                  eventHandlers={{ click: () => handleCameraClick(cam) }}>
                  <Tooltip direction="top" offset={[0, -(size + 16)]} className="cctv-tip">
                    <div style={{ padding: 4 }}>
                      <div style={{ fontWeight: "bold", fontSize: 11, color: "#06b6d4" }}>{cam.name}</div>
                      <div style={{ color: "#9ca3af", fontSize: 10 }}>{cam.city}, {cam.country}</div>
                      <div style={{ fontSize: 10, color: cam.status === 'active' ? '#22c55e' : '#ef4444', marginTop: 2 }}>
                        {cam.status === "active" ? "● ONLINE" : "● OFFLINE"}
                      </div>
                      <div style={{ fontSize: 9, color: "#6b7280", marginTop: 1 }}>{cam.source_name} • {cam.category}</div>
                    </div>
                  </Tooltip>
                </Marker>
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

          {/* ── PiP Floating Feed ── */}
          {pipCamera && (() => {
            const pipW = pipSize === "sm" ? 240 : pipSize === "lg" ? 480 : 340;
            const pipH = pipSize === "sm" ? 135 : pipSize === "lg" ? 270 : 191;
            const ytMatch = pipCamera.embed_url?.match(/youtube\.com\/embed\/([^?&/]+)/i);
            const embedSrc = pipCamera.embed_url || pipCamera.stream_url;
            return (
              <div
                className="absolute z-[20] rounded-lg overflow-hidden"
                style={{
                  bottom: 50, left: 12, width: pipW, height: pipH + 28,
                  background: "rgba(8,12,18,0.97)", border: "1px solid rgba(6,182,212,0.3)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.7), 0 0 20px rgba(6,182,212,0.15)",
                }}
              >
                {/* PiP header */}
                <div className="flex items-center justify-between px-2" style={{ height: 28, background: "rgba(6,182,212,0.08)", borderBottom: "1px solid rgba(6,182,212,0.15)" }}>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[8px] font-mono font-bold text-cyan-400 truncate" style={{ maxWidth: pipW - 100 }}>
                      {pipCamera.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {(["sm", "md", "lg"] as const).map(s => (
                      <button key={s} onClick={() => setPipSize(s)}
                        className="px-1.5 py-0.5 rounded text-[7px] font-bold font-mono transition-all"
                        style={{
                          background: pipSize === s ? "rgba(6,182,212,0.2)" : "transparent",
                          color: pipSize === s ? "#06b6d4" : "#6b7280",
                          border: pipSize === s ? "1px solid rgba(6,182,212,0.3)" : "1px solid transparent",
                        }}>
                        {s.toUpperCase()}
                      </button>
                    ))}
                    <button onClick={() => setPipCamera(null)}
                      className="ml-1 w-5 h-5 rounded flex items-center justify-center hover:bg-red-500/20 transition-all"
                      style={{ color: "#ef4444" }}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {/* PiP feed */}
                <div style={{ width: pipW, height: pipH }}>
                  {embedSrc ? (
                    <iframe
                      src={embedSrc}
                      className="w-full h-full border-0"
                      allow="autoplay; fullscreen; encrypted-media; accelerometer; gyroscope; picture-in-picture"
                      allowFullScreen
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ background: "#0a0f18" }}>
                      <span className="text-[10px] text-gray-600 font-mono">NO FEED AVAILABLE</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
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
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setPipCamera(selectedCamera); }} className="p-1 hover:bg-cyan-500/10 rounded" title="Picture-in-Picture">
                        <Video className="h-3 w-3 text-cyan-500" />
                      </button>
                      <button onClick={() => setSelectedCamera(null)} className="p-1 hover:bg-white/5 rounded">
                        <X className="h-3 w-3 text-gray-500" />
                      </button>
                    </div>
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
                <div className="h-56 flex-shrink-0" style={{ borderBottom: "1px solid rgba(6,182,212,0.08)", background: "rgba(0,0,0,0.4)" }}>
                  <FeedViewer cam={selectedCamera} expanded />
                </div>

                {/* Actions */}
                <div className="p-2 grid grid-cols-2 gap-1" style={{ borderBottom: "1px solid rgba(6,182,212,0.08)" }}>
                  <button onClick={() => openCameraSource(selectedCamera)}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[8px] text-white font-bold hover:bg-cyan-500/20 transition-all"
                    style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)" }}>
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
