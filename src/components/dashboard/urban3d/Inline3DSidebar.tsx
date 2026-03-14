import { useCallback, useEffect, useRef, useState } from "react";
import { Globe, Layers, Radio, Circle, Radar, CloudRain, AlertTriangle, RefreshCw, Map as MapIcon, Route } from "lucide-react";

interface Inline3DSidebarProps {
  mapRef: React.MutableRefObject<any>;
  lat: number;
  lng: number;
  onClose: () => void;
  weatherEnabled: boolean;
  incidentsEnabled: boolean;
  onToggleWeather: () => void;
  onToggleIncidents: () => void;
}

type SidebarTab = "tools" | "layers" | "sources";

export const Inline3DSidebar = ({
  mapRef,
  lat,
  lng,
  onClose,
  weatherEnabled,
  incidentsEnabled,
  onToggleWeather,
  onToggleIncidents,
}: Inline3DSidebarProps) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>("tools");
  const [rangeRingsEnabled, setRangeRingsEnabled] = useState(false);
  const [activeBaseLayer, setActiveBaseLayer] = useState("satellite");
  const [trafficEnabled, setTrafficEnabled] = useState(false);
  const [transitEnabled, setTransitEnabled] = useState(false);

  const rangeRingRefs = useRef<any[]>([]);
  const trafficLayerRef = useRef<any>(null);
  const transitLayerRef = useRef<any>(null);

  const clearRangeRings = useCallback(() => {
    rangeRingRefs.current.forEach((ring) => {
      try {
        ring.setMap(null);
      } catch {
        // noop
      }
    });
    rangeRingRefs.current = [];
    setRangeRingsEnabled(false);
  }, []);

  useEffect(() => {
    return () => {
      clearRangeRings();
      try {
        trafficLayerRef.current?.setMap(null);
        transitLayerRef.current?.setMap(null);
      } catch {
        // noop
      }
    };
  }, [clearRangeRings]);

  const getGoogle = () => {
    const g = (window as any).google;
    return g?.maps ? g : null;
  };

  const toggleRangeRings = useCallback(() => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;

    if (rangeRingsEnabled) {
      clearRangeRings();
      return;
    }

    const rings = [1000, 5000, 10000].map((radius) =>
      new google.maps.Circle({
        map,
        center: { lat, lng },
        radius,
        strokeColor: "hsl(var(--primary))",
        strokeOpacity: 0.85,
        strokeWeight: 1.5,
        fillColor: "hsl(var(--primary))",
        fillOpacity: radius === 1000 ? 0.18 : radius === 5000 ? 0.11 : 0.07,
      }),
    );

    rangeRingRefs.current = rings;
    setRangeRingsEnabled(true);
  }, [mapRef, lat, lng, rangeRingsEnabled, clearRangeRings]);

  const switchBaseLayer = (layer: string) => {
    const map = mapRef.current;
    if (!map) return;
    try {
      map.setMapTypeId(layer);
      setActiveBaseLayer(layer);
    } catch {
      // noop
    }
  };

  const toggleTraffic = () => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;

    if (trafficEnabled) {
      trafficLayerRef.current?.setMap(null);
      trafficLayerRef.current = null;
      setTrafficEnabled(false);
      return;
    }

    const layer = new google.maps.TrafficLayer();
    layer.setMap(map);
    trafficLayerRef.current = layer;
    setTrafficEnabled(true);
  };

  const toggleTransit = () => {
    const map = mapRef.current;
    const google = getGoogle();
    if (!map || !google) return;

    if (transitEnabled) {
      transitLayerRef.current?.setMap(null);
      transitLayerRef.current = null;
      setTransitEnabled(false);
      return;
    }

    const layer = new google.maps.TransitLayer();
    layer.setMap(map);
    transitLayerRef.current = layer;
    setTransitEnabled(true);
  };

  return (
    <div className="h-full flex flex-col bg-background/95 backdrop-blur-md border-r border-border/40">
      <div className="grid grid-cols-3 gap-1 p-2 border-b border-border/30">
        {([
          { id: "tools", label: "Tools", icon: Circle },
          { id: "layers", label: "Layers", icon: Layers },
          { id: "sources", label: "Sources", icon: Radio },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`h-8 rounded-sm border text-[9px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                active
                  ? "bg-primary/15 border-primary/50 text-primary"
                  : "bg-muted/10 border-border/30 text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2 scrollbar-thin">
        {activeTab === "tools" && (
          <>
            <div className="rounded-md border border-border/30 bg-muted/15 p-2.5">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary mb-2">Geo tools</div>
              <button
                onClick={toggleRangeRings}
                className={`w-full h-9 rounded-sm border text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  rangeRingsEnabled
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "bg-background/70 border-border/30 text-foreground hover:border-primary/40"
                }`}
              >
                <Radar className="h-3.5 w-3.5" />
                <span>Range Rings (1/5/10km)</span>
              </button>
            </div>

            <div className="rounded-md border border-border/30 bg-muted/15 p-2.5 space-y-2">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary">Quick actions</div>
              <button
                onClick={() => mapRef.current?.panTo?.({ lat, lng })}
                className="w-full h-8 rounded-sm border border-border/30 bg-background/70 text-[9px] font-mono font-bold uppercase tracking-wider text-foreground hover:border-primary/40 transition-all"
              >
                Recenter Target
              </button>
              <button
                onClick={clearRangeRings}
                className="w-full h-8 rounded-sm border border-border/30 bg-background/70 text-[9px] font-mono font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
              >
                Clear Tool Overlays
              </button>
            </div>
          </>
        )}

        {activeTab === "layers" && (
          <>
            <div className="rounded-md border border-border/30 bg-muted/15 p-2.5 space-y-2">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary">Base map</div>
              {[
                { id: "satellite", label: "Satellite" },
                { id: "hybrid", label: "Hybrid" },
                { id: "terrain", label: "Terrain" },
                { id: "roadmap", label: "Roadmap" },
              ].map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => switchBaseLayer(layer.id)}
                  className={`w-full h-8 rounded-sm border text-[9px] font-mono font-bold uppercase tracking-wider transition-all ${
                    activeBaseLayer === layer.id
                      ? "bg-primary/20 border-primary/50 text-primary"
                      : "bg-background/70 border-border/30 text-foreground hover:border-primary/40"
                  }`}
                >
                  {layer.label}
                </button>
              ))}
            </div>

            <div className="rounded-md border border-border/30 bg-muted/15 p-2.5 space-y-2">
              <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary">Overlay layers</div>
              <button
                onClick={toggleTraffic}
                className={`w-full h-8 rounded-sm border text-[9px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  trafficEnabled
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "bg-background/70 border-border/30 text-foreground hover:border-primary/40"
                }`}
              >
                <MapIcon className="h-3.5 w-3.5" /> Traffic
              </button>
              <button
                onClick={toggleTransit}
                className={`w-full h-8 rounded-sm border text-[9px] font-mono font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  transitEnabled
                    ? "bg-primary/20 border-primary/50 text-primary"
                    : "bg-background/70 border-border/30 text-foreground hover:border-primary/40"
                }`}
              >
                <Route className="h-3.5 w-3.5" /> Transit
              </button>
            </div>
          </>
        )}

        {activeTab === "sources" && (
          <div className="rounded-md border border-border/30 bg-muted/15 p-2.5 space-y-2">
            <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-primary">Live feeds</div>

            <button
              onClick={onToggleWeather}
              className={`w-full h-9 rounded-sm border text-[9px] font-mono font-bold uppercase tracking-wider flex items-center justify-between px-2.5 transition-all ${
                weatherEnabled
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-background/70 border-border/30 text-foreground hover:border-primary/40"
              }`}
            >
              <span className="flex items-center gap-2"><CloudRain className="h-3.5 w-3.5" /> Weather Radar</span>
              <span>{weatherEnabled ? "ON" : "OFF"}</span>
            </button>

            <button
              onClick={onToggleIncidents}
              className={`w-full h-9 rounded-sm border text-[9px] font-mono font-bold uppercase tracking-wider flex items-center justify-between px-2.5 transition-all ${
                incidentsEnabled
                  ? "bg-primary/20 border-primary/50 text-primary"
                  : "bg-background/70 border-border/30 text-foreground hover:border-primary/40"
              }`}
            >
              <span className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" /> Live Incidents</span>
              <span>{incidentsEnabled ? "ON" : "OFF"}</span>
            </button>

            <div className="mt-2 rounded-sm border border-border/30 bg-background/60 px-2.5 py-2 text-[8px] font-mono text-muted-foreground">
              <div className="flex items-center justify-between">
                <span>3D Tiles</span>
                <span className="text-primary">ACTIVE</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span>Map Session</span>
                <span className="text-foreground">READY</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-border/30 p-2 bg-background/85 backdrop-blur-md">
        <button
          onClick={onClose}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-sm bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50 transition-all"
        >
          <Globe className="h-4 w-4" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Back to Globe</span>
        </button>
      </div>

      <div className="shrink-0 border-t border-border/20 bg-muted/20 px-2.5 py-1.5 text-[8px] font-mono text-muted-foreground flex items-center justify-between">
        <span>{lat.toFixed(3)}, {lng.toFixed(3)}</span>
        <RefreshCw className="h-3 w-3" />
      </div>
    </div>
  );
};
