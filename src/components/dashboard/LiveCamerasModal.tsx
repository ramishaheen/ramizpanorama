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
  Layers, Flag, Zap, Youtube, MonitorPlay, ImageIcon, Play
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
  youtube_video_id?: string | null;
  original_url?: string | null;
  playable_url?: string | null;
  verification_status?: string | null;
  verification_error?: string | null;
  is_verified?: boolean;
}

const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const STREAM_PROXY_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stream-proxy`;

interface LiveCamerasModalProps {
  onClose: () => void;
  onShowOnMap?: (lat: number, lng: number, name: string) => void;
}

interface Stats {
  total: number; online: number; offline: number; unknown: number;
  youtubeCount?: number;
  byCountry: Record<string, { total: number; online: number }>;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  byContinent: Record<string, number>;
  byVerification?: Record<string, number>;
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

// ═══════════════ HELPERS ═══════════════
const extractYouTubeId = (url: string): string | null => {
  if (!url) return null;
  const patterns = [
    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/i,
    /youtube\.com\/watch\?v=([A-Za-z0-9_-]{11})/i,
    /youtu\.be\/([A-Za-z0-9_-]{11})/i,
    /youtube\.com\/live\/([A-Za-z0-9_-]{11})/i,
    /[?&]v=([A-Za-z0-9_-]{11})/i,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
};

const getYouTubeThumbnail = (ytId: string) => `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;

const getVerificationBadge = (status: string | null | undefined) => {
  switch (status) {
    case "verified_youtube": return { label: "YOUTUBE", color: "#ef4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.25)", icon: "▶" };
    case "verified_hls": return { label: "HLS LIVE", color: "#22c55e", bg: "rgba(34,197,94,0.12)", border: "rgba(34,197,94,0.25)", icon: "◉" };
    case "verified_snapshot": return { label: "SNAPSHOT", color: "#06b6d4", bg: "rgba(6,182,212,0.12)", border: "rgba(6,182,212,0.25)", icon: "◎" };
    case "verified_mjpeg": return { label: "MJPEG", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", border: "rgba(139,92,246,0.25)", icon: "◉" };
    case "proxy_required": return { label: "RTSP", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.25)", icon: "⚡" };
    case "page_only": return { label: "EMBED", color: "#6366f1", bg: "rgba(99,102,241,0.12)", border: "rgba(99,102,241,0.25)", icon: "▣" };
    case "blocked": return { label: "BLOCKED", color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.2)", icon: "✕" };
    case "unsupported": return { label: "N/A", color: "#6b7280", bg: "rgba(107,114,128,0.1)", border: "rgba(107,114,128,0.2)", icon: "—" };
    default: return { label: "PENDING", color: "#9ca3af", bg: "rgba(156,163,175,0.08)", border: "rgba(156,163,175,0.2)", icon: "?" };
  }
};

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
    </div>
  );
}

// ═══════════════ YOUTUBE PLAYER ═══════════════
function YouTubePlayer({ videoId, cam }: { videoId: string; cam: CameraData }) {
  const [loadState, setLoadState] = useState<"loading" | "ok" | "restricted">("loading");
  const thumbUrl = getYouTubeThumbnail(videoId);

  useEffect(() => {
    setLoadState("loading");
    const timer = setTimeout(() => {
      setLoadState(prev => prev === "loading" ? "ok" : prev);
    }, 8000);

    const handler = (e: MessageEvent) => {
      try {
        if (typeof e.data === "string" && e.data.includes('"event":"onError"')) {
          const parsed = JSON.parse(e.data);
          const errorCode = parsed?.info;
          if (errorCode === 150 || errorCode === 101) {
            setLoadState("restricted");
          }
        }
      } catch {}
    };
    window.addEventListener("message", handler);
    return () => { clearTimeout(timer); window.removeEventListener("message", handler); };
  }, [videoId]);

  if (loadState === "restricted") {
    return (
      <div className="w-full h-full relative flex flex-col items-center justify-center" style={{ background: `linear-gradient(rgba(0,0,0,0.85), rgba(0,0,0,0.95)), url(${thumbUrl}) center/cover` }}>
        <img src={thumbUrl} alt={cam.name} className="absolute inset-0 w-full h-full object-cover opacity-20 blur-sm" />
        <div className="relative z-10 flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-[9px] text-amber-400 font-mono font-bold">EMBED RESTRICTED</span>
          </div>
          <div className="text-[10px] text-gray-400 font-mono text-center px-4">
            This stream blocks inline embedding (Error 153/150)
          </div>
          <a href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-white font-bold text-xs transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", boxShadow: "0 4px 20px rgba(239,68,68,0.3)" }}>
            <Youtube className="h-4 w-4" /> WATCH ON YOUTUBE
          </a>
          <span className="text-[8px] text-gray-600 font-mono">{cam.city}, {cam.country}</span>
        </div>
      </div>
    );
  }

  const youtubeEmbedSrc = `https://www.youtube.com/embed/${videoId}?${new URLSearchParams({
    autoplay: "1",
    mute: "1",
    controls: "1",
    modestbranding: "1",
    rel: "0",
    enablejsapi: "1",
    playsinline: "1",
    origin: window.location.origin,
    widget_referrer: window.location.href,
  }).toString()}`;

  return (
    <div className="w-full h-full relative">
      {loadState === "loading" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ background: `linear-gradient(rgba(10,15,24,0.9), rgba(10,15,24,0.95)), url(${thumbUrl}) center/cover` }}>
          <img src={thumbUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-10" />
          <div className="relative flex flex-col items-center gap-2">
            <RefreshCw className="h-5 w-5 text-red-400 animate-spin" />
            <span className="text-[9px] text-gray-500 font-mono">CONNECTING TO YOUTUBE...</span>
          </div>
        </div>
      )}
      <iframe
        key={videoId}
        src={youtubeEmbedSrc}
        className="w-full h-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        onLoad={() => setLoadState("ok")}
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded" style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(239,68,68,0.3)" }}>
        <Youtube className="h-3 w-3 text-red-500" />
        <span className="text-[8px] text-red-400 font-mono font-bold">YOUTUBE LIVE</span>
      </div>
    </div>
  );
}

// ═══════════════ FEED VIEWER (with source-type routing) ═══════════════
function FeedViewer({ cam, expanded }: { cam: CameraData; expanded?: boolean }) {
  const [snapTick, setSnapTick] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [proxySnapSrc, setProxySnapSrc] = useState<string | null>(null);
  const [hlsFailed, setHlsFailed] = useState(false);
  const [embedState, setEmbedState] = useState<"loading" | "ok" | "blocked">("loading");
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const MAX_RETRIES = 3;
  const ytId = cam.youtube_video_id || extractYouTubeId(cam.embed_url || cam.stream_url || "");
  const verStatus = cam.verification_status;
  const isHls = !ytId && (verStatus === "verified_hls" || cam.stream_type_detected === "hls" || !!(cam.stream_url && /\.m3u8/i.test(cam.stream_url)));
  const isSnapshot = !ytId && !isHls && (verStatus === "verified_snapshot" || cam.stream_type_detected === "snapshot" || !!cam.snapshot_url);
  const isMjpeg = !ytId && !isHls && !isSnapshot && (verStatus === "verified_mjpeg" || cam.stream_type_detected === "mjpeg");
  const isRtsp = !ytId && !isHls && !isSnapshot && !isMjpeg && (verStatus === "proxy_required" || cam.stream_type_detected === "rtsp");
  const embedUrl = !ytId && !isHls && !isSnapshot && !isMjpeg && !isRtsp ? (cam.embed_url || cam.playable_url || cam.stream_url) : null;

  // ALL HOOKS MUST BE BEFORE ANY RETURNS
  useEffect(() => {
    setSnapTick(0); setRetryCount(0); setProxySnapSrc(null); setHlsFailed(false); setEmbedState("loading");
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
  }, [cam.id]);

  useEffect(() => {
    if (!isHls || !cam.stream_url || !videoRef.current || hlsFailed) return;
    const video = videoRef.current;
    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: true, maxBufferLength: 10, maxMaxBufferLength: 30 });
      hlsRef.current = hls;
      hls.loadSource(cam.stream_url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retryCount < MAX_RETRIES) {
            setTimeout(() => { hls.startLoad(); setRetryCount(r => r + 1); }, 4000);
          } else { hls.destroy(); hlsRef.current = null; setHlsFailed(true); }
        }
      });
      return () => { hls.destroy(); hlsRef.current = null; };
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = cam.stream_url;
      video.addEventListener("loadedmetadata", () => { video.play().catch(() => {}); });
    }
  }, [isHls, cam.stream_url, retryCount, hlsFailed]);

  useEffect(() => {
    if (!isSnapshot) return;
    const iv = setInterval(() => setSnapTick(t => t + 1), 5000);
    return () => clearInterval(iv);
  }, [isSnapshot]);

  useEffect(() => {
    if (!isSnapshot) return;
    const snapUrl = cam.snapshot_url || cam.stream_url;
    if (!snapUrl) return;
    const fetchProxy = async () => {
      try {
        const resp = await fetch(STREAM_PROXY_URL, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "proxy", url: snapUrl }),
        });
        if (resp.ok) {
          const blob = await resp.blob();
          const objectUrl = URL.createObjectURL(blob);
          setProxySnapSrc(prev => { if (prev) URL.revokeObjectURL(prev); return objectUrl; });
        }
      } catch { setProxySnapSrc(snapUrl); }
    };
    fetchProxy();
  }, [isSnapshot, cam.snapshot_url, cam.stream_url, snapTick]);

  useEffect(() => {
    if (!embedUrl) return;
    setEmbedState("loading");
    const timer = setTimeout(() => setEmbedState(prev => prev === "loading" ? "ok" : prev), 8000);
    return () => clearTimeout(timer);
  }, [embedUrl]);

  // ── RENDERS (after all hooks) ──

  if (ytId) return <YouTubePlayer videoId={ytId} cam={cam} />;

  if (isHls && cam.stream_url && !hlsFailed) {
    return (
      <div className="w-full h-full relative" style={{ background: "#0a0f18" }}>
        <video ref={videoRef} className="w-full h-full object-contain" autoPlay muted controls playsInline />
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded" style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(34,197,94,0.3)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-[8px] text-green-400 font-mono font-bold">HLS LIVE</span>
        </div>
      </div>
    );
  }

  if (isSnapshot && (cam.snapshot_url || proxySnapSrc)) {
    const displaySrc = proxySnapSrc || cam.snapshot_url || cam.thumbnail_url;
    return (
      <div className="w-full h-full relative flex items-center justify-center" style={{ background: "#0a0f18" }}>
        {displaySrc && <img src={displaySrc} alt={cam.name} className="max-w-full max-h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded" style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(6,182,212,0.2)" }}>
          <ImageIcon className="h-3 w-3 text-cyan-400" />
          <span className="text-[8px] text-cyan-400 font-mono font-bold">SNAPSHOT #{snapTick}</span>
        </div>
      </div>
    );
  }

  if (isMjpeg && (cam.stream_url || cam.snapshot_url)) {
    return (
      <div className="w-full h-full relative flex items-center justify-center" style={{ background: "#0a0f18" }}>
        <img src={(cam.stream_url || cam.snapshot_url)!} alt={cam.name} className="max-w-full max-h-full object-contain" />
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded" style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(139,92,246,0.3)" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-[8px] text-purple-400 font-mono font-bold">MJPEG STREAM</span>
        </div>
      </div>
    );
  }

  if (isRtsp) {
    const rawUrl = cam.stream_url || cam.embed_url;
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-3" style={{ background: "#0a0f18" }}>
        <Video className="h-10 w-10 text-amber-500" />
        <div className="text-[10px] text-amber-400 font-mono font-bold">RTSP STREAM</div>
        <div className="text-[8px] text-gray-600 font-mono">Requires proxy conversion</div>
        {rawUrl && (
          <button onClick={() => navigator.clipboard.writeText(rawUrl)}
            className="px-4 py-2 rounded text-[10px] text-white font-mono font-bold flex items-center gap-2 hover:bg-amber-500/20 transition-all"
            style={{ background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <Copy className="h-3.5 w-3.5" /> COPY RTSP URL
          </button>
        )}
      </div>
    );
  }

  if (embedUrl && verStatus !== "unsupported" && verStatus !== "blocked") {
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
        <iframe key={cam.id} src={embedUrl} className="w-full h-full border-0"
          allow="autoplay; fullscreen; encrypted-media; accelerometer; gyroscope; picture-in-picture"
          allowFullScreen onLoad={() => setEmbedState("ok")} onError={() => setEmbedState("blocked")}
          referrerPolicy={embedUrl.includes("youtube.com") || embedUrl.includes("youtu.be") ? "strict-origin-when-cross-origin" : "no-referrer"} />
        <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded" style={{ background: "rgba(0,0,0,0.7)", border: "1px solid rgba(99,102,241,0.3)" }}>
          <MonitorPlay className="h-3 w-3 text-indigo-400" />
          <span className="text-[8px] text-indigo-400 font-mono font-bold">EMBED</span>
        </div>
      </div>
    );
  }

  // ── UNAVAILABLE ──
  const rawUrl = cam.original_url || cam.embed_url || cam.stream_url || cam.snapshot_url;
  const badge = getVerificationBadge(verStatus);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3" style={{ background: "#0a0f18" }}>
      <Camera className="h-10 w-10 text-gray-700" />
      <div className="text-center">
        <div className="text-[10px] text-gray-400 font-mono font-bold">FEED UNAVAILABLE</div>
        <div className="text-[8px] font-mono mt-1 px-2 py-0.5 rounded" style={{ color: badge.color, background: badge.bg, border: `1px solid ${badge.border}` }}>
          {badge.icon} {badge.label}: {cam.verification_error || verStatus || "Unknown source type"}
        </div>
      </div>
      {rawUrl && (
        <button onClick={() => window.open(rawUrl, "_blank", "noopener,noreferrer")}
          className="px-4 py-2 rounded text-[10px] text-white font-mono font-bold flex items-center gap-2 hover:bg-cyan-500/20 transition-all"
          style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)" }}>
          <Eye className="h-3.5 w-3.5" /> VIEW EXTERNALLY
        </button>
      )}
    </div>
  );
}

// ═══════════════ CHANNEL LIST ITEM ═══════════════
function ChannelItem({ cam, isSelected, onClick }: { cam: CameraData; isSelected: boolean; onClick: () => void }) {
  const ytId = cam.youtube_video_id || extractYouTubeId(cam.embed_url || "");
  const thumbUrl = ytId ? getYouTubeThumbnail(ytId) : cam.thumbnail_url || cam.snapshot_url;
  const badge = getVerificationBadge(cam.verification_status);
  const isOnline = cam.status === "active";

  return (
    <button onClick={onClick}
      className={`w-full text-left flex gap-2 p-2 rounded-lg transition-all ${isSelected ? "ring-1 ring-cyan-500/40" : "hover:bg-white/[0.03]"}`}
      style={{ background: isSelected ? "rgba(6,182,212,0.08)" : "transparent", borderBottom: "1px solid rgba(6,182,212,0.05)" }}>
      {/* Thumbnail */}
      <div className="w-16 h-10 rounded overflow-hidden flex-shrink-0 relative" style={{ background: "#111827" }}>
        {thumbUrl ? (
          <img src={thumbUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Camera className="h-4 w-4 text-gray-700" /></div>
        )}
        {/* Status dot */}
        <span className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full border border-black/50 ${isOnline ? "bg-green-500" : "bg-red-500"}`} />
        {/* YouTube icon */}
        {ytId && <Youtube className="absolute bottom-0.5 left-0.5 h-3 w-3 text-red-500 drop-shadow" />}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[9px] font-bold text-gray-200 truncate">{cam.name}</div>
        <div className="flex items-center gap-1 mt-0.5">
          <Flag className="h-2 w-2 text-gray-600" />
          <span className="text-[8px] text-cyan-400/80 font-bold">{cam.country}</span>
          <span className="text-[7px] text-gray-600">• {cam.city}</span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[7px] px-1 py-0 rounded font-bold" style={{ color: badge.color, background: badge.bg, border: `1px solid ${badge.border}` }}>
            {badge.label}
          </span>
          <span className="text-[7px] text-gray-600 uppercase">{cam.category}</span>
        </div>
      </div>
    </button>
  );
}

// ═══════════════ MAIN COMPONENT ═══════════════
export const LiveCamerasModal = ({ onClose, onShowOnMap }: LiveCamerasModalProps) => {
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

  // Data Fetching
  const fetchCameras = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cameras", {
        method: "POST",
        body: {
          action: "list", country: selectedCountry, category: selectedCategory,
          source: selectedSource, status: selectedStatus, search: searchQuery, limit: 500,
        },
      });
      if (error) throw error;
      setCameras((data?.cameras as CameraData[]) || []);
    } catch (e) {
      console.error("Failed to fetch cameras:", e);
      setCameras([]);
    } finally { setLoading(false); }
  }, [selectedCountry, selectedCategory, selectedSource, selectedStatus, searchQuery]);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("cameras", { method: "POST", body: { action: "stats" } });
      if (error) throw error;
      setStats(data as Stats);
    } catch (e) { console.error("Failed to fetch stats:", e); }
  }, []);

  useEffect(() => { fetchCameras(); }, [fetchCameras]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (selectedCamera) setSelectedCamera(null); else onClose(); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, selectedCamera]);

  useEffect(() => {
    if (flyTarget) { const timer = setTimeout(() => setFlyTarget(null), 2000); return () => clearTimeout(timer); }
  }, [flyTarget]);

  // Actions
  const handleRegionSelect = (region: string) => { setSelectedRegion(region); setFlyTarget(REGIONS[region]); setSelectedCountry(null); };
  const handleCameraClick = (cam: CameraData) => { setSelectedCamera(cam); setRightPanelOpen(true); };

  const openCameraSource = (cam: CameraData) => {
    const ytId = cam.youtube_video_id || extractYouTubeId(cam.embed_url || cam.stream_url || "");
    if (ytId) { window.open(`https://www.youtube.com/watch?v=${ytId}`, "_blank", "noopener,noreferrer"); return; }
    const rawUrl = cam.original_url || cam.embed_url || cam.stream_url || cam.snapshot_url;
    if (rawUrl) window.open(rawUrl, "_blank", "noopener,noreferrer");
  };

  const scrapeAggregators = async () => {
    setScraping(true);
    try { await supabase.functions.invoke("cameras", { method: "POST", body: { action: "scrape_aggregators", country: selectedCountry } }); await Promise.all([fetchCameras(), fetchStats()]); }
    catch (e) { console.error("Scrape failed:", e); } finally { setScraping(false); }
  };

  const discoverMore = async () => {
    setDiscovering(true);
    try { await supabase.functions.invoke("cameras", { method: "POST", body: { action: "discover", country: selectedCountry || "worldwide" } }); await Promise.all([fetchCameras(), fetchStats()]); }
    catch (e) { console.error("Discovery failed:", e); } finally { setDiscovering(false); }
  };

  const runHealthCheck = async () => {
    setCheckingHealth(true);
    try { await supabase.functions.invoke("cameras", { method: "POST", body: { action: "health_check" } }); await Promise.all([fetchCameras(), fetchStats()]); }
    catch (e) { console.error("Health check failed:", e); } finally { setCheckingHealth(false); }
  };

  // Computed
  const sortedCountries = useMemo(() => {
    if (!stats?.byCountry) return [];
    return Object.entries(stats.byCountry).sort((a, b) => b[1].total - a[1].total);
  }, [stats]);

  // Group cameras by country for channel list
  const camerasByCountry = useMemo(() => {
    const map: Record<string, CameraData[]> = {};
    cameras.forEach(c => { if (!map[c.country]) map[c.country] = []; map[c.country].push(c); });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [cameras]);

  // ═══════════════ RENDER ═══════════════
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex flex-col" style={{ background: "#080c12", fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
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
              className={`px-1.5 py-1 rounded text-[8px] font-bold tracking-wider transition-all ${selectedRegion === region ? "text-cyan-300" : "text-gray-600 hover:text-gray-400"}`}
              style={selectedRegion === region ? { background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)" } : { border: "1px solid transparent" }}>
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
            style={{ background: "#111827", border: "1px solid rgba(6,182,212,0.15)" }} />
        </div>

        {/* Status Filters */}
        <div className="flex items-center gap-1 ml-1">
          <button onClick={() => setSelectedStatus(selectedStatus === "online" ? null : "online")}
            className={`px-1.5 py-1 rounded text-[8px] font-bold flex items-center gap-1 transition-all ${selectedStatus === "online" ? "text-white" : "text-white/60 hover:text-white"}`}
            style={selectedStatus === "online" ? { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" } : { border: "1px solid transparent" }}>
            <Wifi className="h-3 w-3" /> ONLINE
          </button>
          <button onClick={() => setSelectedStatus(selectedStatus === "offline" ? null : "offline")}
            className={`px-1.5 py-1 rounded text-[8px] font-bold flex items-center gap-1 transition-all ${selectedStatus === "offline" ? "text-white" : "text-white/60 hover:text-white"}`}
            style={selectedStatus === "offline" ? { background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)" } : { border: "1px solid transparent" }}>
            <WifiOff className="h-3 w-3" /> OFFLINE
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto">
          <button onClick={scrapeAggregators} disabled={scraping}
            className="px-2 py-1 rounded text-[8px] font-bold flex items-center gap-1 text-white hover:text-white transition-all"
            style={{ background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)" }}>
            <Globe className={`h-3 w-3 ${scraping ? "animate-spin" : ""}`} /> {scraping ? "SCRAPING..." : "SCRAPE"}
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

        {/* ── LEFT PANEL: Filters ── */}
        {leftPanelOpen && (
          <div className="w-56 flex flex-col overflow-hidden flex-shrink-0 cctv-scrollbar" style={{ borderRight: "1px solid rgba(6,182,212,0.12)", background: "#0a0f18ee" }}>
            {/* Stats */}
            <div className="p-3" style={{ borderBottom: "1px solid rgba(6,182,212,0.08)" }}>
              <div className="text-[8px] text-cyan-500/50 tracking-[0.2em] mb-2">GLOBAL OVERVIEW</div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: "TOTAL", value: stats?.total || cameras.length, color: "text-white" },
                  { label: "ONLINE", value: stats?.online || 0, color: "text-green-400" },
                  { label: "OFFLINE", value: stats?.offline || 0, color: "text-red-400" },
                  { label: "YOUTUBE", value: stats?.youtubeCount || 0, color: "text-red-400" },
                ].map(s => (
                  <div key={s.label} className="rounded p-1.5 text-center" style={{ background: "#111827" }}>
                    <div className={`text-sm font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-[7px] text-gray-600">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Verification Stats */}
            {stats?.byVerification && (
              <div className="p-3" style={{ borderBottom: "1px solid rgba(6,182,212,0.08)" }}>
                <div className="text-[8px] text-cyan-500/50 tracking-[0.2em] mb-1.5">SOURCE TYPES</div>
                <div className="space-y-0.5">
                  {Object.entries(stats.byVerification).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
                    const b = getVerificationBadge(status);
                    return (
                      <div key={status} className="flex items-center justify-between px-1.5 py-1 rounded text-[8px]" style={{ background: "#111827" }}>
                        <span style={{ color: b.color }}>{b.icon} {b.label}</span>
                        <span className="font-bold" style={{ color: b.color }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Categories */}
            <div className="p-3" style={{ borderBottom: "1px solid rgba(6,182,212,0.08)" }}>
              <div className="text-[8px] text-cyan-500/50 tracking-[0.2em] mb-1.5">CATEGORIES</div>
              <div className="flex flex-wrap gap-1">
                <button onClick={() => setSelectedCategory(null)}
                  className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-all ${!selectedCategory ? "text-cyan-300" : "text-gray-600 hover:text-gray-400"}`}
                  style={!selectedCategory ? { background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.25)" } : { border: "1px solid rgba(55,65,81,0.5)" }}>ALL</button>
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
              <div className="text-[8px] text-cyan-500/50 tracking-[0.2em] mb-1.5">COUNTRIES</div>
              <div className="space-y-0.5">
                {sortedCountries.map(([country, data]) => (
                  <button key={country} onClick={() => setSelectedCountry(selectedCountry === country ? null : country)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[9px] transition-all ${selectedCountry === country ? "text-cyan-300" : "text-gray-500 hover:text-gray-300"}`}
                    style={selectedCountry === country ? { background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.2)" } : { border: "1px solid transparent" }}>
                    <span className="truncate flex items-center gap-1.5"><Flag className="h-2.5 w-2.5" />{country}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-green-500/70 text-[8px]">{data.online}</span>
                      <span className="text-gray-700">/</span>
                      <span className="font-bold" style={{ background: "#111827", padding: "1px 5px", borderRadius: "3px" }}>{data.total}</span>
                    </div>
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
            <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" opacity={0.6} />
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png" opacity={0.8} />
            <MapEventHandler onMoveEnd={() => {}} />
            <FlyToHandler target={flyTarget} />
            <MapZoomControls />

            {cameras.map(cam => {
              if (!cam.lat || !cam.lng) return null;
              const isSelected = selectedCamera?.id === cam.id;
              const isOnline = cam.status === "active";
              const ytId = cam.youtube_video_id || extractYouTubeId(cam.embed_url || "");
              const borderColor = ytId ? "#ef4444" : isOnline ? "#22c55e" : "#ef4444";
              const glowColor = ytId ? "rgba(239,68,68,0.4)" : isOnline ? "rgba(34,197,94,0.5)" : "rgba(239,68,68,0.4)";
              const size = isSelected ? 56 : 44;

              const thumbUrl = ytId ? getYouTubeThumbnail(ytId) : cam.thumbnail_url || cam.snapshot_url || null;

              const icon = L.divIcon({
                className: "",
                html: `<div style="position:relative;width:${size}px;height:${size + 14}px;cursor:pointer;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.7));">
                  ${thumbUrl
                    ? `<div style="width:${size}px;height:${size * 0.62}px;border-radius:6px 6px 0 0;overflow:hidden;border:2px solid ${isSelected ? '#06b6d4' : borderColor};border-bottom:none;box-shadow:0 0 12px ${glowColor};">
                        <img src="${thumbUrl}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#111827;font-size:16px;\\'>📹</div>'" />
                        ${ytId ? '<div style="position:absolute;top:2px;left:2px;background:rgba(239,68,68,0.9);border-radius:3px;padding:0 3px;"><span style="font-size:7px;color:white;font-weight:900;">▶ YT</span></div>' : ''}
                      </div>
                      <div style="width:${size}px;height:16px;border-radius:0 0 6px 6px;background:${isSelected ? 'rgba(6,182,212,0.9)' : 'rgba(10,15,24,0.95)'};border:2px solid ${isSelected ? '#06b6d4' : borderColor};border-top:none;display:flex;align-items:center;justify-content:center;gap:3px;">
                        <span style="width:5px;height:5px;border-radius:50%;background:${isOnline ? '#22c55e' : '#ef4444'};${isOnline ? 'animation:pulse 2s infinite;' : ''}"></span>
                        <span style="font-size:7px;font-weight:800;color:${isSelected ? '#fff' : '#9ca3af'};font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:${size - 20}px;">${cam.city}</span>
                      </div>`
                    : `<div style="width:${size}px;height:${size * 0.62 + 16}px;border-radius:6px;background:rgba(10,15,24,0.9);border:2px solid ${isSelected ? '#06b6d4' : borderColor};box-shadow:0 0 12px ${glowColor};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;">
                        <span style="font-size:18px;">📹</span>
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
                        {ytId && " • YouTube"}
                      </div>
                      <div style={{ fontSize: 9, color: "#6b7280", marginTop: 1 }}>{cam.source_name} • {cam.category}</div>
                    </div>
                  </Tooltip>
                </Marker>
              );
            })}
          </MapContainer>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 z-[5] flex items-center gap-2">
            <div className="rounded px-3 py-1.5 flex items-center gap-3" style={{ background: "rgba(10,15,24,0.9)", border: "1px solid rgba(6,182,212,0.15)" }}>
              {[
                { color: "#22c55e", label: "ONLINE" },
                { color: "#ef4444", label: "OFFLINE/YT" },
                { color: "#f59e0b", label: "UNKNOWN" },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                  <span className="text-[8px] text-gray-500">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Feed Count */}
          <div className="absolute top-3 right-3 z-[5]">
            <div className="rounded px-3 py-1.5" style={{ background: "rgba(10,15,24,0.9)", border: "1px solid rgba(6,182,212,0.15)" }}>
              <span className="text-[8px] text-gray-500">FEEDS: </span>
              <span className="text-sm font-bold text-cyan-400">{cameras.length}</span>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: Camera Detail + Channel List ── */}
        {rightPanelOpen && (
          <div className="w-80 flex flex-col overflow-hidden flex-shrink-0 cctv-scrollbar" style={{ borderLeft: "1px solid rgba(6,182,212,0.12)", background: "#0a0f18ee" }}>
            {selectedCamera ? (
              <>
                {/* Camera Detail Header */}
                <div className="p-3" style={{ borderBottom: "1px solid rgba(6,182,212,0.08)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[8px] text-cyan-500/50 tracking-[0.2em]">CAMERA FEED</div>
                    <button onClick={() => setSelectedCamera(null)} className="p-1 hover:bg-white/5 rounded">
                      <X className="h-3 w-3 text-gray-500" />
                    </button>
                  </div>
                  <div className="text-xs font-bold text-white">{selectedCamera.name}</div>
                  <div className="text-[9px] text-gray-400 mt-0.5">{selectedCamera.city}, {selectedCamera.country}</div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded flex items-center gap-1 font-bold ${selectedCamera.status === "active" ? "text-green-400" : "text-red-400"}`}
                      style={{ background: selectedCamera.status === "active" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", border: `1px solid ${selectedCamera.status === "active" ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}` }}>
                      <span className={`w-1.5 h-1.5 rounded-full ${selectedCamera.status === "active" ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
                      {selectedCamera.status === "active" ? "ONLINE" : "OFFLINE"}
                    </span>
                    {(() => { const b = getVerificationBadge(selectedCamera.verification_status); return (
                      <span className="text-[8px] px-1.5 py-0.5 rounded font-bold" style={{ color: b.color, background: b.bg, border: `1px solid ${b.border}` }}>
                        {b.icon} {b.label}
                      </span>
                    ); })()}
                    <span className="text-[8px] px-1.5 py-0.5 rounded text-gray-400 uppercase font-bold" style={{ background: "#111827", border: "1px solid rgba(55,65,81,0.5)" }}>
                      {selectedCamera.category}
                    </span>
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
                    {selectedCamera.youtube_video_id ? <Youtube className="h-3 w-3 text-red-400" /> : <ExternalLink className="h-3 w-3" />}
                    {selectedCamera.youtube_video_id ? "YOUTUBE" : "OPEN LIVE"}
                  </button>
                  <button onClick={() => { const url = selectedCamera.original_url || selectedCamera.embed_url || selectedCamera.stream_url || ""; navigator.clipboard.writeText(url); }}
                    className="flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[8px] text-gray-400 font-bold hover:bg-white/5 transition-all"
                    style={{ background: "#111827", border: "1px solid rgba(55,65,81,0.5)" }}>
                    <Copy className="h-3 w-3" /> COPY
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

                {/* Admin Diagnostics */}
                <div className="p-2" style={{ borderBottom: "1px solid rgba(6,182,212,0.08)" }}>
                  <div className="text-[7px] text-cyan-500/40 tracking-[0.2em] mb-1">DIAGNOSTICS</div>
                  <div className="space-y-0.5 text-[8px] font-mono">
                    <div className="flex justify-between"><span className="text-gray-600">Source Type</span><span className="text-gray-400">{selectedCamera.stream_type_detected || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Verification</span><span className="text-gray-400">{selectedCamera.verification_status || "pending"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">YouTube ID</span><span className="text-gray-400">{selectedCamera.youtube_video_id || "—"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-600">Verified</span><span className={selectedCamera.is_verified ? "text-green-400" : "text-gray-600"}>{selectedCamera.is_verified ? "YES" : "NO"}</span></div>
                    {selectedCamera.original_url && (
                      <div className="mt-1"><span className="text-gray-600">URL: </span><span className="text-gray-500 break-all text-[7px]">{selectedCamera.original_url.substring(0, 60)}...</span></div>
                    )}
                  </div>
                </div>

                {/* Channel list below selected camera */}
                <div className="flex-1 overflow-y-auto cctv-scrollbar">
                  <div className="p-2">
                    <div className="text-[8px] text-cyan-500/50 tracking-[0.2em] mb-1.5">ALL CHANNELS</div>
                  </div>
                  {camerasByCountry.map(([country, cams]) => (
                    <div key={country}>
                      <div className="px-3 py-1 flex items-center gap-1.5 sticky top-0" style={{ background: "#0d1320", borderBottom: "1px solid rgba(6,182,212,0.06)" }}>
                        <Flag className="h-2.5 w-2.5 text-cyan-500/60" />
                        <span className="text-[8px] font-bold text-cyan-400/80 tracking-wider">{country}</span>
                        <span className="text-[7px] text-gray-600 ml-auto">{cams.length}</span>
                      </div>
                      {cams.map(c => (
                        <ChannelItem key={c.id} cam={c} isSelected={selectedCamera?.id === c.id} onClick={() => handleCameraClick(c)} />
                      ))}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* Channel List (no camera selected) */
              <div className="flex flex-col h-full">
                <div className="p-3" style={{ borderBottom: "1px solid rgba(6,182,212,0.08)" }}>
                  <div className="text-[8px] text-cyan-500/50 tracking-[0.2em]">📺 CAMERA CHANNELS ({cameras.length})</div>
                </div>
                <div className="flex-1 overflow-y-auto cctv-scrollbar">
                  {camerasByCountry.map(([country, cams]) => (
                    <div key={country}>
                      <div className="px-3 py-1.5 flex items-center gap-1.5 sticky top-0 z-[2]" style={{ background: "#0d1320", borderBottom: "1px solid rgba(6,182,212,0.06)" }}>
                        <Flag className="h-2.5 w-2.5 text-cyan-500/60" />
                        <span className="text-[9px] font-bold text-cyan-400/80 tracking-wider">{country}</span>
                        <span className="text-[8px] text-gray-600 ml-auto">{cams.length} cams</span>
                      </div>
                      {cams.map(c => (
                        <ChannelItem key={c.id} cam={c} isSelected={false} onClick={() => handleCameraClick(c)} />
                      ))}
                    </div>
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
          <div className="flex items-center gap-1.5"><Activity className="h-3 w-3 text-green-500" /><span className="text-[8px] text-gray-500">SYSTEM OPERATIONAL</span></div>
          <div className="flex items-center gap-1.5"><Signal className="h-3 w-3 text-cyan-400" /><span className="text-[8px] text-gray-500">FEEDS: {stats?.total || cameras.length} • ACTIVE: {stats?.online || 0} • YT: {stats?.youtubeCount || 0}</span></div>
          <div className="flex items-center gap-1.5"><Layers className="h-3 w-3 text-cyan-400" /><span className="text-[8px] text-gray-500">COUNTRIES: {sortedCountries.length}</span></div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[8px] text-gray-700">OSINT COMPLIANT • ESC TO CLOSE</span>
        </div>
      </div>
    </div>,
    document.body
  );
};
