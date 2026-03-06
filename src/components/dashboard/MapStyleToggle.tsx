import { Map, Satellite } from "lucide-react";

export type MapStyle = "dark" | "satellite";

interface MapStyleToggleProps {
  style: MapStyle;
  onChange: (style: MapStyle) => void;
}

export const MapStyleToggle = ({ style, onChange }: MapStyleToggleProps) => {
  return (
    <div className="absolute top-3 right-3 z-[1000] flex gap-1 bg-card/90 backdrop-blur-sm border border-border rounded-md p-1">
      <button
        onClick={() => onChange("dark")}
        className={`p-1.5 rounded text-xs flex items-center gap-1 font-mono transition-colors ${
          style === "dark"
            ? "bg-primary/20 text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Dark Map"
      >
        <Map className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => onChange("satellite")}
        className={`p-1.5 rounded text-xs flex items-center gap-1 font-mono transition-colors ${
          style === "satellite"
            ? "bg-primary/20 text-primary"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Satellite"
      >
        <Satellite className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
