import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X, MapPin, Globe, Radio, Signal, Shield, Eye,
  ExternalLink, Copy, Youtube, Camera, Wifi, WifiOff,
  Flag, Layers, Clock, Info
} from "lucide-react";

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

interface CameraDetailsPopupProps {
  camera: CameraData;
  onClose: () => void;
  onShowOnMap?: (lat: number, lng: number, name: string) => void;
}

const getVerificationBadge = (status: string | null | undefined) => {
  switch (status) {
    case "verified_youtube": return { label: "YOUTUBE LIVE", color: "#ef4444", bg: "rgba(239,68,68,0.12)", icon: "▶" };
    case "verified_hls": return { label: "HLS STREAM", color: "#22c55e", bg: "rgba(34,197,94,0.12)", icon: "◉" };
    case "verified_snapshot": return { label: "SNAPSHOT", color: "#06b6d4", bg: "rgba(6,182,212,0.12)", icon: "◎" };
    case "verified_mjpeg": return { label: "MJPEG", color: "#8b5cf6", bg: "rgba(139,92,246,0.12)", icon: "◉" };
    case "proxy_required": return { label: "RTSP PROXY", color: "#f59e0b", bg: "rgba(245,158,11,0.12)", icon: "⚡" };
    case "page_only": return { label: "EMBED PAGE", color: "#6366f1", bg: "rgba(99,102,241,0.12)", icon: "▣" };
    default: return { label: "PENDING", color: "#9ca3af", bg: "rgba(156,163,175,0.08)", icon: "?" };
  }
};

export const CameraDetailsPopup = ({ camera, onClose, onShowOnMap }: CameraDetailsPopupProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Initialize mini-map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    
    const initMap = async () => {
      const L = await import("leaflet");
      const map = L.map(mapRef.current!, {
        center: [camera.lat || 0, camera.lng || 0],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        touchZoom: false,
      });

      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { opacity: 0.8 }).addTo(map);
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", { opacity: 0.9 }).addTo(map);

      // Custom marker
      const isOnline = camera.status === "active";
      const markerIcon = L.divIcon({
        className: "",
        html: `<div style="position:relative;">
          <div style="width:40px;height:40px;border-radius:50%;background:${isOnline ? 'rgba(6,182,212,0.2)' : 'rgba(239,68,68,0.2)'};border:2px solid ${isOnline ? '#06b6d4' : '#ef4444'};display:flex;align-items:center;justify-content:center;box-shadow:0 0 20px ${isOnline ? 'rgba(6,182,212,0.4)' : 'rgba(239,68,68,0.4)'};">
            <div style="width:14px;height:14px;border-radius:50%;background:${isOnline ? '#06b6d4' : '#ef4444'};${isOnline ? 'animation:pulse 2s infinite;' : ''}"></div>
          </div>
          <div style="position:absolute;bottom:-8px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${isOnline ? '#06b6d4' : '#ef4444'};"></div>
        </div>`,
        iconSize: [40, 50],
        iconAnchor: [20, 50],
      });

      L.marker([camera.lat || 0, camera.lng || 0], { icon: markerIcon }).addTo(map);

      // Accuracy circle
      L.circle([camera.lat || 0, camera.lng || 0], {
        radius: 500,
        color: isOnline ? "#06b6d4" : "#ef4444",
        fillColor: isOnline ? "rgba(6,182,212,0.08)" : "rgba(239,68,68,0.08)",
        fillOpacity: 0.3,
        weight: 1,
        dashArray: "4 4",
      }).addTo(map);

      mapInstanceRef.current = map;
    };

    initMap();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [camera.lat, camera.lng, camera.status]);

  const badge = getVerificationBadge(camera.verification_status);
  const isOnline = camera.status === "active";
  const ytId = camera.youtube_video_id;
  const thumbUrl = ytId
    ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`
    : camera.thumbnail_url || camera.snapshot_url;

  const copyCoords = () => {
    navigator.clipboard.writeText(`${camera.lat}, ${camera.lng}`);
  };

  const openSource = () => {
    if (ytId) { window.open(`https://www.youtube.com/watch?v=${ytId}`, "_blank"); return; }
    const url = camera.original_url || camera.embed_url || camera.stream_url;
    if (url) window.open(url, "_blank");
  };

  return createPortal(
    <div className="fixed inset-0 z-[999999] flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      {/* Card */}
      <div
        className="relative w-[420px] max-w-[92vw] rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(180deg, #0d1320 0%, #080c14 100%)",
          border: "1px solid rgba(6,182,212,0.2)",
          boxShadow: "0 25px 80px rgba(0,0,0,0.7), 0 0 40px rgba(6,182,212,0.08)",
        }}
      >
        {/* Top scanline effect */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(6,182,212,0.1) 2px, rgba(6,182,212,0.1) 3px)",
        }} />

        {/* Header */}
        <div className="relative flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(6,182,212,0.12)" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
              background: isOnline ? "rgba(6,182,212,0.15)" : "rgba(239,68,68,0.15)",
              border: `1px solid ${isOnline ? "rgba(6,182,212,0.3)" : "rgba(239,68,68,0.3)"}`,
            }}>
              <Camera className="h-4 w-4" style={{ color: isOnline ? "#06b6d4" : "#ef4444" }} />
            </div>
            <div>
              <div className="text-[8px] tracking-[0.2em]" style={{ color: "rgba(6,182,212,0.5)" }}>CAMERA INTELLIGENCE</div>
              <div className="text-xs font-bold text-white">FEED DETAILS</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 transition-all" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Mini Map */}
        <div className="relative h-44" style={{ borderBottom: "1px solid rgba(6,182,212,0.12)" }}>
          <div ref={mapRef} className="w-full h-full" style={{ background: "#070b10" }} />
          {/* Coordinates overlay */}
          <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{
            background: "rgba(10,15,24,0.92)",
            border: "1px solid rgba(6,182,212,0.2)",
            backdropFilter: "blur(8px)",
          }}>
            <MapPin className="h-3 w-3 text-cyan-400" />
            <span className="text-[9px] font-mono font-bold text-cyan-300">{camera.lat?.toFixed(4)}, {camera.lng?.toFixed(4)}</span>
            <button onClick={copyCoords} className="ml-1 p-0.5 rounded hover:bg-white/10 transition-all" title="Copy coordinates">
              <Copy className="h-2.5 w-2.5 text-gray-500" />
            </button>
          </div>
          {/* Status badge on map */}
          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg" style={{
            background: "rgba(10,15,24,0.92)",
            border: `1px solid ${isOnline ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}>
            <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            <span className={`text-[8px] font-mono font-bold ${isOnline ? "text-green-400" : "text-red-400"}`}>
              {isOnline ? "ONLINE" : "OFFLINE"}
            </span>
          </div>
        </div>

        {/* Camera Info Card */}
        <div className="p-4 space-y-3">
          {/* Name & Location */}
          <div className="flex gap-3">
            {/* Thumbnail */}
            {thumbUrl && (
              <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{ border: "1px solid rgba(6,182,212,0.15)" }}>
                <img src={thumbUrl} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white leading-tight">{camera.name}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <Flag className="h-3 w-3 text-cyan-400/60" />
                <span className="text-[10px] text-cyan-400 font-bold">{camera.country}</span>
                <span className="text-[10px] text-gray-600">•</span>
                <span className="text-[10px] text-gray-400">{camera.city}</span>
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: <Globe className="h-3 w-3" />, label: "SOURCE", value: camera.source_name || "Unknown", color: "#06b6d4" },
              { icon: <Layers className="h-3 w-3" />, label: "CATEGORY", value: camera.category.toUpperCase(), color: "#8b5cf6" },
              { icon: <Signal className="h-3 w-3" />, label: "STREAM TYPE", value: badge.label, color: badge.color },
              { icon: <Radio className="h-3 w-3" />, label: "SOURCE TYPE", value: camera.source_type.toUpperCase(), color: "#f59e0b" },
            ].map((item, i) => (
              <div key={i} className="rounded-lg p-2.5" style={{ background: "rgba(17,24,39,0.6)", border: "1px solid rgba(6,182,212,0.08)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span style={{ color: item.color }}>{item.icon}</span>
                  <span className="text-[7px] tracking-[0.15em] text-gray-600">{item.label}</span>
                </div>
                <div className="text-[10px] font-bold text-gray-200 truncate">{item.value}</div>
              </div>
            ))}
          </div>

          {/* Coordinates Row */}
          <div className="rounded-lg p-2.5 flex items-center justify-between" style={{ background: "rgba(17,24,39,0.6)", border: "1px solid rgba(6,182,212,0.08)" }}>
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5 text-cyan-400" />
              <div>
                <div className="text-[7px] tracking-[0.15em] text-gray-600">EXACT COORDINATES</div>
                <div className="text-[11px] font-mono font-bold text-cyan-300">{camera.lat?.toFixed(6)}, {camera.lng?.toFixed(6)}</div>
              </div>
            </div>
            <button onClick={copyCoords} className="p-2 rounded-lg hover:bg-white/5 transition-all" style={{ border: "1px solid rgba(6,182,212,0.15)" }}>
              <Copy className="h-3.5 w-3.5 text-cyan-400" />
            </button>
          </div>

          {/* Last Checked */}
          {camera.last_checked_at && (
            <div className="flex items-center gap-2 px-2.5 py-1.5">
              <Clock className="h-3 w-3 text-gray-600" />
              <span className="text-[9px] text-gray-600">Last checked: {new Date(camera.last_checked_at).toLocaleString()}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            <button onClick={openSource}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-bold text-white transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: ytId ? "linear-gradient(135deg, #ef4444, #dc2626)" : "linear-gradient(135deg, #06b6d4, #0891b2)",
                boxShadow: ytId ? "0 4px 20px rgba(239,68,68,0.25)" : "0 4px 20px rgba(6,182,212,0.25)",
              }}>
              {ytId ? <Youtube className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {ytId ? "WATCH ON YOUTUBE" : "VIEW LIVE FEED"}
            </button>
            {onShowOnMap && camera.lat !== 0 && (
              <button onClick={() => { onShowOnMap(camera.lat, camera.lng, camera.name); onClose(); }}
                className="px-4 py-2.5 rounded-lg text-[10px] font-bold text-cyan-400 transition-all hover:bg-cyan-500/10"
                style={{ border: "1px solid rgba(6,182,212,0.3)" }}>
                <MapPin className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 flex items-center justify-between" style={{ borderTop: "1px solid rgba(6,182,212,0.08)", background: "rgba(10,15,24,0.5)" }}>
          <div className="flex items-center gap-1.5">
            <Shield className="h-3 w-3 text-cyan-500/40" />
            <span className="text-[7px] tracking-[0.15em] text-gray-700">OSINT INTELLIGENCE</span>
          </div>
          <span className="text-[7px] text-gray-700">ESC TO CLOSE</span>
        </div>
      </div>
    </div>,
    document.body
  );
};
