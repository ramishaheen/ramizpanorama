import { useState } from "react";
import { MapPin, AlertTriangle, FileText, Shield, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";

export type MapToolMode = "marker" | "danger" | "intel" | "troop" | null;

export interface UserMapItem {
  id: string;
  type: MapToolMode;
  lat: number;
  lng: number;
  label: string;
  severity?: string;
  radius?: number;
  details?: string;
}

interface MapToolbarProps {
  activeMode: MapToolMode;
  onModeChange: (mode: MapToolMode) => void;
  pendingItem: Partial<UserMapItem> | null;
  onConfirmItem: (item: Partial<UserMapItem>) => void;
  onCancelItem: () => void;
}

const tools = [
{ mode: "marker" as const, icon: MapPin, label: "Pin", color: "text-primary" },
{ mode: "danger" as const, icon: AlertTriangle, label: "Danger Zone", color: "text-destructive" },
{ mode: "intel" as const, icon: FileText, label: "Intel Note", color: "text-accent" },
{ mode: "troop" as const, icon: Shield, label: "Troop/Asset", color: "text-success" }];


export const MapToolbar = ({
  activeMode,
  onModeChange,
  pendingItem,
  onConfirmItem,
  onCancelItem
}: MapToolbarProps) => {
  const [label, setLabel] = useState("");
  const [details, setDetails] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [radius, setRadius] = useState("50");

  const handleConfirm = () => {
    onConfirmItem({
      ...pendingItem,
      label: label || "Untitled",
      details,
      severity,
      radius: Number(radius)
    });
    setLabel("");
    setDetails("");
    setSeverity("medium");
    setRadius("50");
  };

  const handleCancel = () => {
    onCancelItem();
    setLabel("");
    setDetails("");
  };

  return (
    <div className="absolute bottom-40 left-2 z-[1000] flex flex-col gap-1.5">
      {/* Tool buttons */}
      <div className="gap-1 rounded-md border border-border/50 bg-card/90 backdrop-blur-md p-1 shadow-lg flex-row flex items-end justify-end"
      style={{ boxShadow: "0 0 15px hsl(190 100% 50% / 0.1)" }}>
        {tools.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeMode === tool.mode;
          return (
            <button
              key={tool.mode}
              onClick={() => onModeChange(isActive ? null : tool.mode)}
              title={tool.label}
              className={`relative flex items-center justify-center w-9 h-9 rounded transition-all duration-200
                ${isActive ?
              "bg-primary/20 border border-primary/50 shadow-[0_0_10px_hsl(190_100%_50%/0.3)]" :
              "hover:bg-secondary border border-transparent"}`
              }>
              
              <Icon className={`w-4 h-4 ${isActive ? tool.color : "text-muted-foreground"}`} />
              {isActive &&
              <span className="absolute -right-0.5 -top-0.5 w-2 h-2 rounded-full bg-primary animate-pulse" />
              }
            </button>);

        })}
      </div>

      {/* Active mode indicator */}
      {activeMode && !pendingItem &&
      <div className="rounded border border-primary/30 bg-card/90 backdrop-blur-md px-2.5 py-1.5 text-[10px] font-mono text-primary animate-fade-in max-w-[160px]"
      style={{ boxShadow: "0 0 12px hsl(190 100% 50% / 0.1)" }}>
          Click map to place {tools.find((t) => t.mode === activeMode)?.label}
        </div>
      }

      {/* Form popover for pending item */}
      {pendingItem &&
      <div className="rounded-lg border border-primary/30 bg-card/95 backdrop-blur-md p-3 w-56 animate-scale-in space-y-2"
      style={{ boxShadow: "0 0 20px hsl(190 100% 50% / 0.15)" }}>
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">
            {tools.find((t) => t.mode === pendingItem.type)?.label}
          </div>
          <Input
          placeholder="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="h-7 text-xs bg-secondary/50 border-border/50"
          autoFocus />
        
          {pendingItem.type === "danger" &&
        <>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="h-7 text-xs bg-secondary/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
              <Input
            placeholder="Radius (km)"
            type="number"
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="h-7 text-xs bg-secondary/50 border-border/50" />
          
            </>
        }
          {(pendingItem.type === "intel" || pendingItem.type === "troop") &&
        <Textarea
          placeholder={pendingItem.type === "intel" ? "Intel details..." : "Unit info..."}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          className="text-xs bg-secondary/50 border-border/50 min-h-[50px] resize-none" />

        }
          <div className="flex gap-1.5">
            <Button size="sm" onClick={handleConfirm} className="h-7 text-xs flex-1 gap-1">
              <Check className="w-3 h-3" /> Add
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel} className="h-7 text-xs px-2">
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      }
    </div>);

};