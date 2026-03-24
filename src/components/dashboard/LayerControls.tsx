import { Plane, Ship, AlertTriangle, Radio, Rocket, Eye, EyeOff, Mountain, Flame, Cloud, Crosshair, Navigation, Car, Radiation, Wind, Anchor, MapPin, Map as MapIcon, Route, TrafficCone } from "lucide-react";
import { useLanguage, translations as tr } from "@/hooks/useLanguage";

export interface LayerState {
  airspace: boolean;
  maritime: boolean;
  alerts: boolean;
  rockets: boolean;
  heatmap: boolean;
  earthquakes: boolean;
  wildfires: boolean;
  weather: boolean;
  traffic: boolean;
  conflicts: boolean;
  flights: boolean;
  nuclear: boolean;
  airQuality: boolean;
  aisVessels: boolean;
  cities: boolean;
  googlePOI: boolean;
  googleTraffic: boolean;
  googleRoutes: boolean;
  news: boolean;
  telegram: boolean;
}

interface LayerControlsProps {
  layers: LayerState;
  onToggle: (layer: keyof LayerState) => void;
}

const layerConfig = [
  { key: "flights" as const, trKey: "layer.flights", icon: Navigation, color: "text-primary" },
  { key: "airspace" as const, trKey: "layer.airspace", icon: Plane, color: "text-primary" },
  { key: "maritime" as const, trKey: "layer.maritime", icon: Ship, color: "text-primary" },
  { key: "aisVessels" as const, trKey: "layer.aisVessels", icon: Anchor, color: "text-primary" },
  { key: "alerts" as const, trKey: "layer.alerts", icon: AlertTriangle, color: "text-warning" },
  { key: "rockets" as const, trKey: "layer.rockets", icon: Rocket, color: "text-critical" },
  { key: "nuclear" as const, trKey: "layer.nuclear", icon: Radiation, color: "text-warning" },
  { key: "earthquakes" as const, trKey: "layer.earthquakes", icon: Mountain, color: "text-warning" },
  { key: "wildfires" as const, trKey: "layer.wildfires", icon: Flame, color: "text-critical" },
  { key: "weather" as const, trKey: "layer.weather", icon: Cloud, color: "text-primary" },
  { key: "airQuality" as const, trKey: "layer.airQuality", icon: Wind, color: "text-accent" },
  { key: "traffic" as const, trKey: "layer.traffic", icon: Car, color: "text-accent" },
  { key: "conflicts" as const, trKey: "layer.conflicts", icon: Crosshair, color: "text-warning" },
  { key: "heatmap" as const, trKey: "layer.heatmap", icon: Radio, color: "text-critical" },
  { key: "cities" as const, trKey: "layer.cities", icon: MapPin, color: "text-primary" },
  { key: "googlePOI" as const, trKey: "layer.googlePOI", icon: MapIcon, color: "text-accent" },
  { key: "googleTraffic" as const, trKey: "layer.googleTraffic", icon: TrafficCone, color: "text-warning" },
  { key: "googleRoutes" as const, trKey: "layer.googleRoutes", icon: Route, color: "text-primary" },
];

export const LayerControls = ({ layers, onToggle }: LayerControlsProps) => {
  const { t } = useLanguage();

  // Group layers into 5 domains for 4D multi-layer mode
  const domains = [
    { label: "GROUND", color: "text-success", layers: ["cities", "traffic", "conflicts", "googlePOI", "googleTraffic", "googleRoutes"] as const },
    { label: "AIR", color: "text-primary", layers: ["flights", "airspace", "weather", "airQuality"] as const },
    { label: "MARITIME", color: "text-primary", layers: ["maritime", "aisVessels"] as const },
    { label: "THREATS", color: "text-critical", layers: ["alerts", "rockets", "nuclear", "heatmap", "earthquakes", "wildfires"] as const },
    { label: "INTEL", color: "text-accent", layers: ["news", "telegram"] as const },
  ];

  return (
    <div className="maven-glass border-l-2 border-l-primary/40 p-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
        <div className="h-3 w-0.5 bg-primary rounded-full" />
        {t(tr["section.layers"].en, tr["section.layers"].ar)}
        <span className="text-[7px] font-mono text-primary/40 ml-auto">4D MODE</span>
      </h3>

      <div className="space-y-3">
        {domains.map(domain => {
          const domainLayers = layerConfig.filter(l => (domain.layers as readonly string[]).includes(l.key));
          const activeCount = domainLayers.filter(l => layers[l.key]).length;
          const allActive = activeCount === domainLayers.length;

          return (
            <div key={domain.label}>
              {/* Domain header */}
              <div className="flex items-center justify-between mb-1 px-1">
                <span className={`text-[8px] font-mono font-bold uppercase tracking-[0.15em] ${domain.color}`}>
                  ▎{domain.label}
                </span>
                <span className="text-[7px] font-mono text-muted-foreground/40">
                  {activeCount}/{domainLayers.length}
                </span>
              </div>
              {/* Layer buttons */}
              <div className="space-y-0.5">
                {domainLayers.map(({ key, trKey, icon: Icon, color }) => (
                  <button
                    key={key}
                    onClick={() => onToggle(key)}
                    className={`w-full flex items-center gap-2 px-2 py-1 transition-all duration-150 ${
                      layers[key]
                        ? "bg-secondary/40 border-l border-l-primary/30 hover:bg-secondary/60"
                        : "opacity-30 hover:opacity-60 hover:bg-secondary/15"
                    }`}
                  >
                    {layers[key] ? (
                      <Eye className={`h-2.5 w-2.5 ${color}`} />
                    ) : (
                      <EyeOff className="h-2.5 w-2.5 text-muted-foreground/50" />
                    )}
                    <Icon className={`h-3 w-3 ${layers[key] ? color : "text-muted-foreground/50"}`} />
                    <span className={`text-[9px] font-mono ${layers[key] ? "text-foreground" : "text-muted-foreground/50"}`}>
                      {t(tr[trKey]?.en || key, tr[trKey]?.ar || key)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
