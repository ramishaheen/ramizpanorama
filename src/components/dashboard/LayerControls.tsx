import { Plane, Ship, AlertTriangle, Radio, Rocket, Eye, EyeOff, Mountain, Flame, Cloud, Crosshair, Navigation, Car } from "lucide-react";
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
}

interface LayerControlsProps {
  layers: LayerState;
  onToggle: (layer: keyof LayerState) => void;
}

const layerConfig = [
  { key: "flights" as const, trKey: "layer.flights", icon: Navigation, color: "text-primary" },
  { key: "airspace" as const, trKey: "layer.airspace", icon: Plane, color: "text-primary" },
  { key: "maritime" as const, trKey: "layer.maritime", icon: Ship, color: "text-primary" },
  { key: "alerts" as const, trKey: "layer.alerts", icon: AlertTriangle, color: "text-warning" },
  { key: "rockets" as const, trKey: "layer.rockets", icon: Rocket, color: "text-critical" },
  { key: "earthquakes" as const, trKey: "layer.earthquakes", icon: Mountain, color: "text-warning" },
  { key: "wildfires" as const, trKey: "layer.wildfires", icon: Flame, color: "text-critical" },
  { key: "weather" as const, trKey: "layer.weather", icon: Cloud, color: "text-primary" },
  { key: "traffic" as const, trKey: "layer.traffic", icon: Car, color: "text-accent" },
  { key: "conflicts" as const, trKey: "layer.conflicts", icon: Crosshair, color: "text-warning" },
  { key: "heatmap" as const, trKey: "layer.heatmap", icon: Radio, color: "text-critical" },
];

export const LayerControls = ({ layers, onToggle }: LayerControlsProps) => {
  const { t } = useLanguage();

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
        {t(tr["section.layers"].en, tr["section.layers"].ar)}
      </h3>
      <div className="space-y-1.5">
        {layerConfig.map(({ key, trKey, icon: Icon, color }) => (
          <button
            key={key}
            onClick={() => onToggle(key)}
            className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded transition-colors ${
              layers[key] ? "bg-secondary/60" : "opacity-40 hover:opacity-70"
            }`}
          >
            {layers[key] ? (
              <Eye className={`h-3 w-3 ${color}`} />
            ) : (
              <EyeOff className="h-3 w-3 text-muted-foreground" />
            )}
            <Icon className={`h-3.5 w-3.5 ${layers[key] ? color : "text-muted-foreground"}`} />
            <span className={`text-xs ${layers[key] ? "text-foreground" : "text-muted-foreground"}`}>
              {t(tr[trKey].en, tr[trKey].ar)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
