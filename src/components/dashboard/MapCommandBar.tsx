import { useState } from "react";
import {
  Map, Satellite, Layers, MapPin, AlertTriangle, FileText, Shield,
  Search, Clock, Bookmark, Ship, Rocket, Eye, Building2, Camera,
  ShieldAlert, Brain, Radar, Aperture, Crosshair, ChevronUp, ChevronDown,
  LayoutGrid
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ImageryLayer } from "./ImageryLayerPanel";
import type { MapToolMode } from "./MapToolbar";

export interface ComponentVisibility {
  header: boolean;
  statsBar: boolean;
  leftSidebar: boolean;
  rightSidebar: boolean;
  bottomRow: boolean;
  holographic: boolean;
  disclaimer: boolean;
}

export const DEFAULT_COMPONENT_VISIBILITY: ComponentVisibility = {
  header: true,
  statsBar: true,
  leftSidebar: true,
  rightSidebar: true,
  bottomRow: true,
  holographic: true,
  disclaimer: true,
};

const COMPONENT_LABELS: Record<keyof ComponentVisibility, string> = {
  header: "HEADER",
  statsBar: "STATS BAR",
  leftSidebar: "LEFT SIDEBAR",
  rightSidebar: "RIGHT SIDEBAR",
  bottomRow: "BOTTOM ROW",
  holographic: "HUD OVERLAY",
  disclaimer: "DISCLAIMER",
};

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
  tooltip?: string;
}

const GothamBtn = ({ label, icon, active, onClick, disabled, badge, tooltip }: GothamBtnProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        disabled={disabled}
        className={`gotham-cmd-btn ${active ? "gotham-cmd-btn-active" : ""}`}
      >
        {icon}
        <span>{label}</span>
        {badge != null && (
          <span className="gotham-cmd-badge">{badge}</span>
        )}
      </button>
    </TooltipTrigger>
    <TooltipContent side="top" className="text-[10px] font-mono max-w-[200px]">
      {tooltip || label}
    </TooltipContent>
  </Tooltip>
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
  componentVisibility: ComponentVisibility;
  onToggleComponent: (key: keyof ComponentVisibility) => void;
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
  componentVisibility, onToggleComponent,
}: MapCommandBarProps) => {
  const [overlayExpanded, setOverlayExpanded] = useState(false);
  const [intelExpanded, setIntelExpanded] = useState(false);
  const [componentsExpanded, setComponentsExpanded] = useState(false);

  const baseLayers = imageryLayers.filter(l => l.type === "base");
  const overlayLayers = imageryLayers.filter(l => l.type === "overlay");
  const activeOverlays = overlayLayers.filter(l => l.enabled);

  const hiddenCount = Object.values(componentVisibility).filter(v => !v).length;

  const toolButtons: { mode: MapToolMode; icon: React.ReactNode; label: string; tooltip: string }[] = [
    { mode: "marker", icon: <MapPin className="w-3 h-3" />, label: "PIN", tooltip: "Drop a location pin on the map" },
    { mode: "danger", icon: <AlertTriangle className="w-3 h-3" />, label: "DANGER", tooltip: "Mark a danger zone on the map" },
    { mode: "intel", icon: <FileText className="w-3 h-3" />, label: "INTEL", tooltip: "Add an intelligence note to a location" },
    { mode: "troop", icon: <Shield className="w-3 h-3" />, label: "TROOP", tooltip: "Place a troop movement marker" },
  ];

  const intelTools = [
    { onClick: onOpenOrbital, icon: <Satellite className="w-3 h-3" />, label: "ORBITAL", tooltip: "Launch satellite orbital tracker & globe view" },
    { onClick: onOpenUrban3D, icon: <Building2 className="w-3 h-3" />, label: "URBAN 3D", tooltip: "Open 3D urban scene with live flights & Street View" },
    { onClick: onOpenCCTV, icon: <Camera className="w-3 h-3" />, label: "CCTV", tooltip: "Browse live CCTV camera feeds" },
    { onClick: onToggleAllCCTV, icon: <Camera className="w-3 h-3" />, label: loadingCCTV ? "..." : "ALL CCTV", active: allCCTVActive, badge: allCCTVActive ? allCCTVCount : undefined, tooltip: "Toggle all CCTV cameras on the map" },
    { onClick: onOpenResponseMap, icon: <ShieldAlert className="w-3 h-3" />, label: "RESPONSE", tooltip: "View military response & defense map" },
    { onClick: onOpenCrisisIntel, icon: <Brain className="w-3 h-3" />, label: "CRISIS", tooltip: "AI-powered crisis intelligence analysis" },
    { onClick: onToggleIranFIR, icon: <Radar className="w-3 h-3" />, label: "IRAN FIR", active: iranFIRActive, tooltip: "Toggle Iran Flight Information Region overlay" },
    { onClick: onOpenSnapMe, icon: <Aperture className="w-3 h-3" />, label: "SNAP ME", tooltip: "Street-level image capture & AI analysis" },
    { onClick: onOpenScouting, icon: <Crosshair className="w-3 h-3" />, label: "SCOUTING", tooltip: "Tactical scouting & recon tool" },
  ];

  return (
    <TooltipProvider delayDuration={300}>
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

      {/* Components visibility toggle panel */}
      {componentsExpanded && (
        <div className="gotham-expanded-panel absolute bottom-full right-[60px] mb-0 w-[220px] z-[1002]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-primary/20">
            <span className="text-[9px] font-mono font-bold text-primary uppercase tracking-wider">COMPONENTS</span>
            <button
              onClick={() => {
                const allVisible = Object.values(componentVisibility).every(v => v);
                const keys = Object.keys(componentVisibility) as (keyof ComponentVisibility)[];
                keys.forEach(k => {
                  if (allVisible ? componentVisibility[k] : !componentVisibility[k]) {
                    onToggleComponent(k);
                  }
                });
              }}
              className="text-[8px] font-mono text-muted-foreground hover:text-primary transition-colors"
            >
              {Object.values(componentVisibility).every(v => v) ? "HIDE ALL" : "SHOW ALL"}
            </button>
          </div>
          <div className="p-1.5 space-y-0.5">
            {(Object.keys(COMPONENT_LABELS) as (keyof ComponentVisibility)[]).map((key) => (
              <button
                key={key}
                onClick={() => onToggleComponent(key)}
                className={`gotham-expanded-item ${componentVisibility[key] ? "gotham-expanded-item-active" : ""}`}
              >
                <Eye className={`w-3 h-3 transition-colors ${componentVisibility[key] ? "text-primary" : "text-muted-foreground/40"}`} />
                <span>{COMPONENT_LABELS[key]}</span>
                <span className={`ml-auto text-[7px] font-mono ${componentVisibility[key] ? "text-primary" : "text-muted-foreground/40"}`}>
                  {componentVisibility[key] ? "ON" : "OFF"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main command strip */}
      <div className="flex items-center overflow-x-auto gotham-cmd-strip py-1">
        {/* ▎IMAGERY */}
        <CommandSection label="IMG">
          {baseLayers.slice(0, 5).map(layer => (
            <GothamBtn
              key={layer.id}
              label={layer.shortName}
              active={layer.enabled}
              onClick={() => onBaseChange(layer.id)}
              tooltip={`Switch to ${layer.name} base map`}
            />
          ))}
          <GothamBtn
            label="LYR"
            icon={<Layers className="w-3 h-3" />}
            active={activeOverlays.length > 0 || overlayExpanded}
            badge={activeOverlays.length > 0 ? activeOverlays.length : undefined}
            onClick={() => setOverlayExpanded(!overlayExpanded)}
            tooltip="Toggle imagery overlay layers panel"
          />
        </CommandSection>

        <div className="gotham-section-divider" />

        {/* ▎MAP TOOLS */}
        <CommandSection label="TOOLS">
          {toolButtons.map(t => (
            <GothamBtn
              key={t.mode}
              label={t.label}
              icon={t.icon}
              active={activeToolMode === t.mode}
              onClick={() => onToolModeChange(activeToolMode === t.mode ? null : t.mode)}
              tooltip={t.tooltip}
            />
          ))}
        </CommandSection>

        <div className="gotham-section-divider" />

        {/* ▎ANALYSIS */}
        <CommandSection label="DATA">
          <GothamBtn label="UP42" icon={<Search className="w-3 h-3" />} active={up42Open} onClick={onToggleUP42} tooltip="Search UP42 satellite imagery catalog" />
          <GothamBtn label="LEGEND" icon={<Eye className="w-3 h-3" />} active={legendOpen} onClick={onToggleLegend} tooltip="Show/hide map layer legend" />
          <GothamBtn label="HIST" icon={<Clock className="w-3 h-3" />} active={historyOpen} onClick={onToggleHistory} tooltip="Open timeline history slider" />
          <GothamBtn
            label={currentMapStyle === "satellite" ? "SAT" : "DRK"}
            icon={currentMapStyle === "satellite" ? <Satellite className="w-3 h-3" /> : <Map className="w-3 h-3" />}
            onClick={() => onMapStyleChange(currentMapStyle === "satellite" ? "dark" : "satellite")}
            tooltip={`Switch to ${currentMapStyle === "satellite" ? "dark" : "satellite"} map style`}
          />
          <GothamBtn label="BKM" icon={<Bookmark className="w-3 h-3" />} active={bookmarksOpen} onClick={onToggleBookmarks} tooltip="Save & recall map bookmarks" />
          <GothamBtn label="CHOKE" icon={<Ship className="w-3 h-3" />} active={chokepointsOpen} onClick={onToggleChokepoints} tooltip="Monitor maritime chokepoints" />
          <GothamBtn label="LAUNCH" icon={<Rocket className="w-3 h-3" />} active={launchesOpen} onClick={onToggleLaunches} tooltip="View total rocket launch statistics" />
          <GothamBtn
            label="COMP"
            icon={<LayoutGrid className="w-3 h-3" />}
            active={componentsExpanded}
            badge={hiddenCount > 0 ? hiddenCount : undefined}
            onClick={() => setComponentsExpanded(!componentsExpanded)}
            tooltip="Toggle dashboard component visibility"
          />
        </CommandSection>

        <div className="gotham-section-divider" />

        {/* ▎INTEL */}
        <CommandSection label="INTEL">
          {intelTools.slice(0, 3).map((t, i) => (
            <GothamBtn key={i} label={t.label} icon={t.icon} active={t.active} onClick={t.onClick} badge={t.badge} tooltip={t.tooltip} />
          ))}
          <GothamBtn
            label={intelExpanded ? "−" : "+"}
            icon={intelExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
            active={intelExpanded}
            onClick={() => setIntelExpanded(!intelExpanded)}
            tooltip="Expand full intel tools menu"
          />
        </CommandSection>
      </div>
    </div>
    </TooltipProvider>
  );
};
