import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Search, Camera, MapPin, ExternalLink, RefreshCw, AlertTriangle, Video, Eye, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface CameraData {
  id: string;
  country: string;
  city: string;
  name: string;
  category: string;
  source_type: string;
  source_name: string;
  stream_url: string | null;
  snapshot_url: string | null;
  embed_url: string | null;
  thumbnail_url: string | null;
  lat: number;
  lng: number;
  is_active: boolean;
  status: string;
  error_message: string | null;
}

interface LiveCamerasModalProps {
  onClose: () => void;
  onShowOnMap?: (lat: number, lng: number, name: string) => void;
}

const COUNTRIES = ["Jordan", "UAE", "Saudi Arabia", "Qatar", "Bahrain", "Oman", "Kuwait", "Iraq", "Lebanon", "Israel", "Egypt", "Turkey", "Iran"];
const CATEGORIES = ["traffic", "tourism", "ports", "weather", "public"];

export const LiveCamerasModal = ({ onClose, onShowOnMap }: LiveCamerasModalProps) => {
  const [cameras, setCameras] = useState<CameraData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCamera, setSelectedCamera] = useState<CameraData | null>(null);
  const [embedError, setEmbedError] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const fetchCameras = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: "list" });
      if (selectedCountry) params.set("country", selectedCountry);
      if (selectedCategory) params.set("category", selectedCategory);
      if (searchQuery) params.set("search", searchQuery);

      const { data, error } = await supabase.functions.invoke("cameras", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        body: null,
      });

      // Fallback: query directly
      let query = supabase.from("cameras" as any).select("*").eq("is_active", true).order("country").order("city");
      if (selectedCountry) query = query.eq("country", selectedCountry);
      if (selectedCategory) query = query.eq("category", selectedCategory);
      if (searchQuery) query = query.or(`name.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%`);

      const result = await query;
      setCameras((result.data as any[]) || []);
    } catch (e) {
      console.error("Failed to fetch cameras:", e);
    } finally {
      setLoading(false);
    }
  }, [selectedCountry, selectedCategory, searchQuery]);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleShowOnMap = (cam: CameraData) => {
    if (onShowOnMap && cam.lat && cam.lng) {
      onShowOnMap(cam.lat, cam.lng, cam.name);
    }
  };

  const renderViewer = () => {
    if (!selectedCamera) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
          <Video className="h-12 w-12 opacity-30" />
          <span className="text-sm font-mono">SELECT A CAMERA TO VIEW</span>
        </div>
      );
    }

    const cam = selectedCamera;

    if (cam.source_type === "embed_page" && cam.embed_url && !embedError) {
      const isYouTube = cam.embed_url.includes("youtube.com/embed");
      return (
        <div className="relative w-full h-full">
          <iframe
            src={cam.embed_url}
            className="w-full h-full rounded-md border border-border"
            allow="autoplay; fullscreen; encrypted-media; accelerometer; gyroscope; picture-in-picture"
            allowFullScreen
            onError={() => setEmbedError(true)}
            {...(!isYouTube ? { sandbox: "allow-scripts allow-same-origin allow-popups" } : {})}
            referrerPolicy="no-referrer"
          />
          <a
            href={cam.embed_url}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-2 bg-card/90 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-primary hover:bg-primary/20 border border-border flex items-center gap-1"
          >
            <ExternalLink className="h-3 w-3" /> OPEN SOURCE
          </a>
        </div>
      );
    }

    if (cam.source_type === "snapshot" && cam.snapshot_url) {
      return (
        <div className="relative w-full h-full flex items-center justify-center bg-black/50 rounded-md">
          <img
            src={cam.snapshot_url}
            alt={cam.name}
            className="max-w-full max-h-full object-contain rounded"
            onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
          />
          <div className="absolute top-2 right-2 bg-destructive/80 px-2 py-0.5 rounded text-[9px] font-mono text-white">
            SNAPSHOT
          </div>
        </div>
      );
    }

    if (cam.source_type === "hls" && cam.stream_url) {
      return (
        <div className="relative w-full h-full flex flex-col items-center justify-center gap-3">
          <video
            src={cam.stream_url}
            autoPlay
            muted
            controls
            className="w-full h-full rounded-md bg-black"
            onError={() => setEmbedError(true)}
          />
        </div>
      );
    }

    // Fallback
    const fallbackUrl = cam.embed_url || cam.stream_url || cam.snapshot_url;
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <AlertTriangle className="h-10 w-10 text-warning" />
        <span className="text-sm font-mono text-center">EMBED BLOCKED OR UNAVAILABLE</span>
        {fallbackUrl && (
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/40 rounded-md text-primary text-sm font-mono flex items-center gap-2 transition-colors"
          >
            <ExternalLink className="h-4 w-4" /> OPEN LIVE SOURCE
          </a>
        )}
      </div>
    );
  };

  const groupedByCountry: Record<string, CameraData[]> = {};
  cameras.forEach((c) => {
    if (!groupedByCountry[c.country]) groupedByCountry[c.country] = [];
    groupedByCountry[c.country].push(c);
  });

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-[95vw] h-[90vh] max-w-[1600px] bg-card border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-background/80">
          <div className="flex items-center gap-3">
            <Camera className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-bold font-mono text-foreground tracking-wider">CCTV / LIVE CAMERAS</h2>
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
              {cameras.length} FEEDS
            </span>
            <span className="text-[10px] font-mono text-success bg-success/10 px-2 py-0.5 rounded">
              PUBLIC OSINT ONLY
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchCameras}
              className="p-1.5 rounded hover:bg-muted transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`h-4 w-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-destructive/20 transition-colors">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Filters Bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background/50 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {/* Category pills */}
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold transition-all ${
              !selectedCategory ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            ALL
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`px-2.5 py-1 rounded text-[10px] font-mono font-semibold uppercase transition-all ${
                selectedCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat}
            </button>
          ))}
          <div className="ml-auto relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search cameras..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-3 py-1.5 bg-muted border border-border rounded text-xs font-mono text-foreground placeholder:text-muted-foreground w-48 focus:outline-none focus:border-primary/50"
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Country chips */}
          <div className="w-40 border-r border-border bg-background/30 overflow-y-auto p-2 flex flex-col gap-1">
            <button
              onClick={() => setSelectedCountry(null)}
              className={`w-full text-left px-3 py-2 rounded text-[11px] font-mono font-semibold transition-all ${
                !selectedCountry ? "bg-primary/20 text-primary border border-primary/30" : "text-muted-foreground hover:bg-muted/50 border border-transparent"
              }`}
            >
              🌍 ALL REGIONS
            </button>
            {COUNTRIES.map((c) => {
              const count = cameras.filter((cam) => cam.country === c).length;
              return (
                <button
                  key={c}
                  onClick={() => setSelectedCountry(selectedCountry === c ? null : c)}
                  className={`w-full text-left px-3 py-1.5 rounded text-[11px] font-mono transition-all flex justify-between items-center ${
                    selectedCountry === c
                      ? "bg-primary/20 text-primary border border-primary/30"
                      : "text-muted-foreground hover:bg-muted/50 border border-transparent"
                  }`}
                >
                  <span>{c}</span>
                  {count > 0 && (
                    <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Middle: Camera list */}
          <div className="w-80 border-r border-border overflow-y-auto bg-background/20">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <RefreshCw className="h-6 w-6 text-primary animate-spin" />
              </div>
            ) : cameras.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-4">
                <Camera className="h-8 w-8 opacity-30" />
                <span className="text-xs font-mono text-center">NO CAMERAS FOUND</span>
                <span className="text-[10px] text-center">Try adjusting filters or add cameras via admin panel</span>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {cameras.map((cam) => (
                  <button
                    key={cam.id}
                    onClick={() => { setSelectedCamera(cam); setEmbedError(false); }}
                    className={`w-full text-left p-3 hover:bg-muted/30 transition-all ${
                      selectedCamera?.id === cam.id ? "bg-primary/10 border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-mono font-semibold text-foreground truncate">{cam.name}</div>
                        <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
                          {cam.city}, {cam.country}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded uppercase ${
                            cam.status === "active" ? "bg-success/20 text-success" :
                            cam.status === "error" ? "bg-destructive/20 text-destructive" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {cam.status}
                          </span>
                          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                            {cam.category}
                          </span>
                          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                            {cam.source_type}
                          </span>
                        </div>
                      </div>
                      {cam.thumbnail_url && (
                        <img
                          src={cam.thumbnail_url}
                          alt=""
                          className="w-16 h-10 object-cover rounded border border-border flex-shrink-0"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      )}
                    </div>
                    {cam.lat !== 0 && cam.lng !== 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleShowOnMap(cam); }}
                        className="mt-1.5 flex items-center gap-1 text-[9px] font-mono text-primary hover:text-primary/80 transition-colors"
                      >
                        <MapPin className="h-3 w-3" /> SHOW ON MAP
                      </button>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Viewer */}
          <div className="flex-1 bg-black/30 p-3 flex flex-col">
            {selectedCamera && (
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-mono font-bold text-foreground">{selectedCamera.name}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">
                    {selectedCamera.city}, {selectedCamera.country} • {selectedCamera.source_name || selectedCamera.source_type.toUpperCase()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedCamera.lat !== 0 && (
                    <button
                      onClick={() => handleShowOnMap(selectedCamera)}
                      className="px-2 py-1 bg-primary/20 hover:bg-primary/30 border border-primary/30 rounded text-[10px] font-mono text-primary flex items-center gap-1 transition-colors"
                    >
                      <MapPin className="h-3 w-3" /> MAP
                    </button>
                  )}
                  <div className="flex items-center gap-1">
                    <Eye className="h-3 w-3 text-success" />
                    <span className="text-[9px] font-mono text-success">LIVE</span>
                  </div>
                </div>
              </div>
            )}
            <div className="flex-1 rounded-md overflow-hidden">
              {renderViewer()}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-1.5 border-t border-border bg-background/60 flex items-center justify-between">
          <span className="text-[9px] font-mono text-muted-foreground">
            ⚠ PUBLIC SOURCES ONLY • NO UNAUTHORIZED CAMERAS • OSINT COMPLIANT
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">
            ESC TO CLOSE
          </span>
        </div>
      </div>
    </div>
  );
};
