import { Map, Satellite } from "lucide-react";

export type MapStyle = "dark" | "satellite";

interface MapStyleToggleProps {
  style: MapStyle;
  onChange: (style: MapStyle) => void;
}

export const MapStyleToggle = ({ style, onChange }: MapStyleToggleProps) => {
  return (
    <div className="flex gap-1 px-2.5 py-1.5 rounded-lg border border-border/60 bg-card/90 backdrop-blur-xl shadow-lg">
      <button
        onClick={() => onChange("dark")}
        className={`p-1 rounded text-xs flex items-center gap-1 font-mono transition-colors ${
          style === "dark"
            ? "bg-primary/20 text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Dark Map"
      >
        <Map className="h-3 w-3" />
      </button>
      <button
        onClick={() => onChange("satellite")}
        className={`p-1 rounded text-xs flex items-center gap-1 font-mono transition-colors ${
          style === "satellite"
            ? "bg-primary/20 text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Satellite"
      >
        <Satellite className="h-3 w-3" />
      </button>
    </div>
  );
};
