import { useEffect, useRef, useState } from "react";

interface WeatherRadarOverlayProps {
  mapRef: React.MutableRefObject<any>;
  enabled: boolean;
  opacity: number;
}

// Animated weather radar overlay using OpenWeatherMap precipitation tiles
// Auto-cycles between cloud, precipitation and wind layers every 10s
export const WeatherRadarOverlay = ({ mapRef, enabled, opacity }: WeatherRadarOverlayProps) => {
  const overlayRefs = useRef<any[]>([]);
  const [activeRadarLayer, setActiveRadarLayer] = useState(0);

  const radarLayers = [
    { id: "precip", name: "Precipitation", url: "https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=b1b15e88fa797225412429c1c50c122a1" },
    { id: "clouds", name: "Cloud Cover", url: "https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=b1b15e88fa797225412429c1c50c122a1" },
    { id: "wind", name: "Wind Speed", url: "https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=b1b15e88fa797225412429c1c50c122a1" },
  ];

  // Auto-cycle radar layers
  useEffect(() => {
    if (!enabled) return;
    const iv = setInterval(() => {
      setActiveRadarLayer(prev => (prev + 1) % radarLayers.length);
    }, 10_000);
    return () => clearInterval(iv);
  }, [enabled]);

  // Apply overlay to Google Maps
  useEffect(() => {
    const map = mapRef.current;
    const google = (window as any).google;
    if (!map || !google?.maps || !enabled) {
      overlayRefs.current.forEach(o => {
        for (let i = map?.overlayMapTypes?.getLength?.() - 1 || 0; i >= 0; i--) {
          if (map?.overlayMapTypes?.getAt(i) === o) map.overlayMapTypes.removeAt(i);
        }
      });
      overlayRefs.current = [];
      return;
    }

    // Remove previous
    overlayRefs.current.forEach(o => {
      for (let i = map.overlayMapTypes.getLength() - 1; i >= 0; i--) {
        if (map.overlayMapTypes.getAt(i) === o) map.overlayMapTypes.removeAt(i);
      }
    });
    overlayRefs.current = [];

    const layer = radarLayers[activeRadarLayer];
    const tileType = new google.maps.ImageMapType({
      getTileUrl: (coord: any, zoom: number) => {
        return layer.url
          .replace("{z}", zoom.toString())
          .replace("{y}", coord.y.toString())
          .replace("{x}", coord.x.toString());
      },
      tileSize: new google.maps.Size(256, 256),
      opacity: opacity * 0.6,
      name: `Weather Radar: ${layer.name}`,
    });
    map.overlayMapTypes.push(tileType);
    overlayRefs.current.push(tileType);
  }, [enabled, activeRadarLayer, opacity, mapRef]);

  if (!enabled) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[13] pointer-events-auto">
      <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-black/80 backdrop-blur border border-cyan-500/30">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-[8px] font-mono text-cyan-400 font-bold uppercase">RADAR</span>
        <div className="w-px h-3 bg-border/30 mx-1" />
        {radarLayers.map((l, i) => (
          <button
            key={l.id}
            onClick={() => setActiveRadarLayer(i)}
            className={`px-1.5 py-0.5 rounded text-[7px] font-mono uppercase transition-all ${
              i === activeRadarLayer
                ? "bg-cyan-500/20 text-cyan-400 font-bold"
                : "text-muted-foreground/50 hover:text-foreground"
            }`}
          >
            {l.name}
          </button>
        ))}
      </div>
    </div>
  );
};
