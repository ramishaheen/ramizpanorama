import { useState } from "react";
import { Layers, Eye, EyeOff } from "lucide-react";

export interface LayerConfig {
  id: string;
  label: string;
  color: string;
  filterType: string;
  enabled: boolean;
}

const DEFAULT_LAYERS: LayerConfig[] = [
  { id: "global", label: "Global Attack Activity", color: "hsl(190 80% 55%)", filterType: "", enabled: true },
  { id: "botnet", label: "Botnet Activity", color: "hsl(280 70% 60%)", filterType: "botnet", enabled: false },
  { id: "malware", label: "Malware Spread", color: "hsl(330 80% 55%)", filterType: "malware", enabled: false },
  { id: "apt", label: "APT Campaigns", color: "hsl(0 80% 55%)", filterType: "apt", enabled: false },
  { id: "ddos", label: "DDoS Activity", color: "hsl(45 95% 55%)", filterType: "ddos", enabled: false },
  { id: "ransomware", label: "Ransomware Activity", color: "hsl(25 90% 55%)", filterType: "ransomware", enabled: false },
  { id: "zeroday", label: "Zero-Day Exploits", color: "hsl(160 80% 50%)", filterType: "zeroday", enabled: false },
  { id: "scanning", label: "Vulnerability Scanning", color: "hsl(210 70% 55%)", filterType: "scanning", enabled: false },
];

interface MapLayersPanelProps {
  layers: LayerConfig[];
  onToggle: (id: string) => void;
}

export function useMapLayers() {
  const [layers, setLayers] = useState<LayerConfig[]>(DEFAULT_LAYERS);

  const toggleLayer = (id: string) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, enabled: !l.enabled } : l));
  };

  return { layers, toggleLayer };
}

export function filterByLayers(threats: any[], layers: LayerConfig[]) {
  const active = layers.filter(l => l.enabled);
  if (active.length === 0) return threats;
  if (active.some(l => l.id === "global")) return threats;

  return threats.filter(t => {
    const type = (t.type || "").toLowerCase();
    const desc = (t.description || "").toLowerCase();
    const details = (t.details || "").toLowerCase();
    const combined = type + " " + desc + " " + details;

    return active.some(l => {
      switch (l.filterType) {
        case "botnet": return combined.includes("botnet") || combined.includes("c2") || combined.includes("command and control");
        case "malware": return combined.includes("malware") || combined.includes("wiper") || combined.includes("trojan");
        case "apt": return combined.includes("apt") || combined.includes("espionage") || combined.includes("nation state");
        case "ddos": return combined.includes("ddos") || combined.includes("denial of service") || type.includes("network disruption");
        case "ransomware": return combined.includes("ransomware") || combined.includes("ransom");
        case "zeroday": return !!t.cve || combined.includes("zero-day") || combined.includes("0-day") || type.includes("zero-day");
        case "scanning": return combined.includes("scan") || combined.includes("probe") || combined.includes("reconnaissance");
        default: return true;
      }
    });
  });
}

export function MapLayersPanel({ layers, onToggle }: MapLayersPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute top-2 left-2 p-1.5 rounded bg-card/90 border border-border backdrop-blur-sm hover:border-primary/50 transition-colors"
        style={{ zIndex: 1000 }}
      >
        <Layers className="h-3.5 w-3.5 text-primary" />
      </button>
    );
  }

  return (
    <div className="absolute top-2 left-2 w-48 bg-card/95 border border-border rounded backdrop-blur-sm" style={{ zIndex: 1000 }}>
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3 w-3 text-primary" />
          <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-foreground">Intel Layers</span>
        </div>
        <button onClick={() => setCollapsed(true)} className="text-muted-foreground hover:text-foreground transition-colors">
          <EyeOff className="h-3 w-3" />
        </button>
      </div>
      <div className="p-1.5 space-y-0.5">
        {layers.map(layer => (
          <button
            key={layer.id}
            onClick={() => onToggle(layer.id)}
            className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[8px] font-mono transition-all ${
              layer.enabled
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
            }`}
          >
            <div className="flex items-center gap-1.5 flex-1">
              <div
                className="h-2 w-2 rounded-full flex-shrink-0 transition-opacity"
                style={{ background: layer.color, opacity: layer.enabled ? 1 : 0.3 }}
              />
              <span className="truncate">{layer.label}</span>
            </div>
            {layer.enabled ? (
              <Eye className="h-2.5 w-2.5 text-primary flex-shrink-0" />
            ) : (
              <EyeOff className="h-2.5 w-2.5 flex-shrink-0 opacity-40" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
