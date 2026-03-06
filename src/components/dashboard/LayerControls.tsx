import { Plane, Ship, AlertTriangle, Radio, Rocket, Eye, EyeOff } from "lucide-react";

export interface LayerState {
  airspace: boolean;
  maritime: boolean;
  alerts: boolean;
  rockets: boolean;
  heatmap: boolean;
}

interface LayerControlsProps {
  layers: LayerState;
  onToggle: (layer: keyof LayerState) => void;
}

const layerConfig = [
  { key: "airspace" as const, label: "Airspace", icon: Plane, color: "text-primary" },
  { key: "maritime" as const, label: "Maritime", icon: Ship, color: "text-primary" },
  { key: "alerts" as const, label: "Alerts", icon: AlertTriangle, color: "text-warning" },
  { key: "rockets" as const, label: "Rockets", icon: Rocket, color: "text-critical" },
  { key: "heatmap" as const, label: "Heatmap", icon: Radio, color: "text-critical" },
];

export const LayerControls = ({ layers, onToggle }: LayerControlsProps) => (
  <div className="bg-card border border-border rounded-lg p-3">
    <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
      Layers
    </h3>
    <div className="space-y-1.5">
      {layerConfig.map(({ key, label, icon: Icon, color }) => (
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
            {label}
          </span>
        </button>
      ))}
    </div>
  </div>
);
