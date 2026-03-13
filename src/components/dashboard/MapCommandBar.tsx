import { useState } from "react";
import {
  Map, Satellite, Layers, MapPin, AlertTriangle, FileText, Shield,
  Search, Clock, Bookmark, Ship, Rocket, Eye, Building2, Camera,
  ShieldAlert, Brain, Radar, Aperture, Crosshair, ChevronUp, ChevronDown
} from "lucide-react";
import type { ImageryLayer } from "./ImageryLayerPanel";
import type { MapToolMode } from "./MapToolbar";

interface CommandSectionProps {
  label: string;
  children: React.ReactNode;
}

const CommandSection = ({ label, children }: CommandSectionProps) => (
  <div className="flex items-center gap-[3px] px-1.5 min-w-0">
    <span className="text-[6px] font-mono font-bold uppercase tracking-[0.15em] text-primary/50 whitespace-nowrap select-none writing-mode-vertical hidden sm:block"
      style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)', lineHeight: 1 }}>
      {label}
    </span>
    <div className="flex flex-wrap items-center gap-[3px]">
      {children}
    </div>
  </div>
);

interface GothamBtnProps {
  label: string;
  icon?: React.ReactNode;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
  badge?: string | number;
}

const GothamBtn = ({ label, icon, active, onClick, disabled, badge }: GothamBtnProps) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`gotham-cmd-btn ${active ? "gotham-cmd-btn-active" : ""}`}
    title={label}
  >
    {icon}
    <span>{label}</span>
    {badge != null && (
      <span className="gotham-cmd-badge">{badge}</span>
    )}
  </button>
);

interface MapCommandBarProps {
  imageryLayers: ImageryLayer[];
  onBaseChange: (id: string) => void;
  onOverlayToggle: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
  activeToolMode: MapToolMode;
  onToolModeChange: (mode: MapToolMode) => void;
  onToggleUP42: () => void;
  up42Open: boolean;
  onToggleLegend: () => void;
  legendOpen: boolean;
  onToggleHistory: () => void;
  historyOpen: boolean;
  onToggleBookmarks: () => void;
  bookmarksOpen: boolean;
  onToggleChokepoints: () => void;
  chokepointsOpen: boolean;
  onToggleLaunches: () => void;
  launchesOpen: boolean;
  currentMapStyle: "dark" | "satellite";
  onMapStyleChange: (style: "dark" | "satellite") => void;
  onOpenOrbital: () => void;
  onOpenUrban3D: () => void;
  onOpenCCTV: () => void;
  onToggleAllCCTV: () => void;
  allCCTVActive: boolean;
  allCCTVCount: number;
  loadingCCTV: boolean;
  onOpenResponseMap: () => void;
  onOpenCrisisIntel: () => void;
  onToggleIranFIR: () => void;
  iranFIRActive: boolean;
  onOpenSnapMe: () => void;
  onOpenScouting: () => void;
}

export const MapCommandBar = ({
  imageryLayers, onBaseChange, onOverlayToggle, onOpacityChange,
  activeToolMode, onToolModeChange,
  onToggleUP42, up42Open,
  onToggleLegend, legendOpen,
  onToggleHistory, historyOpen,
  onToggleBookmarks, bookmarksOpen,
  onToggleChokepoints, chokepointsOpen,
  onToggleLaunches, launchesOpen,
  currentMapStyle, onMapStyleChange,
  onOpenOrbital, onOpenUrban3D, onOpenCCTV,
  onToggleAllCCTV, allCCTVActive, allCCTVCount, loadingCCTV,
  onOpenResponseMap, onOpenCrisisIntel,
  onToggleIranFIR, iranFIRActive,
  onOpenSnapMe, onOpenScouting,
}: MapCommandBarProps) => {
  const [overlayExpanded, setOverlayExpanded] = useState(false);
  const [intelExpanded, setIntelExpanded] = useState(false);

  const baseLayers = imageryLayers.filter(l => l.type === "base");
  const overlayLayers = imageryLayers.filter(l => l.type === "overlay");
  const activeOverlays = overlayLayers.filter(l => l.enabled);

  const toolButtons: { mode: MapToolMode; icon: React.ReactNode; label: string }[] = [
    { mode: "marker", icon: <MapPin className="w-3 h-3" />, label: "PIN" },
    { mode: "danger", icon: <AlertTriangle className="w-3 h-3" />, label: "DANGER" },
    { mode: "intel", icon: <FileText className="w-3 h-3" />, label: "INTEL" },
    { mode: "troop", icon: <Shield className="w-3 h-3" />, label: "TROOP" },
  ];

  const intelTools = [
    { onClick: onOpenOrbital, icon: <Satellite className="w-3 h-3" />, label: "ORBITAL" },
    { onClick: onOpenUrban3D, icon: <Building2 className="w-3 h-3" />, label: "URBAN 3D" },
    { onClick: onOpenCCTV, icon: <Camera className="w-3 h-3" />, label: "CCTV" },
    { onClick: onToggleAllCCTV, icon: <Camera className="w-3 h-3" />, label: loadingCCTV ? "..." : "ALL CCTV", active: allCCTVActive, badge: allCCTVActive ? allCCTVCount : undefined },
    { onClick: onOpenResponseMap, icon: <ShieldAlert className="w-3 h-3" />, label: "RESPONSE" },
    { onClick: onOpenCrisisIntel, icon: <Brain className="w-3 h-3" />, label: "CRISIS" },
    { onClick: onToggleIranFIR, icon: <Radar className="w-3 h-3" />, label: "IRAN FIR", active: iranFIRActive },
    { onClick: onOpenSnapMe, icon: <Aperture className="w-3 h-3" />, label: "SNAP ME" },
    { onClick: onOpenScouting, icon: <Crosshair className="w-3 h-3" />, label: "SCOUTING" },
  ];

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1000] gotham-cmd-bar">
      {/* Overlay layers expanded panel */}
      {overlayExpanded && (
        <div className="gotham-expanded-panel absolute bottom-full left-0 mb-0 w-[320px] max-h-[50vh] overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-2 border-b border-primary/20">
            <span className="text-[9px] font-mono font-bold text-primary uppercase tracking-wider">IMAGERY OVERLAYS</span>
            <button
              onClick={() => overlayLayers.forEach(l => { if (l.enabled) onOverlayToggle(l.id); })}
              className="text-[8px] font-mono text-muted-foreground hover:text-primary transition-colors"
            >CLEAR ALL</button>
          </div>
          <div className="p-2 space-y-1">
            {overlayLayers.map(layer => (
              <div key={layer.id} className={`flex items-center gap-2 px-2.5 py-1.5 border transition-all ${
                layer.enabled
                  ? "border-primary/30 bg-primary/8 shadow-[inset_0_0_12px_hsl(var(--primary)/0.05)]"
                  : "border-border/20 bg-transparent hover:border-border/40"
              }`}>
                <button onClick={() => onOverlayToggle(layer.id)} className="flex-shrink-0">
                  <Eye className={`h-3.5 w-3.5 transition-colors ${layer.enabled ? "text-primary" : "text-muted-foreground"}`} />
                </button>
                <span className={`text-[9px] font-mono flex-1 ${layer.enabled ? "text-foreground" : "text-muted-foreground"}`}>
                  {layer.name}
                </span>
                {layer.enabled && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[7px] font-mono text-primary/60">{Math.round(layer.opacity * 100)}%</span>
                    <input
                      type="range" min="10" max="100"
                      value={layer.opacity * 100}
                      onChange={(e) => onOpacityChange(layer.id, parseInt(e.target.value) / 100)}
                      className="w-14 h-1 bg-secondary appearance-none cursor-pointer accent-primary"
                      style={{ accentColor: "hsl(var(--primary))" }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Intel expanded panel */}
      {intelExpanded && (
        <div className="gotham-expanded-panel absolute bottom-full right-0 mb-0 w-[220px]">
          <div className="px-3 py-2 border-b border-primary/20">
            <span className="text-[9px] font-mono font-bold text-primary uppercase tracking-wider">INTEL TOOLS</span>
          </div>
          <div className="p-1.5 space-y-0.5">
            {intelTools.map((t, i) => (
              <button
                key={i}
                onClick={() => { t.onClick(); setIntelExpanded(false); }}
                disabled={t.label === "LOADING..."}
                className={`gotham-expanded-item ${t.active ? "gotham-expanded-item-active" : ""}`}
              >
                {t.icon}
                <span>{t.label}</span>
                {t.badge != null && <span className="ml-auto gotham-cmd-badge">{t.badge}</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main command strip */}
      <div className="flex items-stretch overflow-x-auto gotham-cmd-strip">
        {/* ▎IMAGERY */}
        <CommandSection label="IMAGERY">
          {baseLayers.slice(0, 5).map(layer => (
            <GothamBtn
              key={layer.id}
              label={layer.shortName}
              active={layer.enabled}
              onClick={() => onBaseChange(layer.id)}
            />
          ))}
          <GothamBtn
            label={`LAYERS`}
            icon={<Layers className="w-3.5 h-3.5" />}
            active={activeOverlays.length > 0 || overlayExpanded}
            badge={activeOverlays.length > 0 ? activeOverlays.length : undefined}
            onClick={() => setOverlayExpanded(!overlayExpanded)}
          />
        </CommandSection>

        <div className="gotham-section-divider" />

        {/* ▎MAP TOOLS */}
        <CommandSection label="MAP TOOLS">
          {toolButtons.map(t => (
            <GothamBtn
              key={t.mode}
              label={t.label}
              icon={t.icon}
              active={activeToolMode === t.mode}
              onClick={() => onToolModeChange(activeToolMode === t.mode ? null : t.mode)}
            />
          ))}
        </CommandSection>

        <div className="gotham-section-divider" />

        {/* ▎ANALYSIS */}
        <CommandSection label="ANALYSIS">
          <GothamBtn label="UP42" icon={<Search className="w-3.5 h-3.5" />} active={up42Open} onClick={onToggleUP42} />
          <GothamBtn label="LEGEND" icon={<Eye className="w-3.5 h-3.5" />} active={legendOpen} onClick={onToggleLegend} />
          <GothamBtn label="HISTORY" icon={<Clock className="w-3.5 h-3.5" />} active={historyOpen} onClick={onToggleHistory} />
          <GothamBtn
            label={currentMapStyle === "satellite" ? "SAT" : "DARK"}
            icon={currentMapStyle === "satellite" ? <Satellite className="w-3.5 h-3.5" /> : <Map className="w-3.5 h-3.5" />}
            onClick={() => onMapStyleChange(currentMapStyle === "satellite" ? "dark" : "satellite")}
          />
          <GothamBtn label="MARKS" icon={<Bookmark className="w-3.5 h-3.5" />} active={bookmarksOpen} onClick={onToggleBookmarks} />
          <GothamBtn label="CHOKE" icon={<Ship className="w-3.5 h-3.5" />} active={chokepointsOpen} onClick={onToggleChokepoints} />
          <GothamBtn label="LAUNCHES" icon={<Rocket className="w-3.5 h-3.5" />} active={launchesOpen} onClick={onToggleLaunches} />
        </CommandSection>

        <div className="gotham-section-divider" />

        {/* ▎INTEL */}
        <CommandSection label="INTEL">
          {intelTools.slice(0, 3).map((t, i) => (
            <GothamBtn key={i} label={t.label} icon={t.icon} active={t.active} onClick={t.onClick} badge={t.badge} />
          ))}
          <GothamBtn
            label={intelExpanded ? "LESS" : "MORE"}
            icon={intelExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            active={intelExpanded}
            onClick={() => setIntelExpanded(!intelExpanded)}
          />
        </CommandSection>
      </div>
    </div>
  );
};
