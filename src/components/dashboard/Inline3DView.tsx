import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Globe, Compass, MapPin, Maximize2, RotateCcw, PanelLeftOpen, PanelLeftClose } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { WeatherRadarOverlay } from "./urban3d/WeatherRadarOverlay";
import { LiveIncidentsOverlay } from "./urban3d/LiveIncidentsOverlay";
import { GeoAnalysisToolsPanel } from "./GeoAnalysisToolsPanel";
import { TelemetryPanel } from "./TelemetryPanel";

interface Inline3DViewProps {
  lat: number;
  lng: number;
  onClose: () => void;
}

export const Inline3DView = ({ lat, lng, onClose }: Inline3DViewProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [heading, setHeading] = useState(0);
  const [tilt, setTilt] = useState(60);
  const [zoom, setZoom] = useState(18);
  const [weatherEnabled, setWeatherEnabled] = useState(false);
  const [incidentsEnabled, setIncidentsEnabled] = useState(true);
  const [toolsPanelOpen, setToolsPanelOpen] = useState(true);

  // Fetch Google Maps API key
  useEffect(() => {
    const fetchKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("google-maps-key");
        if (!error && data?.apiKey) {
          setApiKey(data.apiKey);
        }
      } catch (e) {
        console.error("Failed to fetch Google Maps key:", e);
      }
    };
    fetchKey();
  }, []);

  // Load Google Maps script and create map
  useEffect(() => {
    if (!apiKey || !mapContainerRef.current) return;

    const google = (window as any).google;
    if (google?.maps) {
      initMap(google);
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      const checkInterval = setInterval(() => {
        const g = (window as any).google;
        if (g?.maps) {
          clearInterval(checkInterval);
          initMap(g);
        }
      }, 100);
      return () => clearInterval(checkInterval);
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=alpha&libraries=maps3d`;
    script.async = true;
    script.onload = () => {
      const g = (window as any).google;
      if (g?.maps) initMap(g);
    };
    document.head.appendChild(script);
  }, [apiKey, lat, lng]);

  const initMap = (google: any) => {
    if (!mapContainerRef.current) return;

    const map = new google.maps.Map(mapContainerRef.current, {
      center: { lat, lng },
      zoom: 18,
      mapTypeId: "satellite",
      tilt: 60,
      heading: 0,
      mapId: "WAROS_3D_MAP",
      disableDefaultUI: true,
      zoomControl: false,
      gestureHandling: "greedy",
      keyboardShortcuts: false,
    });

    mapRef.current = map;
    setLoading(false);

    map.addListener("heading_changed", () => setHeading(Math.round(map.getHeading() || 0)));
    map.addListener("tilt_changed", () => setTilt(Math.round(map.getTilt() || 0)));
    map.addListener("zoom_changed", () => setZoom(Math.round(map.getZoom() || 18)));

    new google.maps.Marker({
      position: { lat, lng },
      map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#ef4444",
        fillOpacity: 0.9,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
      title: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    });
  };

  const rotateView = () => {
    const map = mapRef.current;
    if (!map) return;
    map.setHeading((map.getHeading() || 0) + 90);
  };

  const resetView = () => {
    const map = mapRef.current;
    if (!map) return;
    map.setHeading(0);
    map.setTilt(60);
    map.setZoom(18);
    map.panTo({ lat, lng });
  };

  return (
  return createPortal(
    <div className="fixed inset-0 z-[99999] bg-background">
      {/* Map container */}
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Loading state */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-20">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] font-mono text-primary uppercase tracking-wider">Loading 3D View...</span>
          </div>
        </div>
      )}

      {/* Analysis Tools Panel */}
      {toolsPanelOpen && (
        <div className="absolute top-0 left-0 z-30 w-[252px] h-full overflow-y-auto bg-[hsl(220,15%,5%)]/90 backdrop-blur-md border-r border-border/20 p-2 space-y-2 scrollbar-thin">
          <GeoAnalysisToolsPanel mapRef={mapRef} lat={lat} lng={lng} />
          <TelemetryPanel lat={lat} lng={lng} heading={heading} tilt={tilt} zoom={zoom} />
        </div>
      )}

      {/* BACK TO GLOBE + Panel toggle */}
      <div className={`absolute top-4 z-30 flex items-center gap-2 ${toolsPanelOpen ? "left-[268px]" : "left-4"} transition-all`}>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-3 py-2 rounded-sm bg-background/85 backdrop-blur-md border border-primary/40 text-primary hover:bg-primary/15 hover:border-primary/60 transition-all group"
        >
          <Globe className="h-4 w-4 group-hover:scale-110 transition-transform" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Back to Globe</span>
        </button>
        <button
          onClick={() => setToolsPanelOpen(!toolsPanelOpen)}
          className="w-8 h-8 flex items-center justify-center rounded-sm bg-background/80 backdrop-blur border border-border/30 text-muted-foreground hover:text-primary hover:border-primary/40 transition-all"
          title={toolsPanelOpen ? "Hide tools" : "Show tools"}
        >
          {toolsPanelOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-14 z-20 flex items-center gap-1">
        <button onClick={rotateView} className="w-8 h-8 flex items-center justify-center rounded-sm bg-background/80 backdrop-blur border border-border/30 text-muted-foreground hover:text-primary hover:border-primary/40 transition-all" title="Rotate 90°">
          <RotateCcw className="h-3.5 w-3.5" />
        </button>
        <button onClick={resetView} className="w-8 h-8 flex items-center justify-center rounded-sm bg-background/80 backdrop-blur border border-border/30 text-muted-foreground hover:text-primary hover:border-primary/40 transition-all" title="Reset view">
          <Maximize2 className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setWeatherEnabled(!weatherEnabled)} className={`w-8 h-8 flex items-center justify-center rounded-sm backdrop-blur border transition-all ${weatherEnabled ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400" : "bg-background/80 border-border/30 text-muted-foreground hover:text-primary hover:border-primary/40"}`} title="Weather Radar">
          <span className="text-[10px]">🌧</span>
        </button>
        <button onClick={() => setIncidentsEnabled(!incidentsEnabled)} className={`w-8 h-8 flex items-center justify-center rounded-sm backdrop-blur border transition-all ${incidentsEnabled ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-background/80 border-border/30 text-muted-foreground hover:text-primary hover:border-primary/40"}`} title="Live Incidents">
          <span className="text-[10px]">⚠️</span>
        </button>
      </div>

      {/* Coordinate HUD */}
      <div className="absolute bottom-4 right-4 z-20">
        <div className="bg-background/85 backdrop-blur-md border border-primary/25 rounded-sm px-3 py-2" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="h-3 w-3 text-primary" />
            <span className="text-[9px] font-mono font-bold text-primary uppercase">3D Recon View</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[8px] font-mono">
            <span className="text-muted-foreground">LAT</span>
            <span className="text-foreground">{lat.toFixed(5)}°</span>
            <span className="text-muted-foreground">LNG</span>
            <span className="text-foreground">{lng.toFixed(5)}°</span>
            <span className="text-muted-foreground">HDG</span>
            <span className="text-foreground">{heading}°</span>
            <span className="text-muted-foreground">TILT</span>
            <span className="text-foreground">{tilt}°</span>
            <span className="text-muted-foreground">ZOOM</span>
            <span className="text-foreground">{zoom}</span>
          </div>
        </div>
      </div>

      {/* Mode indicator */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-background/80 backdrop-blur-md border border-primary/30">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <Compass className="h-3 w-3 text-primary" />
          <span className="text-[9px] font-mono font-bold text-primary uppercase tracking-wider">Photorealistic 3D</span>
          <span className="text-[8px] font-mono text-muted-foreground">•</span>
          <span className="text-[8px] font-mono text-muted-foreground">{lat.toFixed(2)}°N {lng.toFixed(2)}°E</span>
        </div>
      </div>

      {/* Bottom info bar */}
      <div className={`absolute bottom-4 z-20 ${toolsPanelOpen ? "left-[268px]" : "left-4"} transition-all`}>
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-sm bg-background/80 backdrop-blur-md border border-border/30">
          <div className="flex items-center gap-1.5 text-[8px] font-mono">
            <span className="text-muted-foreground">BEARING</span>
            <span className="text-foreground">{heading}°</span>
          </div>
          <div className="w-px h-3 bg-border/40" />
          <div className="flex items-center gap-1.5 text-[8px] font-mono">
            <span className="text-muted-foreground">MGRS</span>
            <span className="text-foreground">{simpleMGRS(lat, lng)}</span>
          </div>
          <div className="w-px h-3 bg-border/40" />
          <div className="flex items-center gap-1.5 text-[8px] font-mono">
            <span className="text-muted-foreground">ALT</span>
            <span className="text-foreground">~{Math.round(50 + Math.abs(lat * 3))}m</span>
          </div>
        </div>
      </div>

      {/* Overlays */}
      <WeatherRadarOverlay mapRef={mapRef} enabled={weatherEnabled} opacity={0.7} />
      <LiveIncidentsOverlay mapRef={mapRef} enabled={incidentsEnabled} lat={lat} lng={lng} />
    </div>,
    document.body,
  );
};

function simpleMGRS(lat: number, lng: number): string {
  const zoneNum = Math.floor((lng + 180) / 6) + 1;
  const letters = "CDEFGHJKLMNPQRSTUVWX";
  const latBand = letters[Math.floor((lat + 80) / 8)] || "X";
  return `${zoneNum}${latBand}`;
}
