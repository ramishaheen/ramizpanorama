import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AirspaceAlert, MaritimeVessel, GeoAlert, Rocket } from "@/data/mockData";
import type { LayerState } from "./LayerControls";
import type { WarUpdate } from "@/hooks/useWarUpdates";
import type { TelegramMarker } from "@/hooks/useTelegramIntel";
import type { CountrySafety } from "@/hooks/useCitizenSecurity";
import type { FusionEvent } from "@/hooks/useGeoFusion";
import { getCountryGeoJSON, SAFETY_LEVEL_MAP_COLORS } from "@/data/countryBorders";
import { MapToolbar, type MapToolMode, type UserMapItem } from "./MapToolbar";
import { HolographicOverlay } from "./HolographicOverlay";
import { TotalLaunchesWidget } from "./TotalLaunchesWidget";
import { ImageryLayerPanel, DEFAULT_IMAGERY_LAYERS, type ImageryLayer } from "./ImageryLayerPanel";
import { Satellite, Building2, Camera, ShieldAlert } from "lucide-react";
import { ResponseMapModal } from "./ResponseMapModal";
import { LiveCamerasModal } from "./LiveCamerasModal";
import { MapLegend } from "./MapLegend";
import { SatelliteGlobe } from "./SatelliteGlobe";
import { UrbanScene3D } from "./UrbanScene3D";
import { ChokepointMonitor, CHOKEPOINTS } from "./ChokepointMonitor";
import { useEarthquakes, type Earthquake } from "@/hooks/useEarthquakes";
import { useWildfires, type Wildfire } from "@/hooks/useWildfires";
import { useConflictEvents, type ConflictEvent } from "@/hooks/useConflictEvents";
import { useNuclearMonitors, type RadiationStation, type NuclearFacility } from "@/hooks/useNuclearMonitors";
import { useAirQuality, type AirQualityStation } from "@/hooks/useAirQuality";
import { useAISVessels, type AISVessel } from "@/hooks/useAISVessels";
import { UP42Panel } from "./UP42Panel";
import type { UP42Feature } from "@/hooks/useUP42Catalog";

interface IntelMapProps {
  airspaceAlerts: AirspaceAlert[];
  vessels: MaritimeVessel[];
  geoAlerts: GeoAlert[];
  rockets: Rocket[];
  layers: LayerState;
  onToggleLayer?: (layer: keyof LayerState) => void;
  safetyData?: CountrySafety[];
  flyToTarget?: { lat: number; lng: number; label: string } | null;
  newsMarkers?: WarUpdate[];
  telegramMarkers?: TelegramMarker[];
  fusionEvents?: FusionEvent[];
}

const severityColors: Record<AirspaceAlert["severity"], string> = {
  low: "#22c55e",
  medium: "#00d4ff",
  high: "#ffb800",
  critical: "#ef4444",
};

const vesselColors: Record<MaritimeVessel["type"], string> = {
  MILITARY: "#ef4444",
  CARGO: "#00d4ff",
  TANKER: "#ffb800",
  FISHING: "#22c55e",
  UNKNOWN: "#888888",
};

const createVesselIcon = (type: MaritimeVessel["type"], heading: number) => {
  const color = vesselColors[type];
  return L.divIcon({
    className: "vessel-icon",
    html: `<div style="transform:rotate(${heading}deg);color:${color};font-size:16px;text-shadow:0 0 6px ${color}">▲</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
    popupAnchor: [0, -12],
  });
};

const rocketStatusColors: Record<string, string> = {
  launched: "#ff6b00",
  in_flight: "#ef4444",
  intercepted: "#22c55e",
  impact: "#ff0000",
};

const createRocketIcon = (status: string) => {
  const color = rocketStatusColors[status] || "#ef4444";
  const isActive = status === "launched" || status === "in_flight";
  return L.divIcon({
    className: "rocket-icon",
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
      ${isActive ? `<div style="position:absolute;width:24px;height:24px;border-radius:50%;background:${color};opacity:0.3;animation:pulse 1.5s ease-in-out infinite;"></div>` : ''}
      <div style="font-size:16px;filter:drop-shadow(0 0 6px ${color});${isActive ? 'animation:pulse 1s ease-in-out infinite;' : ''}">🚀</div>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -14],
  });
};

const userItemIcons: Record<string, { emoji: string; color: string }> = {
  marker: { emoji: "📍", color: "#00d4ff" },
  danger: { emoji: "⚠️", color: "#ef4444" },
  intel: { emoji: "📋", color: "#ffb800" },
  troop: { emoji: "🛡️", color: "#22c55e" },
};

const createUserItemIcon = (type: string) => {
  const config = userItemIcons[type] || { emoji: "📍", color: "#00d4ff" };
  return L.divIcon({
    className: "user-item-icon",
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:28px;height:28px;border-radius:50%;border:2px solid ${config.color};opacity:0.6;animation:pulse 2s ease-in-out infinite;"></div>
      <div style="font-size:14px;filter:drop-shadow(0 0 8px ${config.color});">${config.emoji}</div>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  });
};

const magnitudeColors: Record<string, string> = {
  minor: "#22c55e",    // < 3
  light: "#00d4ff",    // 3-4.9
  moderate: "#ffb800", // 5-5.9
  strong: "#ff6b00",   // 6-6.9
  major: "#ef4444",    // 7+
};

function getQuakeColor(mag: number): string {
  if (mag >= 7) return magnitudeColors.major;
  if (mag >= 6) return magnitudeColors.strong;
  if (mag >= 5) return magnitudeColors.moderate;
  if (mag >= 3) return magnitudeColors.light;
  return magnitudeColors.minor;
}

function getQuakeRadius(mag: number): number {
  if (mag >= 7) return 14;
  if (mag >= 6) return 11;
  if (mag >= 5) return 8;
  if (mag >= 3) return 5;
  return 3;
}

const createFireIcon = (frp: number) => {
  const intensity = frp > 100 ? "high" : frp > 30 ? "medium" : "low";
  const size = intensity === "high" ? 16 : intensity === "medium" ? 13 : 10;
  const glow = intensity === "high" ? "0 0 12px #ff4500" : intensity === "medium" ? "0 0 8px #ff6b00" : "0 0 4px #ffb800";
  return L.divIcon({
    className: "fire-icon",
    html: `<div style="font-size:${size}px;filter:drop-shadow(${glow});${intensity === "high" ? "animation:pulse 1s ease-in-out infinite;" : ""}">🔥</div>`,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
    popupAnchor: [0, -10],
  });
};

const conflictTypeEmojis: Record<string, string> = {
  "Battles": "⚔️",
  "Explosions/Remote violence": "💥",
  "Violence against civilians": "🩸",
  "Protests": "✊",
  "Riots": "🔥",
  "Strategic developments": "🎯",
};

const conflictTypeColors: Record<string, string> = {
  "Battles": "#ef4444",
  "Explosions/Remote violence": "#ff6b00",
  "Violence against civilians": "#dc2626",
  "Protests": "#eab308",
  "Riots": "#f97316",
  "Strategic developments": "#3b82f6",
};

const createConflictIcon = (eventType: string, severity: string) => {
  const emoji = conflictTypeEmojis[eventType] || "⚔️";
  const color = conflictTypeColors[eventType] || "#ef4444";
  const isCritical = severity === "critical" || severity === "high";
  const size = isCritical ? 16 : 13;
  return L.divIcon({
    className: "conflict-icon",
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
      ${isCritical ? `<div style="position:absolute;width:22px;height:22px;border-radius:50%;border:1.5px solid ${color};opacity:0.4;animation:pulse 2s ease-in-out infinite;"></div>` : ''}
      <div style="font-size:${size}px;filter:drop-shadow(0 0 4px ${color});">${emoji}</div>
    </div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
};

const popupOptions: L.PopupOptions = {
  autoPan: true,
  autoPanPadding: L.point(40, 40),
  offset: L.point(0, -4),
};

const popupStyle = `font-family:'JetBrains Mono',monospace;font-size:11px;color:#ccc;background:#1a1d27;padding:8px;border-radius:4px;min-width:200px;`;

/** Bind popup that opens on hover instead of click */
function bindHoverPopup(marker: L.Marker, content: string, opts?: L.PopupOptions) {
  marker.bindPopup(content, { ...popupOptions, ...opts, className: "intel-popup" });
  marker.on("mouseover", function (this: L.Marker) { this.openPopup(); });
  marker.on("mouseout", function (this: L.Marker) { this.closePopup(); });
  return marker;
}

const newsSeverityColors: Record<string, string> = {
  low: "#22c55e",
  medium: "#00d4ff",
  high: "#ffb800",
  critical: "#ef4444",
};

const SPECIAL_KEYWORDS = /iran|missile|rocket|ballistic|cruise|drone strike|IRGC|quds|hezbollah|houthi|intercept|warhead|launch|strike|attack/i;
const SPECIAL_REGIONS = /iran|jordan|gulf|bahrain|qatar|uae|saudi|kuwait|oman/i;

function isSpecialNews(headline: string, body: string, region: string, category: string): boolean {
  const text = `${headline} ${body} ${region} ${category}`;
  return SPECIAL_KEYWORDS.test(text) || SPECIAL_REGIONS.test(region);
}

const createNewsIcon = (severity: string, category: string, special: boolean) => {
  if (special) {
    const size = 38;
    return L.divIcon({
      className: "news-marker-special",
      html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;border:3px solid #ff0040;box-shadow:0 0 18px #ff0040,0 0 40px rgba(255,0,64,0.3);animation:pulse 1s ease-in-out infinite;"></div>
        <div style="position:absolute;width:${size - 8}px;height:${size - 8}px;border-radius:50%;background:rgba(255,0,64,0.2);"></div>
        <div style="font-size:20px;filter:drop-shadow(0 0 10px #ff0040);animation:pulse 1.5s ease-in-out infinite;">🚀</div>
      </div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      popupAnchor: [0, -(size / 2 + 4)],
    });
  }
  const color = newsSeverityColors[severity] || "#00d4ff";
  const emoji = category === "MILITARY" ? "⚔️" : category === "DIPLOMATIC" ? "🏛️" : category === "ECONOMIC" ? "💰" : category === "HUMANITARIAN" ? "🩺" : "📰";
  return L.divIcon({
    className: "news-marker-icon",
    html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
      <div style="position:absolute;width:30px;height:30px;border-radius:50%;border:2px solid ${color};opacity:0.5;animation:pulse 2.5s ease-in-out infinite;"></div>
      <div style="position:absolute;width:20px;height:20px;border-radius:50%;background:${color};opacity:0.15;"></div>
      <div style="font-size:14px;filter:drop-shadow(0 0 6px ${color});">${emoji}</div>
    </div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
};

export const IntelMap = ({ airspaceAlerts, vessels, geoAlerts, rockets, layers, onToggleLayer, safetyData, flyToTarget, newsMarkers = [], telegramMarkers = [], fusionEvents = [] }: IntelMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const userItemsGroupRef = useRef<L.LayerGroup | null>(null);
  const bordersGroupRef = useRef<L.LayerGroup | null>(null);
  const earthquakeGroupRef = useRef<L.LayerGroup | null>(null);
  const wildfireGroupRef = useRef<L.LayerGroup | null>(null);
  const conflictGroupRef = useRef<L.LayerGroup | null>(null);
  const newsGroupRef = useRef<L.LayerGroup | null>(null);
  const telegramGroupRef = useRef<L.LayerGroup | null>(null);
  const up42GroupRef = useRef<L.LayerGroup | null>(null);
  const fusionGroupRef = useRef<L.LayerGroup | null>(null);
  const cctvGroupRef = useRef<L.LayerGroup | null>(null);
  const flightGroupRef = useRef<L.LayerGroup | null>(null);
  const chokeGroupRef = useRef<L.LayerGroup | null>(null);
  const nuclearGroupRef = useRef<L.LayerGroup | null>(null);
  const airQualityGroupRef = useRef<L.LayerGroup | null>(null);
  const aisGroupRef = useRef<L.LayerGroup | null>(null);
  const cityGroupRef = useRef<L.LayerGroup | null>(null);
  const weatherTileRef = useRef<L.TileLayer | null>(null);
  const tileLayersRef = useRef<Map<string, L.TileLayer>>(new Map());
  const [imageryLayers, setImageryLayers] = useState<ImageryLayer[]>(DEFAULT_IMAGERY_LAYERS);
  const [up42Features, setUp42Features] = useState<UP42Feature[]>([]);
  const [mapBounds, setMapBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(null);
  const [showArabCCTV, setShowArabCCTV] = useState(false);
  const [arabCameras, setArabCameras] = useState<any[]>([]);
  const [loadingCCTV, setLoadingCCTV] = useState(false);

  // Flight tracking state
  interface FlightAircraft {
    icao24: string; callsign: string; origin_country: string;
    lat: number; lng: number; altitude: number; velocity: number;
    heading: number; vertical_rate: number; is_military: boolean;
    registration?: string; type?: string;
  }
  const [flightData, setFlightData] = useState<FlightAircraft[]>([]);
  const flightSnapshotRef = useRef<FlightAircraft[]>([]);
  const flightLastPollRef = useRef<number>(Date.now());
  const [interpolatedFlights, setInterpolatedFlights] = useState<FlightAircraft[]>([]);
  const flightTrailsRef = useRef<Record<string, { lat: number; lng: number; ts: number }[]>>({});
  const flightIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flightInterpRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [trackedFlightId, setTrackedFlightId] = useState<string | null>(null);
  const [flightSource, setFlightSource] = useState<string>("");
  const prevFlightPositions = useRef<Record<string, { lat: number; lng: number }>>({}); 

  // OSINT data hooks
  const earthquakes = useEarthquakes();
  const wildfires = useWildfires();
  const conflictEvents = useConflictEvents();
  const nuclearMonitors = useNuclearMonitors();
  const airQuality = useAirQuality();
  const aisVessels = useAISVessels();

  // FlyTo effect — when a news update is clicked, zoom to its location
  const flyToMarkerRef = useRef<L.Marker | null>(null);
  useEffect(() => {
    if (!flyToTarget || !mapRef.current) return;
    const { lat, lng, label } = flyToTarget;
    mapRef.current.flyTo([lat, lng], 8, { duration: 1.5 });

    // Also open 3D view at this location with event context
    // Find matching geo_alert for extra metadata
    const matchingAlert = geoAlerts.find(g => Math.abs(g.lat - lat) < 0.5 && Math.abs(g.lng - lng) < 0.5);
    setUrbanScene3DTarget({
      lat, lng, label,
      severity: matchingAlert?.severity,
      source: matchingAlert?.source,
      type: matchingAlert?.type,
      summary: matchingAlert?.summary,
    });
    setShowUrbanScene(true);
    
    // Remove previous flyTo marker
    if (flyToMarkerRef.current) {
      flyToMarkerRef.current.remove();
    }
    
    // Add a pulsing marker at the target location
    const icon = L.divIcon({
      className: "flyto-pulse-marker",
      html: `<div style="position:relative;width:24px;height:24px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:hsl(var(--primary));opacity:0.3;animation:flyto-ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="position:absolute;inset:6px;border-radius:50%;background:hsl(var(--primary));border:2px solid white;"></div>
      </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    
    const marker = L.marker([lat, lng], { icon })
      .bindPopup(`<div style="${popupStyle}"><div style="color:#00d4ff;font-weight:700;">📰 AI NEWS</div><div>${label}</div></div>`, { className: "intel-popup" })
      .addTo(mapRef.current);
    marker.openPopup();
    flyToMarkerRef.current = marker;
    
    // Auto-remove after 15 seconds
    setTimeout(() => {
      if (flyToMarkerRef.current === marker) {
        marker.remove();
        flyToMarkerRef.current = null;
      }
    }, 15000);
  }, [flyToTarget]);

  // Render AI news markers on map
  useEffect(() => {
    const group = newsGroupRef.current;
    if (!group) return;
    group.clearLayers();

    newsMarkers.forEach((update) => {
      if (!update.lat || !update.lng) return;
      const special = isSpecialNews(update.headline, update.body || "", update.region, update.category);
      const icon = createNewsIcon(update.severity, update.category, special);
      const severityLabel = update.severity.toUpperCase();
      const color = special ? "#ff0040" : (newsSeverityColors[update.severity] || "#00d4ff");
      const badge = special ? `<div style="background:#ff0040;color:#fff;font-size:8px;font-weight:700;padding:1px 6px;border-radius:3px;display:inline-block;margin-bottom:4px;letter-spacing:1px;">⚠ SPECIAL ALERT</div>` : "";
      const marker = L.marker([update.lat, update.lng], { icon, zIndexOffset: special ? 1000 : 0 });
      bindHoverPopup(marker, `<div style="${popupStyle}">
          ${badge}
          <div style="color:${color};font-weight:700;font-size:12px;margin-bottom:4px;">${special ? "🚀" : "📰"} AI INTEL — ${update.region}</div>
          <div style="color:#fff;font-size:11px;margin-bottom:4px;">${update.headline}</div>
          <div style="color:#aaa;font-size:10px;margin-bottom:4px;">${update.body?.slice(0, 120) || ""}${update.body && update.body.length > 120 ? "…" : ""}</div>
          <div style="display:flex;gap:8px;margin-top:4px;">
            <span style="color:${color};font-size:9px;font-weight:600;">● ${severityLabel}</span>
            <span style="color:#888;font-size:9px;">${update.category}</span>
            <span style="color:#666;font-size:9px;">${update.source}</span>
          </div>
        </div>`);
      group.addLayer(marker);

      // Threat radius for special alerts
      if (special) {
        const radius = L.circle([update.lat, update.lng], {
          radius: 50000,
          color: "#ff0040",
          fillColor: "#ff0040",
          fillOpacity: 0.06,
          weight: 1.5,
          dashArray: "6 4",
          className: "threat-radius-circle",
        });
        group.addLayer(radius);
      }
    });
  }, [newsMarkers]);


  // Render WarsLeaks Telegram markers on map
  useEffect(() => {
    const group = telegramGroupRef.current;
    if (!group) return;
    group.clearLayers();

    const categoryEmojis: Record<string, string> = {
      MISSILE: "🚀", MILITARY: "⚔️", NAVAL: "⚓", DRONE: "🛩️",
      AIRSTRIKE: "💣", EXPLOSION: "💥", PROTEST: "✊", DIPLOMATIC: "🏛️", HUMANITARIAN: "🩺",
    };

    telegramMarkers.forEach((tm) => {
      const emoji = categoryEmojis[tm.category] || "📡";
      const color = tm.special ? "#ff0040" : (newsSeverityColors[tm.severity] || "#a855f7");
      const size = tm.special ? 36 : 28;
      const glowColor = tm.special ? "#ff0040" : "#a855f7";

      const icon = L.divIcon({
        className: "telegram-marker",
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:${size}px;height:${size}px;border-radius:50%;border:${tm.special ? 3 : 2}px solid ${color};box-shadow:0 0 ${tm.special ? 16 : 8}px ${glowColor};animation:pulse ${tm.special ? '1s' : '2.5s'} ease-in-out infinite;"></div>
          <div style="position:absolute;width:${size - 10}px;height:${size - 10}px;border-radius:50%;background:${color};opacity:0.15;"></div>
          <div style="font-size:${tm.special ? 18 : 14}px;filter:drop-shadow(0 0 ${tm.special ? 10 : 6}px ${glowColor});">${emoji}</div>
        </div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -(size / 2 + 4)],
      });

      const badge = tm.special
        ? `<div style="background:#ff0040;color:#fff;font-size:8px;font-weight:700;padding:1px 6px;border-radius:3px;display:inline-block;margin-bottom:4px;letter-spacing:1px;">⚠ WARSLEAKS SPECIAL</div>`
        : `<div style="background:#a855f7;color:#fff;font-size:8px;font-weight:700;padding:1px 6px;border-radius:3px;display:inline-block;margin-bottom:4px;letter-spacing:1px;">📡 WARSLEAKS</div>`;

      const marker = L.marker([tm.lat, tm.lng], { icon, zIndexOffset: tm.special ? 1200 : 500 });
      bindHoverPopup(marker, `<div style="${popupStyle}">
          ${badge}
          <div style="color:${color};font-weight:700;font-size:12px;margin-bottom:4px;">${emoji} ${tm.headline}</div>
          <div style="color:#aaa;font-size:10px;margin-bottom:4px;">${tm.summary}</div>
          <div style="display:flex;gap:8px;margin-top:4px;">
            <span style="color:${color};font-size:9px;font-weight:600;">● ${tm.severity.toUpperCase()}</span>
            <span style="color:#888;font-size:9px;">${tm.category}</span>
            <span style="color:#a855f7;font-size:9px;">WarsLeaks</span>
          </div>
        </div>`);
      group.addLayer(marker);

      // Threat radius for special WarsLeaks alerts
      if (tm.special) {
        const radius = L.circle([tm.lat, tm.lng], {
          radius: 60000,
          color: "#ff0040",
          fillColor: "#ff0040",
          fillOpacity: 0.05,
          weight: 1.5,
          dashArray: "6 4",
          className: "threat-radius-circle",
        });
        group.addLayer(radius);
      }
    });
  }, [telegramMarkers]);

  // Render Geo Fusion events on map
  useEffect(() => {
    const group = fusionGroupRef.current;
    if (!group) return;
    group.clearLayers();

    const fusionEmojis: Record<string, string> = {
      airstrike: "💥", missile_launch: "🚀", drone_attack: "🛩️", explosion: "💣",
      border_clash: "⚔️", airspace_closure: "✈️", shipping_disruption: "🚢",
      infrastructure_damage: "🏗️", political_announcement: "🏛️",
      satellite_observation: "🛰️", fire_hotspot: "🔥",
    };
    const fusionColors: Record<string, string> = {
      airstrike: "#ef4444", missile_launch: "#ff0040", drone_attack: "#ff6b00", explosion: "#ef4444",
      border_clash: "#dc2626", airspace_closure: "#eab308", shipping_disruption: "#3b82f6",
      infrastructure_damage: "#f97316", political_announcement: "#ffffff",
      satellite_observation: "#8b5cf6", fire_hotspot: "#ff4500",
    };

    fusionEvents.forEach((evt) => {
      if (!evt.lat || !evt.lng) return;
      const emoji = fusionEmojis[evt.event_type] || "📡";
      const color = fusionColors[evt.event_type] || "#00d4ff";
      const isCritical = evt.severity >= 4;
      const isFlashing = evt.event_type === "missile_launch" || evt.event_type === "airstrike" || evt.severity >= 4;
      const size = isCritical ? 20 : evt.severity >= 3 ? 16 : 14;
      const icon = L.divIcon({
        className: "fusion-event-icon",
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
          ${isFlashing ? `<div style="position:absolute;width:${size + 10}px;height:${size + 10}px;border-radius:50%;border:2px solid ${color};opacity:0.5;animation:pulse 1s ease-in-out infinite;"></div>` : ""}
          ${isCritical ? `<div style="position:absolute;width:${size + 4}px;height:${size + 4}px;border-radius:50%;background:${color};opacity:0.15;"></div>` : ""}
          <div style="font-size:${size}px;filter:drop-shadow(0 0 8px ${color});${isFlashing ? "animation:pulse 1.5s ease-in-out infinite;" : ""}">${emoji}</div>
        </div>`,
        iconSize: [size + 10, size + 10],
        iconAnchor: [(size + 10) / 2, (size + 10) / 2],
        popupAnchor: [0, -(size / 2 + 4)],
      });

      const confColor = evt.confidence === "high" ? "#22c55e" : evt.confidence === "medium" ? "#eab308" : "#888";
      const sevLabel = ["", "Minor", "Localized", "Multiple", "Regional", "Major"][evt.severity] || `Sev ${evt.severity}`;
      const marker = L.marker([evt.lat, evt.lng], { icon, zIndexOffset: isCritical ? 900 : evt.severity * 100 });
      bindHoverPopup(marker, `<div style="${popupStyle}">
        <div style="color:${color};font-weight:700;font-size:12px;margin-bottom:4px;">${emoji} ${evt.event_type.replace(/_/g, " ").toUpperCase()} — ${evt.country}</div>
        <div style="color:#fff;font-size:11px;margin-bottom:3px;">${evt.location}</div>
        <div style="color:#ccc;font-size:10px;margin-bottom:4px;">${evt.description}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <span style="color:${color};font-size:9px;font-weight:600;">● SEV ${evt.severity} — ${sevLabel}</span>
          <span style="color:${confColor};font-size:9px;">◆ ${evt.confidence}</span>
          <span style="color:#888;font-size:9px;">📰 ${evt.source}</span>
        </div>
      </div>`);
      group.addLayer(marker);

      // Add threat radius for severity 4-5
      if (evt.severity >= 4) {
        const radius = L.circle([evt.lat, evt.lng], {
          radius: evt.severity >= 5 ? 80000 : 40000,
          color, fillColor: color, fillOpacity: 0.06,
          weight: 1.5, dashArray: "6 4",
        });
        group.addLayer(radius);
      }
    });
  }, [fusionEvents]);



  // User map items state
  const [activeMode, setActiveMode] = useState<MapToolMode>(null);
  const [pendingItem, setPendingItem] = useState<Partial<UserMapItem> | null>(null);
  const [userItems, setUserItems] = useState<UserMapItem[]>([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [28, 48],
      zoom: 5,
      zoomControl: true,
      attributionControl: true,
    });

    // Add initial base layer
    const initBase = DEFAULT_IMAGERY_LAYERS.find(l => l.type === "base" && l.enabled)!;
    const initTile = L.tileLayer(initBase.url, { attribution: initBase.attribution, maxZoom: initBase.maxZoom }).addTo(map);
    tileLayersRef.current.set(initBase.id, initTile);

    bordersGroupRef.current = L.layerGroup().addTo(map);
    overlayGroupRef.current = L.layerGroup().addTo(map);
    earthquakeGroupRef.current = L.layerGroup().addTo(map);
    wildfireGroupRef.current = L.layerGroup().addTo(map);
    conflictGroupRef.current = L.layerGroup().addTo(map);
    up42GroupRef.current = L.layerGroup().addTo(map);
    fusionGroupRef.current = L.layerGroup().addTo(map);
    cctvGroupRef.current = L.layerGroup().addTo(map);
    newsGroupRef.current = L.layerGroup().addTo(map);
    telegramGroupRef.current = L.layerGroup().addTo(map);
    flightGroupRef.current = L.layerGroup().addTo(map);
    chokeGroupRef.current = L.layerGroup().addTo(map);
    nuclearGroupRef.current = L.layerGroup().addTo(map);
    airQualityGroupRef.current = L.layerGroup().addTo(map);
    aisGroupRef.current = L.layerGroup().addTo(map);
    cityGroupRef.current = L.layerGroup().addTo(map);
    userItemsGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Track map bounds for UP42 search
    const updateBounds = () => {
      const b = map.getBounds();
      setMapBounds({ north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() });
    };
    map.on("moveend", updateBounds);
    updateBounds();

    return () => {
      overlayGroupRef.current?.clearLayers();
      bordersGroupRef.current?.clearLayers();
      earthquakeGroupRef.current?.clearLayers();
      wildfireGroupRef.current?.clearLayers();
      conflictGroupRef.current?.clearLayers();
      up42GroupRef.current?.clearLayers();
      fusionGroupRef.current?.clearLayers();
      newsGroupRef.current?.clearLayers();
      telegramGroupRef.current?.clearLayers();
      userItemsGroupRef.current?.clearLayers();
      flightGroupRef.current?.clearLayers();
      chokeGroupRef.current?.clearLayers();
      nuclearGroupRef.current?.clearLayers();
      airQualityGroupRef.current?.clearLayers();
      aisGroupRef.current?.clearLayers();
      if (flightIntervalRef.current) clearInterval(flightIntervalRef.current);
      if (weatherTileRef.current) map.removeLayer(weatherTileRef.current);
      tileLayersRef.current.clear();
      map.remove();
      mapRef.current = null;
      overlayGroupRef.current = null;
      bordersGroupRef.current = null;
      earthquakeGroupRef.current = null;
      wildfireGroupRef.current = null;
      conflictGroupRef.current = null;
      up42GroupRef.current = null;
      fusionGroupRef.current = null;
      newsGroupRef.current = null;
      telegramGroupRef.current = null;
      userItemsGroupRef.current = null;
      flightGroupRef.current = null;
      chokeGroupRef.current = null;
      nuclearGroupRef.current = null;
      airQualityGroupRef.current = null;
      aisGroupRef.current = null;
      weatherTileRef.current = null;
    };
  }, []);

  // Click handler for placing items
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (!activeMode) return;
      setPendingItem({
        type: activeMode,
        lat: e.latlng.lat,
        lng: e.latlng.lng,
      });
    };

    map.on("click", handleClick);
    
    // Change cursor based on mode
    const container = map.getContainer();
    if (activeMode) {
      container.style.cursor = "crosshair";
    } else {
      container.style.cursor = "";
    }

    return () => {
      map.off("click", handleClick);
      container.style.cursor = "";
    };
  }, [activeMode]);

  const handleConfirmItem = useCallback((item: Partial<UserMapItem>) => {
    const newItem: UserMapItem = {
      id: `user-${Date.now()}`,
      type: item.type || "marker",
      lat: item.lat || 0,
      lng: item.lng || 0,
      label: item.label || "Untitled",
      severity: item.severity,
      radius: item.radius,
      details: item.details,
    };
    setUserItems((prev) => [...prev, newItem]);
    setPendingItem(null);
  }, []);

  const handleCancelItem = useCallback(() => {
    setPendingItem(null);
  }, []);

  // Render user items on map
  useEffect(() => {
    const group = userItemsGroupRef.current;
    if (!group) return;
    group.clearLayers();

    userItems.forEach((item) => {
      const config = userItemIcons[item.type || "marker"];

      if (item.type === "danger" && item.radius) {
        const color = severityColors[(item.severity as AirspaceAlert["severity"]) || "medium"];
        L.circle([item.lat, item.lng], {
          radius: (item.radius || 50) * 1000,
          color,
          fillColor: color,
          fillOpacity: 0.1,
          weight: 2,
          dashArray: "6 4",
        }).addTo(group);
      }

      // Pulse ring effect
      L.circleMarker([item.lat, item.lng], {
        radius: 16,
        color: config.color,
        fillColor: config.color,
        fillOpacity: 0.05,
        weight: 1,
        opacity: 0.3,
      }).addTo(group);

      const marker = L.marker([item.lat, item.lng], {
        icon: createUserItemIcon(item.type || "marker"),
      });

      marker.bindPopup(`
        <div style="${popupStyle}">
          <div style="color:${config.color};font-weight:700;margin-bottom:4px;">${item.label}</div>
          <div style="font-size:9px;text-transform:uppercase;opacity:0.5;margin-bottom:4px;">${item.type}</div>
          ${item.details ? `<div style="margin-bottom:4px;">${item.details}</div>` : ""}
          ${item.severity ? `<div>Severity: <span style="color:${severityColors[(item.severity as AirspaceAlert["severity"]) || "medium"]}">${item.severity}</span></div>` : ""}
          ${item.radius ? `<div>Radius: ${item.radius} km</div>` : ""}
        </div>
      `, popupOptions);

      marker.addTo(group);
    });
  }, [userItems]);

  // Sync imagery layers to map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove all existing tile layers
    tileLayersRef.current.forEach((tl) => map.removeLayer(tl));
    tileLayersRef.current.clear();

    // Add enabled base layer first
    const activeBase = imageryLayers.find(l => l.type === "base" && l.enabled);
    if (activeBase) {
      const tl = L.tileLayer(activeBase.url, {
        attribution: activeBase.attribution,
        maxZoom: activeBase.maxZoom,
        opacity: activeBase.opacity,
      }).addTo(map);
      tl.bringToBack();
      tileLayersRef.current.set(activeBase.id, tl);
    }

    // Add enabled overlays on top
    imageryLayers
      .filter(l => l.type === "overlay" && l.enabled)
      .forEach(layer => {
        const tl = L.tileLayer(layer.url, {
          attribution: layer.attribution,
          maxZoom: layer.maxZoom,
          opacity: layer.opacity,
        }).addTo(map);
        tileLayersRef.current.set(layer.id, tl);
      });
  }, [imageryLayers]);

  // Imagery layer handlers
  const handleBaseChange = useCallback((id: string) => {
    setImageryLayers(prev => prev.map(l =>
      l.type === "base" ? { ...l, enabled: l.id === id } : l
    ));
  }, []);

  const handleOverlayToggle = useCallback((id: string) => {
    setImageryLayers(prev => prev.map(l =>
      l.id === id ? { ...l, enabled: !l.enabled } : l
    ));
  }, []);

  const handleOpacityChange = useCallback((id: string, opacity: number) => {
    setImageryLayers(prev => prev.map(l =>
      l.id === id ? { ...l, opacity } : l
    ));
  }, []);

  // Render data layers
  useEffect(() => {
    const group = overlayGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (layers.airspace) {
      airspaceAlerts.filter((a) => a.active).forEach((alert) => {
        const circle = L.circle([alert.lat, alert.lng], {
          radius: alert.radius * 1000,
          color: severityColors[alert.severity],
          fillColor: severityColors[alert.severity],
          fillOpacity: 0.12,
          weight: 1.5,
          dashArray: alert.type === "CLOSURE" ? undefined : "5 5",
        });
        circle.bindPopup(`
          <div style="${popupStyle}">
            <div style="color:${severityColors[alert.severity]};font-weight:700;margin-bottom:4px;">${alert.type} — ${alert.region}</div>
            <div style="margin-bottom:4px;">${alert.description}</div>
            <div style="font-size:9px;opacity:0.6;">${new Date(alert.timestamp).toLocaleString()}</div>
          </div>
        `, popupOptions);
        circle.addTo(group);
      });
    }

    if (layers.maritime) {
      vessels.forEach((vessel) => {
        const marker = L.marker([vessel.lat, vessel.lng], {
          icon: createVesselIcon(vessel.type, vessel.heading),
        });
        marker.bindPopup(`
          <div style="${popupStyle}">
            <div style="color:${vesselColors[vessel.type]};font-weight:700;margin-bottom:4px;">${vessel.name}</div>
            <div>Flag: ${vessel.flag} | Type: ${vessel.type}</div>
            <div>Speed: ${vessel.speed}kts | HDG: ${vessel.heading}°</div>
            ${vessel.destination ? `<div>Dest: ${vessel.destination}</div>` : ""}
            <div style="font-size:9px;opacity:0.6;margin-top:4px;">${new Date(vessel.timestamp).toLocaleString()}</div>
          </div>
        `, popupOptions);
        marker.addTo(group);
      });
    }

    if (layers.alerts) {
      geoAlerts.forEach((alert) => {
        const marker = L.circleMarker([alert.lat, alert.lng], {
          radius: 8,
          color: severityColors[alert.severity],
          fillColor: severityColors[alert.severity],
          fillOpacity: 0.7,
          weight: 2,
        });
        marker.bindPopup(`
          <div style="${popupStyle}">
            <div style="color:${severityColors[alert.severity]};font-weight:700;margin-bottom:4px;">[${alert.type}] ${alert.title}</div>
            <div style="margin-bottom:4px;">${alert.summary}</div>
            <div style="font-size:9px;opacity:0.6;">${alert.source} — ${new Date(alert.timestamp).toLocaleString()}</div>
          </div>
        `, popupOptions);
        marker.addTo(group);
      });
    }

    if (layers.rockets) {
      rockets.forEach((rocket) => {
        const isActive = rocket.status === "launched" || rocket.status === "in_flight";
        const color = rocketStatusColors[rocket.status] || "#ef4444";

        L.polyline(
          [[rocket.originLat, rocket.originLng], [rocket.targetLat, rocket.targetLng]],
          { color, weight: 1.5, opacity: 0.4, dashArray: "6 4" }
        ).addTo(group);

        if (isActive) {
          L.polyline(
            [[rocket.originLat, rocket.originLng], [rocket.currentLat, rocket.currentLng]],
            { color, weight: 2.5, opacity: 0.8 }
          ).addTo(group);
        }

        L.circleMarker([rocket.originLat, rocket.originLng], {
          radius: 4, color, fillColor: color, fillOpacity: 0.5, weight: 1,
        }).addTo(group);

        L.circleMarker([rocket.targetLat, rocket.targetLng], {
          radius: 6, color, fillColor: "transparent", fillOpacity: 0, weight: 2, dashArray: "3 3",
        }).addTo(group);

        const marker = L.marker([rocket.currentLat, rocket.currentLng], {
          icon: createRocketIcon(rocket.status),
        });
        marker.bindPopup(`
          <div style="${popupStyle}">
            <div style="color:${color};font-weight:700;margin-bottom:4px;">🚀 ${rocket.name} [${rocket.type}]</div>
            <div>Status: <span style="color:${color};font-weight:600;">${rocket.status.toUpperCase()}</span></div>
            <div>Speed: ${rocket.speed} km/h | Alt: ${rocket.altitude} km</div>
            <div style="font-size:9px;opacity:0.6;margin-top:4px;">${new Date(rocket.timestamp).toLocaleString()}</div>
          </div>
        `, popupOptions);
        marker.addTo(group);
      });
    }

    if (layers.heatmap) {
      [...airspaceAlerts, ...geoAlerts].forEach((item) => {
        L.circle([item.lat, item.lng], {
          radius: 300000, color: "transparent", fillColor: severityColors[item.severity], fillOpacity: 0.08, weight: 0,
        }).addTo(group);
      });
    }
  }, [airspaceAlerts, vessels, geoAlerts, rockets, layers]);

  // Render chokepoint zones on map
  useEffect(() => {
    const group = chokeGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if (!layers.maritime) return;

    CHOKEPOINTS.forEach((cp) => {
      const circle = L.circle([cp.lat, cp.lng], {
        radius: cp.radiusKm * 1000,
        color: "#00d4ff",
        fillColor: "#00d4ff",
        fillOpacity: 0.04,
        weight: 1.5,
        dashArray: "8 6",
      });
      const nearbyCount = vessels.filter((v) => {
        const dLat = ((v.lat - cp.lat) * Math.PI) / 180;
        const dLng = ((v.lng - cp.lng) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((cp.lat * Math.PI) / 180) * Math.cos((v.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= cp.radiusKm;
      }).length;
      circle.bindPopup(`<div style="${popupStyle}"><div style="color:#00d4ff;font-weight:700;margin-bottom:4px;">⚓ ${cp.name}</div><div>Vessels in zone: <b>${nearbyCount}</b></div><div>Radius: ${cp.radiusKm} km</div><div style="margin-top:4px;font-size:9px;opacity:0.7;">${cp.criticalNote}</div></div>`, popupOptions);
      circle.addTo(group);
      L.marker([cp.lat, cp.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div style="font-family:'JetBrains Mono',monospace;font-size:8px;color:#00d4ff;text-shadow:0 0 8px rgba(0,212,255,0.6);white-space:nowrap;text-align:center;pointer-events:none;font-weight:700;letter-spacing:1px;">⚓ ${cp.shortName}<br/><span style="font-size:7px;opacity:0.7;">${nearbyCount} vessels</span></div>`,
          iconSize: [120, 28],
          iconAnchor: [60, 14],
        }),
        interactive: false,
      }).addTo(group);
    });
  }, [vessels, layers.maritime]);


  useEffect(() => {
    const group = earthquakeGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (!layers.earthquakes || earthquakes.data.length === 0) return;

    earthquakes.data.forEach((eq) => {
      const color = getQuakeColor(eq.magnitude);
      const radius = getQuakeRadius(eq.magnitude);

      // Pulsing ring for significant quakes
      if (eq.magnitude >= 5) {
        L.circleMarker([eq.lat, eq.lng], {
          radius: radius + 8,
          color,
          fillColor: color,
          fillOpacity: 0.08,
          weight: 1,
          opacity: 0.3,
        }).addTo(group);
      }

      const marker = L.circleMarker([eq.lat, eq.lng], {
        radius,
        color,
        fillColor: color,
        fillOpacity: 0.6,
        weight: eq.magnitude >= 5 ? 2.5 : 1.5,
      });

      marker.bindPopup(`
        <div style="${popupStyle}">
          <div style="color:${color};font-weight:700;margin-bottom:4px;">🌍 M${eq.magnitude.toFixed(1)} Earthquake</div>
          <div>${eq.place || "Unknown location"}</div>
          <div>Depth: ${eq.depth.toFixed(1)} km</div>
          ${eq.tsunami ? '<div style="color:#ef4444;font-weight:700;">⚠ TSUNAMI WARNING</div>' : ""}
          ${eq.felt ? `<div>Felt by: ${eq.felt} reports</div>` : ""}
          <div style="font-size:9px;opacity:0.6;margin-top:4px;">${new Date(eq.time).toLocaleString()}</div>
          ${eq.url ? `<div style="margin-top:4px;"><a href="${eq.url}" target="_blank" style="color:#00d4ff;text-decoration:underline;font-size:9px;">USGS Details →</a></div>` : ""}
        </div>
      `, popupOptions);

      marker.addTo(group);
    });
  }, [earthquakes.data, layers.earthquakes]);

  // Render wildfire layer
  useEffect(() => {
    const group = wildfireGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (!layers.wildfires || wildfires.data.length === 0) return;

    wildfires.data.forEach((fire) => {
      // Heat glow for intense fires
      if (fire.frp > 50) {
        L.circleMarker([fire.lat, fire.lng], {
          radius: Math.min(20, 8 + fire.frp / 20),
          color: "transparent",
          fillColor: "#ff4500",
          fillOpacity: 0.12,
          weight: 0,
        }).addTo(group);
      }

      const marker = L.marker([fire.lat, fire.lng], {
        icon: createFireIcon(fire.frp),
      });

      const intensity = fire.frp > 100 ? "EXTREME" : fire.frp > 50 ? "HIGH" : fire.frp > 20 ? "MODERATE" : "LOW";
      const intColor = fire.frp > 100 ? "#ff0000" : fire.frp > 50 ? "#ff4500" : fire.frp > 20 ? "#ff6b00" : "#ffb800";

      marker.bindPopup(`
        <div style="${popupStyle}">
          <div style="color:${intColor};font-weight:700;margin-bottom:4px;">🔥 Active Fire</div>
          <div>Intensity: <span style="color:${intColor};font-weight:600;">${intensity}</span></div>
          <div>FRP: ${fire.frp.toFixed(1)} MW | Brightness: ${fire.brightness.toFixed(0)}K</div>
          <div>Confidence: ${fire.confidence}</div>
          ${fire.region ? `<div>Region: ${fire.region}</div>` : ""}
          <div style="font-size:9px;opacity:0.6;margin-top:4px;">${fire.date} ${fire.time}</div>
        </div>
      `, popupOptions);

      marker.addTo(group);
    });
  }, [wildfires.data, layers.wildfires]);

  // Render conflict events layer
  useEffect(() => {
    const group = conflictGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (!layers.conflicts || conflictEvents.data.length === 0) return;

    conflictEvents.data.forEach((event) => {
      const color = conflictTypeColors[event.event_type] || "#ef4444";

      const marker = L.marker([event.lat, event.lng], {
        icon: createConflictIcon(event.event_type, event.severity),
      });

      marker.bindPopup(`
        <div style="${popupStyle}">
          <div style="color:${color};font-weight:700;margin-bottom:4px;">
            ${conflictTypeEmojis[event.event_type] || "⚔️"} ${event.event_type}
          </div>
          <div style="font-size:10px;opacity:0.7;margin-bottom:4px;">${event.sub_event_type || ""}</div>
          <div style="margin-bottom:4px;">${event.notes}</div>
          <div>Location: <b>${event.location}</b>, ${event.admin1}, ${event.country}</div>
          <div>Actors: ${event.actor1}${event.actor2 ? ` vs ${event.actor2}` : ""}</div>
          ${event.fatalities > 0 ? `<div style="color:#ef4444;">Fatalities: ${event.fatalities}</div>` : ""}
          <div style="font-size:9px;opacity:0.6;margin-top:4px;">${event.event_date} — ${event.source}</div>
        </div>
      `, popupOptions);

      marker.addTo(group);
    });
  }, [conflictEvents.data, layers.conflicts]);

  // ===== NUCLEAR / RADIATION MONITORING LAYER =====
  useEffect(() => {
    const group = nuclearGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if (!layers.nuclear) return;

    // Render nuclear facilities
    nuclearMonitors.facilities.forEach((f) => {
      const statusColor = f.status === "operational" ? "#eab308" : f.status === "construction" ? "#3b82f6" : f.status === "occupied" ? "#ef4444" : "#888";
      const typeEmoji = f.type === "power_plant" ? "⚛️" : f.type === "enrichment" ? "🔬" : f.type === "research_reactor" ? "🧪" : "🏭";
      const size = f.type === "power_plant" ? 22 : 18;
      const icon = L.divIcon({
        className: "nuclear-facility-icon",
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:${size + 8}px;height:${size + 8}px;border-radius:50%;border:2px solid ${statusColor};opacity:0.4;animation:pulse 3s ease-in-out infinite;"></div>
          <div style="position:absolute;width:${size + 16}px;height:${size + 16}px;border-radius:50%;border:1px dashed ${statusColor};opacity:0.2;"></div>
          <div style="font-size:${size}px;filter:drop-shadow(0 0 6px ${statusColor});">${typeEmoji}</div>
        </div>`,
        iconSize: [size + 16, size + 16],
        iconAnchor: [(size + 16) / 2, (size + 16) / 2],
        popupAnchor: [0, -(size / 2 + 4)],
      });
      const marker = L.marker([f.lat, f.lng], { icon, zIndexOffset: 600 });
      bindHoverPopup(marker, `<div style="${popupStyle}">
        <div style="color:${statusColor};font-weight:700;font-size:12px;margin-bottom:4px;">${typeEmoji} ${f.name}</div>
        <div>Country: <b>${f.country}</b></div>
        <div>Type: ${f.type.replace(/_/g, " ")}</div>
        <div>Status: <span style="color:${statusColor};font-weight:600;">${f.status.toUpperCase()}</span></div>
        ${f.capacity_mw ? `<div>Capacity: ${f.capacity_mw} MW</div>` : ""}
        <div style="font-size:8px;opacity:0.5;margin-top:4px;">Source: IAEA Registry</div>
      </div>`);
      group.addLayer(marker);

      // Exclusion zone circle for facilities
      L.circle([f.lat, f.lng], {
        radius: 30000, color: statusColor, fillColor: statusColor,
        fillOpacity: 0.04, weight: 1, dashArray: "8 4", opacity: 0.3,
      }).addTo(group);
    });

    // Render radiation monitoring stations
    nuclearMonitors.stations.forEach((s) => {
      const statusColor = s.status === "elevated" ? "#ef4444" : s.status === "above_normal" ? "#f97316" : "#22c55e";
      const icon = L.divIcon({
        className: "radiation-station-icon",
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:14px;height:14px;border-radius:50%;background:${statusColor};opacity:0.2;"></div>
          <div style="width:8px;height:8px;border-radius:50%;background:${statusColor};border:1.5px solid rgba(0,0,0,0.5);box-shadow:0 0 6px ${statusColor};"></div>
        </div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -10],
      });
      const marker = L.marker([s.lat, s.lng], { icon, zIndexOffset: 400 });
      bindHoverPopup(marker, `<div style="${popupStyle}">
        <div style="color:${statusColor};font-weight:700;font-size:12px;margin-bottom:4px;">☢️ ${s.name}</div>
        <div>Dose Rate: <span style="color:${statusColor};font-weight:700;">${s.dose_rate} ${s.unit}</span></div>
        <div>Status: <span style="color:${statusColor};">${s.status.toUpperCase()}</span></div>
        <div>Network: ${s.network} · ${s.country}</div>
        <div style="font-size:8px;opacity:0.5;margin-top:4px;">${new Date(s.timestamp).toLocaleString()}</div>
      </div>`);
      group.addLayer(marker);
    });
  }, [nuclearMonitors.stations, nuclearMonitors.facilities, layers.nuclear]);

  // ===== AIR QUALITY MONITORING LAYER =====
  useEffect(() => {
    const group = airQualityGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if (!layers.airQuality || airQuality.data.length === 0) return;

    const aqiColors: Record<string, string> = {
      good: "#22c55e",
      moderate: "#eab308",
      unhealthy_sensitive: "#f97316",
      unhealthy: "#ef4444",
      very_unhealthy: "#a855f7",
      hazardous: "#7f1d1d",
      unknown: "#888",
    };

    airQuality.data.forEach((s) => {
      const color = aqiColors[s.aqi_level] || "#888";
      const aqiVal = s.aqi ?? 0;
      const icon = L.divIcon({
        className: "air-quality-icon",
        html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer;">
          <div style="background:rgba(0,0,0,0.85);border:1.5px solid ${color};border-radius:6px;padding:2px 5px;display:flex;align-items:center;gap:2px;backdrop-filter:blur(4px);">
            <span style="font-size:9px;">💨</span>
            <span style="font-size:9px;font-weight:700;color:${color};font-family:monospace;">${aqiVal}</span>
          </div>
          <span style="font-size:6px;color:rgba(255,255,255,0.4);font-family:monospace;margin-top:1px;">${s.city || ""}</span>
        </div>`,
        iconSize: [44, 28],
        iconAnchor: [22, 14],
      });
      const marker = L.marker([s.lat, s.lng], { icon, zIndexOffset: 250 });
      const levelLabel = s.aqi_level.replace(/_/g, " ").toUpperCase();
      bindHoverPopup(marker, `<div style="${popupStyle}">
        <div style="color:${color};font-weight:700;font-size:12px;margin-bottom:4px;">💨 ${s.name}</div>
        <div>${s.city}, ${s.country}</div>
        <div>AQI: <span style="color:${color};font-weight:700;">${aqiVal}</span> — <span style="color:${color};">${levelLabel}</span></div>
        ${s.pm25 != null ? `<div>PM2.5: ${s.pm25} µg/m³</div>` : ""}
        ${s.pm10 != null ? `<div>PM10: ${s.pm10} µg/m³</div>` : ""}
        <div style="font-size:8px;opacity:0.5;margin-top:4px;">Source: ${s.source} · ${new Date(s.last_updated).toLocaleString()}</div>
      </div>`);
      group.addLayer(marker);
    });
  }, [airQuality.data, layers.airQuality]);

  // ===== LIVE AIS VESSEL TRACKING LAYER =====
  useEffect(() => {
    const group = aisGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if (!layers.aisVessels || aisVessels.data.length === 0) return;

    const aisTypeColors: Record<string, string> = {
      MILITARY: "#ef4444", CARGO: "#3b82f6", TANKER: "#f97316", FISHING: "#22c55e", UNKNOWN: "#888",
    };

    aisVessels.data.forEach((v) => {
      const color = aisTypeColors[v.type] || "#888";
      const icon = L.divIcon({
        className: "ais-vessel-icon",
        html: `<div style="transform:rotate(${v.heading}deg);color:${color};font-size:14px;text-shadow:0 0 8px ${color};filter:drop-shadow(0 0 4px ${color});">▲</div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        popupAnchor: [0, -12],
      });
      const marker = L.marker([v.lat, v.lng], { icon, zIndexOffset: 300 });
      bindHoverPopup(marker, `<div style="${popupStyle}">
        <div style="color:${color};font-weight:700;font-size:12px;margin-bottom:4px;">🚢 ${v.name}</div>
        <div>MMSI: ${v.mmsi} | Type: ${v.type}</div>
        <div>Speed: ${v.speed} kts | HDG: ${v.heading}°</div>
        <div>Flag: ${v.flag}</div>
        ${v.destination ? `<div>Dest: ${v.destination}</div>` : ""}
        <div style="font-size:8px;opacity:0.5;margin-top:4px;">Source: ${v.source} (Live AIS)</div>
      </div>`);
      group.addLayer(marker);
    });
  }, [aisVessels.data, layers.aisVessels]);

  // ===== LIVE FLIGHT TRACKING LAYER =====
  const fetchFlightData = useCallback(async () => {
    if (!layers.flights) return;
    const map = mapRef.current;
    let bbox: any;
    if (map) {
      const bounds = map.getBounds();
      bbox = { lamin: bounds.getSouth(), lamax: bounds.getNorth(), lomin: bounds.getWest(), lomax: bounds.getEast() };
    }
    if (!bbox) bbox = { lamin: -60, lamax: 70, lomin: -180, lomax: 180 };
    try {
      const { data, error } = await supabase.functions.invoke("live-flights", { body: bbox });
      if (!error && data?.aircraft) {
        const newAircraft: FlightAircraft[] = data.aircraft;
        if (data.source) setFlightSource(data.source);
        const now = Date.now();
        const history = { ...flightTrailsRef.current };
        const prevPos = { ...prevFlightPositions.current };
        newAircraft.forEach((ac) => {
          const trail = history[ac.icao24] || [];
          const last = trail[trail.length - 1];
          if (!last || Math.abs(last.lat - ac.lat) > 0.001 || Math.abs(last.lng - ac.lng) > 0.001) {
            trail.push({ lat: ac.lat, lng: ac.lng, ts: now });
          }
          history[ac.icao24] = trail.filter(p => now - p.ts < 600000).slice(-20);
          prevPos[ac.icao24] = { lat: ac.lat, lng: ac.lng };
        });
        const activeIds = new Set(newAircraft.map(a => a.icao24));
        Object.keys(history).forEach(id => { if (!activeIds.has(id)) delete history[id]; });
        Object.keys(prevPos).forEach(id => { if (!activeIds.has(id)) delete prevPos[id]; });
        flightTrailsRef.current = history;
        prevFlightPositions.current = prevPos;
        flightSnapshotRef.current = newAircraft;
        flightLastPollRef.current = Date.now();
        setFlightData(newAircraft);
        setInterpolatedFlights(newAircraft);
      }
    } catch (e) { console.error("Flight fetch error:", e); }
  }, [layers.flights]);

  useEffect(() => {
    if (!layers.flights) {
      flightGroupRef.current?.clearLayers();
      setFlightData([]);
      setInterpolatedFlights([]);
      if (flightIntervalRef.current) { clearInterval(flightIntervalRef.current); flightIntervalRef.current = null; }
      if (flightInterpRef.current) { clearInterval(flightInterpRef.current); flightInterpRef.current = null; }
      return;
    }
    fetchFlightData();
    flightIntervalRef.current = setInterval(fetchFlightData, 15000);
    return () => {
      if (flightIntervalRef.current) { clearInterval(flightIntervalRef.current); flightIntervalRef.current = null; }
    };
  }, [fetchFlightData, layers.flights]);

  // ===== REAL-TIME INTERPOLATION ENGINE for 2D map =====
  useEffect(() => {
    if (!layers.flights) return;
    flightInterpRef.current = setInterval(() => {
      const snapshot = flightSnapshotRef.current;
      if (snapshot.length === 0) return;
      const elapsed = (Date.now() - flightLastPollRef.current) / 1000;
      const moved = snapshot.map(ac => {
        const headingRad = ac.heading * Math.PI / 180;
        const speedDegPerSec = ac.velocity / 111320;
        const dLat = Math.cos(headingRad) * speedDegPerSec * elapsed;
        const dLng = Math.sin(headingRad) * speedDegPerSec * elapsed / Math.max(Math.cos(ac.lat * Math.PI / 180), 0.01);
        return { ...ac, lat: ac.lat + dLat, lng: ac.lng + dLng };
      });
      setInterpolatedFlights(moved);
    }, 200);
    return () => { if (flightInterpRef.current) { clearInterval(flightInterpRef.current); flightInterpRef.current = null; } };
  }, [layers.flights]);

  // Click-to-track: pan to tracked aircraft on each data update
  useEffect(() => {
    if (!trackedFlightId || !mapRef.current) return;
    const ac = interpolatedFlights.find(f => f.icao24 === trackedFlightId);
    if (ac) {
      mapRef.current.panTo([ac.lat, ac.lng], { animate: true, duration: 0.8 });
    } else {
      setTrackedFlightId(null);
    }
  }, [interpolatedFlights, trackedFlightId]);

  // Render flights on map — optimized with proper aircraft icons
  useEffect(() => {
    const group = flightGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (!layers.flights || interpolatedFlights.length === 0) return;

    console.log(`[FLIGHTS] Rendering ${interpolatedFlights.length} aircraft on map`, interpolatedFlights.map(a => `${a.callsign}@${a.lat.toFixed(2)},${a.lng.toFixed(2)}`));

    interpolatedFlights.forEach((ac) => {
      const isMil = ac.is_military;
      const color = isMil ? "#ef4444" : "#22d3ee";
      const trailColor = isMil ? "#ef444480" : "#22d3ee40";
      const isTracked = trackedFlightId === ac.icao24;
      const size = isTracked ? 32 : (isMil ? 28 : 24);

      // Draw trail polyline with animated dotted lines
      const trail = flightTrailsRef.current[ac.icao24] || [];
      if (trail.length >= 2) {
        const fullPath: L.LatLngExpression[] = [...trail.map(p => [p.lat, p.lng] as L.LatLngTuple), [ac.lat, ac.lng]];
        // Faded older trail — animated dashes
        if (fullPath.length > 3) {
          L.polyline(fullPath.slice(0, -2), {
            color: trailColor,
            weight: isTracked ? 2.5 : 1.5,
            opacity: 0.4,
            dashArray: "8 6",
            className: "flight-trail-animated",
          }).addTo(group);
        }
        // Bright recent trail — animated dashes
        L.polyline(fullPath.slice(-4), {
          color,
          weight: isTracked ? 3 : 2,
          opacity: isTracked ? 0.9 : 0.7,
          dashArray: "10 5",
          className: "flight-trail-animated",
        }).addTo(group);
      }

      // Forward prediction line — animated dotted
      const headingRad = ac.heading * Math.PI / 180;
      const speedKmh = ac.velocity * 3.6;
      const predMinutes = isTracked ? 5 : (isMil ? 3 : 2);
      const predDistKm = Math.max(speedKmh * (predMinutes / 60), 8);
      const predColor = isTracked ? "#22c55e" : (isMil ? "#f97316" : "#60a5fa");
      const predOpacity = isTracked ? 0.5 : (isMil ? 0.35 : 0.2);
      const fwdPoints: L.LatLngExpression[] = [[ac.lat, ac.lng]];
      for (let step = 1; step <= 3; step++) {
        const d = (predDistKm * step / 3) / 111.32;
        fwdPoints.push([
          ac.lat + Math.cos(headingRad) * d,
          ac.lng + Math.sin(headingRad) * d / Math.cos(ac.lat * Math.PI / 180),
        ]);
      }
      L.polyline(fwdPoints, {
        color: predColor,
        weight: isTracked ? 2.5 : 1.5,
        opacity: predOpacity,
        dashArray: "6 8",
        className: "flight-prediction-animated",
      }).addTo(group);

      // Realistic airplane silhouette (top-down, nose up)
      const planePath = "M16 3 l-1.5 4.5 l-10 5 l0 2.2 l10-3 l0 6.5 l-3.5 2.8 l0 1.8 l3.5-1.2 l1.5 2 l1.5-2 l3.5 1.2 l0-1.8 l-3.5-2.8 l0-6.5 l10 3 l0-2.2 l-10-5 l-1.5-4.5z";
      const glowFilter = `<defs><filter id="glow-${ac.icao24.replace(/[^a-z0-9]/gi,'')}"><feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-color="${color}" flood-opacity="0.9"/></filter></defs>`;
      const aircraftSvg = `<svg width="${size}" height="${size}" viewBox="0 0 32 32" class="flight-icon-svg" style="--flight-color:${color};transform:rotate(${ac.heading}deg);">
            ${glowFilter}
            <path d="${planePath}" fill="${color}" stroke="rgba(255,255,255,0.4)" stroke-width="0.6" filter="url(#glow-${ac.icao24.replace(/[^a-z0-9]/gi,'')})"/>
          </svg>`;

      const trackedRingHtml = isTracked
        ? `<div class="flight-tracked-ring" style="--flight-color:${color};"></div>`
        : "";

      const wrapSize = size + 16;
      const icon = L.divIcon({
        className: "flight-leaflet-icon",
        html: `<div class="flight-marker-wrap" style="--flight-color:${color};width:${wrapSize}px;height:${wrapSize}px;">
          ${trackedRingHtml}
          <div class="flight-pulse-ring" style="--flight-color:${color};"></div>
          ${aircraftSvg}
        </div>`,
        iconSize: [wrapSize, wrapSize],
        iconAnchor: [wrapSize / 2, wrapSize / 2],
        popupAnchor: [0, -(size / 2 + 8)],
      });

      const marker = L.marker([ac.lat, ac.lng], { icon, zIndexOffset: isTracked ? 1500 : (isMil ? 800 : 400) });

      // Click to track
      marker.on("click", () => {
        setTrackedFlightId(prev => prev === ac.icao24 ? null : ac.icao24);
      });

      // Hover popup
      const altFt = Math.round(ac.altitude * 3.281);
      const speedKts = Math.round(ac.velocity * 1.944);
      const speedKmhDisplay = Math.round(ac.velocity * 3.6);
      const vsArrow = ac.vertical_rate > 0.5 ? "↑" : ac.vertical_rate < -0.5 ? "↓" : "→";
      const vsColor = ac.vertical_rate > 0.5 ? "#22c55e" : ac.vertical_rate < -0.5 ? "#ef4444" : "#888";

      bindHoverPopup(marker, `<div style="${popupStyle}">
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
          <span style="color:${color};font-weight:700;font-size:13px;">
            ${isMil ? "🛩️" : "✈️"} ${ac.callsign || "N/A"}
          </span>
          <span style="font-size:9px;padding:1px 5px;border-radius:3px;background:${isMil ? "rgba(239,68,68,0.2)" : "rgba(59,130,246,0.2)"};color:${color};">
            ${isMil ? "MIL" : "CIV"}
          </span>
        </div>
        ${ac.type || ac.registration ? `<div style="display:flex;gap:8px;margin-bottom:5px;font-size:9px;color:#aaa;">
          ${ac.type ? `<span>✈ ${ac.type}</span>` : ""}
          ${ac.registration ? `<span>📋 ${ac.registration}</span>` : ""}
        </div>` : ""}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;font-size:10px;">
          <div>🌍 ${ac.origin_country}</div>
          <div>📐 HDG ${Math.round(ac.heading)}°</div>
          <div>📏 ${altFt.toLocaleString()} ft (${Math.round(ac.altitude)}m)</div>
          <div>💨 ${speedKts} kts (${speedKmhDisplay} km/h)</div>
          <div style="color:${vsColor};">${vsArrow} V/S ${ac.vertical_rate > 0 ? "+" : ""}${ac.vertical_rate.toFixed(1)} m/s</div>
          <div style="opacity:0.5;">ICAO: ${ac.icao24}</div>
        </div>
        <div style="margin-top:6px;font-size:9px;color:${isTracked ? "#22c55e" : "#666"};">
          ${isTracked ? "📡 TRACKING ACTIVE — click to stop" : "🖱️ Click to track this aircraft"}
        </div>
      </div>`);

      group.addLayer(marker);
    });
  }, [interpolatedFlights, layers.flights, trackedFlightId]);


  // ===== WEATHER OVERLAY LAYERS (precipitation + wind + cloud + city markers) =====
  const weatherWindRef = useRef<L.TileLayer | null>(null);
  const weatherCloudRef = useRef<L.TileLayer | null>(null);
  const weatherMarkersRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clean up
    if (weatherTileRef.current) { map.removeLayer(weatherTileRef.current); weatherTileRef.current = null; }
    if (weatherWindRef.current) { map.removeLayer(weatherWindRef.current); weatherWindRef.current = null; }
    if (weatherCloudRef.current) { map.removeLayer(weatherCloudRef.current); weatherCloudRef.current = null; }
    if (weatherMarkersRef.current) { map.removeLayer(weatherMarkersRef.current); weatherMarkersRef.current = null; }

    if (layers.weather) {
      const OWM_KEY = "b1b15e88fa797225412429c1c50c122a1";
      // Precipitation
      weatherTileRef.current = L.tileLayer(
        `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
        { attribution: "&copy; OpenWeatherMap", opacity: 0.45, maxZoom: 18 }
      ).addTo(map);
      // Wind speed
      weatherWindRef.current = L.tileLayer(
        `https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
        { opacity: 0.3, maxZoom: 18 }
      ).addTo(map);
      // Cloud cover
      weatherCloudRef.current = L.tileLayer(
        `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${OWM_KEY}`,
        { opacity: 0.25, maxZoom: 18 }
      ).addTo(map);

      // Weather city markers + wind arrows for focus region
      const weatherGroup = L.layerGroup().addTo(map);
      weatherMarkersRef.current = weatherGroup;

      // Fetch live weather from edge function
      supabase.functions.invoke("weather-data").then(({ data }) => {
        if (!data?.weather) return;
        data.weather.forEach((w: any) => {
          if (!w.lat || !w.lng) return;
          const tempColor = w.temp >= 40 ? "#ef4444" : w.temp >= 30 ? "#f97316" : w.temp >= 20 ? "#eab308" : "#22d3ee";
          const condEmoji: Record<string, string> = { Clear: "☀️", Clouds: "☁️", Rain: "🌧️", Thunderstorm: "⛈️", Dust: "🌪️", Haze: "🌫️", Mist: "🌫️", Snow: "❄️", Drizzle: "🌦️" };

          // City weather marker
          const icon = L.divIcon({
            className: "weather-city-marker",
            html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer;">
              <div style="background:rgba(0,0,0,0.85);border:1px solid ${tempColor}40;border-radius:6px;padding:2px 5px;display:flex;align-items:center;gap:3px;backdrop-filter:blur(4px);">
                <span style="font-size:10px;">${condEmoji[w.condition] || "🌤️"}</span>
                <span style="font-size:10px;font-weight:700;color:${tempColor};font-family:monospace;">${w.temp}°</span>
              </div>
              <span style="font-size:7px;color:rgba(255,255,255,0.5);font-family:monospace;margin-top:1px;">${w.city}</span>
            </div>`,
            iconSize: [50, 30],
            iconAnchor: [25, 15],
          });
          const marker = L.marker([w.lat, w.lng], { icon, zIndexOffset: 300 });
          const windArrows = ["↓", "↙", "←", "↖", "↑", "↗", "→", "↘"];
          const windDir = windArrows[Math.round(w.wind_deg / 45) % 8];
          bindHoverPopup(marker, `<div style="${popupStyle}">
            <div style="font-weight:700;font-size:13px;color:${tempColor};margin-bottom:4px;">${condEmoji[w.condition] || "🌤️"} ${w.city} — ${w.temp}°C</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;font-size:10px;">
              <div>🌡️ Feels: ${w.feels_like}°C</div>
              <div>💨 Wind: ${w.wind_speed}km/h ${windDir}</div>
              <div>💧 Humidity: ${w.humidity}%</div>
              <div>👁️ Vis: ${w.visibility}km</div>
              <div>☁️ Clouds: ${w.clouds}%</div>
              <div>📊 Pressure: ${w.pressure}hPa</div>
            </div>
            <div style="font-size:9px;color:#888;margin-top:4px;text-transform:capitalize;">${w.description}</div>
          </div>`);
          weatherGroup.addLayer(marker);

          // Wind direction arrow marker (offset slightly from city)
          if (w.wind_speed > 0) {
            const arrowLen = Math.min(w.wind_speed, 60);
            const windRad = ((w.wind_deg + 180) % 360) * Math.PI / 180; // wind blows FROM this direction
            const arrowColor = w.wind_speed >= 40 ? "#ef4444" : w.wind_speed >= 25 ? "#f97316" : w.wind_speed >= 15 ? "#eab308" : "#22d3ee";
            const arrowSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" style="overflow:visible;">
              <defs>
                <filter id="wg-${w.code}"><feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="${arrowColor}" flood-opacity="0.6"/></filter>
              </defs>
              <g transform="rotate(${w.wind_deg}, 24, 24)" filter="url(#wg-${w.code})">
                <line x1="24" y1="38" x2="24" y2="10" stroke="${arrowColor}" stroke-width="2.5" stroke-linecap="round">
                  <animate attributeName="y2" values="10;8;10" dur="1.5s" repeatCount="indefinite"/>
                </line>
                <polygon points="24,6 18,16 30,16" fill="${arrowColor}">
                  <animate attributeName="points" values="24,6 18,16 30,16;24,4 18,14 30,14;24,6 18,16 30,16" dur="1.5s" repeatCount="indefinite"/>
                </polygon>
                <text x="24" y="46" text-anchor="middle" fill="${arrowColor}" font-size="8" font-family="monospace" font-weight="bold">${w.wind_speed}</text>
              </g>
            </svg>`;
            const windIcon = L.divIcon({
              className: "wind-arrow-marker",
              html: arrowSvg,
              iconSize: [48, 48],
              iconAnchor: [24, 24],
            });
            // Offset arrow slightly east of city
            const arrowMarker = L.marker([w.lat - 0.3, w.lng + 0.6], { icon: windIcon, zIndexOffset: 250 });
            bindHoverPopup(arrowMarker, `<div style="${popupStyle}">
              <div style="color:${arrowColor};font-weight:700;">💨 ${w.city} Wind</div>
              <div style="margin-top:4px;">Speed: ${w.wind_speed} km/h</div>
              <div>Direction: ${w.wind_deg}° (${windDir})</div>
            </div>`);
            weatherGroup.addLayer(arrowMarker);
          }
        });
      });
    }

    return () => {
      if (weatherWindRef.current && map) { map.removeLayer(weatherWindRef.current); weatherWindRef.current = null; }
      if (weatherCloudRef.current && map) { map.removeLayer(weatherCloudRef.current); weatherCloudRef.current = null; }
      if (weatherMarkersRef.current && map) { map.removeLayer(weatherMarkersRef.current); weatherMarkersRef.current = null; }
    };
  }, [layers.weather]);

  // ===== TRAFFIC LAYER =====
  const trafficTileRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (trafficTileRef.current) {
      map.removeLayer(trafficTileRef.current);
      trafficTileRef.current = null;
    }

    if (layers.traffic) {
      // Use TomTom free traffic flow tile layer
      trafficTileRef.current = L.tileLayer(
        "https://{s}.api.tomtom.com/traffic/map/4/tile/flow/relative0/{z}/{x}/{y}.png?key=AKTGbMYDBPMq7GNhHErzBQa7LPHarR2w&tileSize=256",
        {
          subdomains: ["a", "b", "c", "d"],
          attribution: "&copy; TomTom",
          opacity: 0.7,
          maxZoom: 18,
        }
      ).addTo(map);
    }

    return () => {
      if (trafficTileRef.current && map) {
        map.removeLayer(trafficTileRef.current);
        trafficTileRef.current = null;
      }
    };
  }, [layers.traffic]);

  // Safety-level country borders
  useEffect(() => {
    const group = bordersGroupRef.current;
    if (!group || !safetyData?.length) { group?.clearLayers(); return; }
    group.clearLayers();

    const codes = safetyData.map(c => c.code);
    const geoJSON = getCountryGeoJSON(codes);
    const safetyMap = Object.fromEntries(safetyData.map(c => [c.code, c]));

    L.geoJSON(geoJSON, {
      style: (feature) => {
        const code = feature?.properties?.code;
        const country = safetyMap[code];
        const color = country ? SAFETY_LEVEL_MAP_COLORS[country.level] || "#888" : "#888";
        return { color, weight: 2, opacity: 0.7, fillColor: color, fillOpacity: 0.1, dashArray: "4 4" };
      },
      onEachFeature: (feature, layer) => {
        const code = feature?.properties?.code;
        const country = safetyMap[code];
        if (country) {
          layer.bindPopup(`
            <div style="${popupStyle}min-width:180px;">
              <div style="color:${SAFETY_LEVEL_MAP_COLORS[country.level]};font-weight:700;margin-bottom:4px;">
                ${country.name} — ${country.level}
              </div>
              <div>Safety Score: <b>${country.safety_score}/100</b></div>
              <div style="margin-top:4px;font-size:9px;opacity:0.7;">${country.status}</div>
              ${country.threats?.length ? `<div style="margin-top:4px;font-size:9px;opacity:0.6;">Threats: ${country.threats.join(", ")}</div>` : ""}
            </div>
          `, popupOptions);
        }
      },
    }).addTo(group);
  }, [safetyData]);

  // Render UP42 footprints on map
  useEffect(() => {
    const group = up42GroupRef.current;
    if (!group) return;
    group.clearLayers();

    up42Features.forEach((feature) => {
      if (!feature.geometry) return;
      try {
        const geoJson = L.geoJSON(feature.geometry as any, {
          style: {
            color: "#00d4ff",
            fillColor: "#00d4ff",
            fillOpacity: 0.08,
            weight: 2,
            dashArray: "4 2",
          },
        });
        const props = feature.properties || {};
        geoJson.bindPopup(`
          <div style="${popupStyle}">
            <div style="color:#00d4ff;font-weight:700;margin-bottom:4px;">🛰 ${props.constellation || props.collection || "Satellite"}</div>
            <div>Date: ${props.datetime?.split("T")[0] || "N/A"}</div>
            ${props["eo:cloud_cover"] != null ? `<div>Cloud: ${Math.round(props["eo:cloud_cover"])}%</div>` : ""}
            ${props["up42-system:asset_id"] ? `<div style="font-size:8px;opacity:0.5;margin-top:4px;">ID: ${props["up42-system:asset_id"]}</div>` : ""}
          </div>
        `, popupOptions);
        geoJson.addTo(group);
      } catch {}
    });
  }, [up42Features]);

  const handleUP42FeaturesChange = useCallback((features: UP42Feature[]) => {
    setUp42Features(features);
  }, []);

  // Global CCTV layer
  const ARAB_COUNTRIES = ["UAE", "United Arab Emirates", "Jordan", "Saudi Arabia", "Qatar", "Oman", "Bahrain", "Kuwait", "Iraq", "Lebanon", "Egypt", "Syria", "Yemen", "Libya", "Tunisia", "Algeria", "Morocco", "Sudan", "Palestine", "Iran"];

  const toggleArabCCTV = useCallback(async () => {
    if (showArabCCTV) {
      setShowArabCCTV(false);
      cctvGroupRef.current?.clearLayers();
      setArabCameras([]);
      return;
    }
    setLoadingCCTV(true);
    setShowArabCCTV(true);
    try {
      // Fetch only online cameras within the Arab World bounding box
      const { data, error } = await supabase.functions.invoke("cameras", {
        method: "POST",
        body: {
          action: "list",
          status: "online",
          limit: 1000,
          bounds: { north: 42, south: 10, east: 65, west: -18 },
        },
      });
      if (!error && data?.cameras) {
        // Filter to only Arab/Middle East countries
        const filtered = data.cameras.filter((c: any) => ARAB_COUNTRIES.includes(c.country));
        setArabCameras(filtered);
      }
    } catch (e) { console.error("CCTV fetch failed:", e); }
    finally { setLoadingCCTV(false); }
  }, [showArabCCTV]);

  // Render CCTV markers
  useEffect(() => {
    const group = cctvGroupRef.current;
    if (!group) return;
    group.clearLayers();
    if (!showArabCCTV || arabCameras.length === 0) return;

    // Fly to Arab World region
    if (mapRef.current && arabCameras.length > 0) {
      mapRef.current.flyTo([28, 45], 4, { duration: 1.2 });
    }

    arabCameras.forEach((cam: any) => {
      if (!cam.lat || !cam.lng) return;
      const isOnline = cam.status === "active";
      const color = isOnline ? "#22c55e" : "#ef4444";
      const icon = L.divIcon({
        className: "cctv-map-marker",
        html: `<div style="position:relative;display:flex;align-items:center;justify-content:center;cursor:pointer;">
          <div style="position:absolute;width:22px;height:22px;border-radius:50%;border:2px solid ${color};box-shadow:0 0 8px ${color}80;${isOnline ? 'animation:pulse 2.5s ease-in-out infinite;' : ''}"></div>
          <div style="position:absolute;width:14px;height:14px;border-radius:50%;background:${color}20;"></div>
          <div style="font-size:13px;filter:drop-shadow(0 0 4px ${color});">📹</div>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -14],
      });

      const statusDot = isOnline
        ? `<span style="color:#22c55e;">● ONLINE</span>`
        : `<span style="color:#ef4444;">● OFFLINE</span>`;

      const marker = L.marker([cam.lat, cam.lng], { icon });
      bindHoverPopup(marker, `
        <div style="${popupStyle}min-width:220px;">
          <div style="color:#06b6d4;font-weight:700;font-size:12px;margin-bottom:4px;">📹 ${cam.name}</div>
          <div style="margin-bottom:2px;">${cam.city}, ${cam.country}</div>
          <div style="margin-bottom:4px;">${statusDot}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px;">
            <span style="background:rgba(6,182,212,0.15);padding:1px 6px;border-radius:3px;font-size:9px;color:#06b6d4;text-transform:uppercase;">${cam.category}</span>
            ${cam.source_name ? `<span style="background:rgba(168,85,247,0.15);padding:1px 6px;border-radius:3px;font-size:9px;color:#a855f7;">${cam.source_name}</span>` : ""}
          </div>
          ${cam.embed_url ? `<a href="${cam.embed_url.replace(/autoplay=1/, 'autoplay=0')}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;background:rgba(6,182,212,0.15);border:1px solid rgba(6,182,212,0.3);color:#06b6d4;padding:4px 10px;border-radius:4px;font-size:10px;font-weight:700;text-decoration:none;margin-top:4px;">▶ VIEW LIVE FEED</a>` : ""}
        </div>
      `);
      group.addLayer(marker);
    });
  }, [showArabCCTV, arabCameras]);

  const totalAlerts = geoAlerts.length + airspaceAlerts.filter(a => a.active).length;

  const activeBase = imageryLayers.find(l => l.type === "base" && l.enabled);
  const [showSatGlobe, setShowSatGlobe] = useState(false);
  const [showUrbanScene, setShowUrbanScene] = useState(false);
  const [showLiveCameras, setShowLiveCameras] = useState(false);
  const [showResponseMap, setShowResponseMap] = useState(false);
  const [urbanScene3DTarget, setUrbanScene3DTarget] = useState<{ lat: number; lng: number; label: string; severity?: string; source?: string; type?: string; summary?: string } | null>(null);

  return (
    <div className={`relative h-full w-full ${activeBase?.id === "esri-imagery" ? "satellite-mode" : ""}`}>
      <HolographicOverlay alertCount={totalAlerts} />
      <ImageryLayerPanel
        layers={imageryLayers}
        onToggle={handleOverlayToggle}
        onOpacityChange={handleOpacityChange}
        onBaseChange={handleBaseChange}
      />
      <MapToolbar
        activeMode={activeMode}
        onModeChange={setActiveMode}
        pendingItem={pendingItem}
        onConfirmItem={handleConfirmItem}
        onCancelItem={handleCancelItem}
      />
      <TotalLaunchesWidget rockets={rockets} />
      <UP42Panel onFeaturesChange={handleUP42FeaturesChange} mapBounds={mapBounds} />
      <ChokepointMonitor
        vessels={vessels}
        onFlyTo={(lat, lng) => mapRef.current?.flyTo([lat, lng], 8, { duration: 1.5 })}
      />

      {/* 3D Mode buttons */}
      <div className="absolute top-14 right-3 z-[1000] flex flex-col gap-1.5">
        <button
            onClick={() => setShowSatGlobe(true)}
            className="flex items-center gap-1.5 bg-card/90 backdrop-blur border border-border rounded-md px-2 py-1 shadow-lg hover:bg-primary/10 hover:border-primary/50 transition-all group cursor-pointer"
            title="Open Orbital Intelligence Globe"
          >
            <Satellite className="h-3.5 w-3.5 text-primary group-hover:animate-pulse" />
            <span className="text-[9px] font-mono text-muted-foreground uppercase">ORBITAL INTEL</span>
          </button>
        <button
          onClick={() => setShowUrbanScene(true)}
          className="flex items-center gap-1.5 bg-card/90 backdrop-blur border border-border rounded-md px-2 py-1 shadow-lg hover:bg-primary/10 hover:border-primary/50 transition-all group cursor-pointer"
          title="Open Google 3D View"
        >
          <Building2 className="h-3.5 w-3.5 text-primary group-hover:animate-pulse" />
          <span className="text-[9px] font-mono text-muted-foreground uppercase">URBAN 3D</span>
        </button>
        <button
          onClick={() => setShowLiveCameras(true)}
          className="flex items-center gap-1.5 bg-card/90 backdrop-blur border border-border rounded-md px-2 py-1 shadow-lg hover:bg-primary/10 hover:border-primary/50 transition-all group cursor-pointer"
          title="Open Live Cameras"
        >
          <Camera className="h-3.5 w-3.5 text-primary group-hover:animate-pulse" />
          <span className="text-[9px] font-mono text-muted-foreground uppercase">CCTV</span>
        </button>
        <button
          onClick={toggleArabCCTV}
          disabled={loadingCCTV}
          className={`flex items-center gap-1.5 backdrop-blur border rounded-md px-2 py-1 shadow-lg transition-all group cursor-pointer ${
            showArabCCTV
              ? "bg-primary/20 border-primary/50 shadow-[0_0_12px_hsl(190_100%_50%/0.2)]"
              : "bg-card/90 border-border hover:bg-primary/10 hover:border-primary/50"
          }`}
          title="Show Arab World CCTV Cameras"
        >
          <Camera className={`h-3.5 w-3.5 ${showArabCCTV ? "text-primary animate-pulse" : "text-muted-foreground group-hover:text-primary"}`} />
          <span className={`text-[9px] font-mono uppercase ${showArabCCTV ? "text-primary" : "text-muted-foreground"}`}>
            {loadingCCTV ? "LOADING..." : showArabCCTV ? `ARAB CCTV (${arabCameras.length})` : "ARAB CCTV"}
          </span>
        </button>
        <button
          onClick={() => setShowResponseMap(true)}
          className="flex items-center gap-1.5 bg-card/90 backdrop-blur border border-border rounded-md px-2 py-1 shadow-lg hover:bg-primary/10 hover:border-primary/50 transition-all group cursor-pointer"
          title="Crisis Awareness — Response Map"
        >
          <ShieldAlert className="h-3.5 w-3.5 text-emerald-400 group-hover:animate-pulse" />
          <span className="text-[9px] font-mono text-muted-foreground uppercase">RESPONSE MAP</span>
        </button>
      </div>


      {/* 3D overlays */}
      {showSatGlobe && <SatelliteGlobe onClose={() => setShowSatGlobe(false)} />}
      {showUrbanScene && (
        <UrbanScene3D
          onClose={() => { setShowUrbanScene(false); setUrbanScene3DTarget(null); }}
          initialCoords={urbanScene3DTarget ? { lat: urbanScene3DTarget.lat, lng: urbanScene3DTarget.lng } : undefined}
          initialEvent={urbanScene3DTarget ? {
            title: urbanScene3DTarget.label,
            lat: urbanScene3DTarget.lat,
            lng: urbanScene3DTarget.lng,
            severity: urbanScene3DTarget.severity,
            source: urbanScene3DTarget.source,
            type: urbanScene3DTarget.type,
            summary: urbanScene3DTarget.summary,
          } : undefined}
        />
      )}
      {showLiveCameras && (
        <LiveCamerasModal
          onClose={() => setShowLiveCameras(false)}
          onShowOnMap={(lat, lng, name) => {
            setShowLiveCameras(false);
            if (mapRef.current) {
              mapRef.current.flyTo([lat, lng], 14, { duration: 1.5 });
              L.marker([lat, lng], {
                icon: L.divIcon({
                  className: "",
                  html: `<div style="background:hsl(190,100%,50%);border:2px solid white;border-radius:50%;width:14px;height:14px;box-shadow:0 0 10px hsl(190,100%,50%)"></div>`,
                  iconSize: [14, 14],
                  iconAnchor: [7, 7],
                }),
              }).addTo(mapRef.current).bindPopup(`<b style="font-family:monospace;font-size:11px">📹 ${name}</b>`).openPopup();
            }
          }}
        />
      )}

      {showResponseMap && (
        <ResponseMapModal
          onClose={() => setShowResponseMap(false)}
          onFlyTo={(lat, lng, zoom) => {
            setShowResponseMap(false);
            mapRef.current?.flyTo([lat, lng], zoom || 8, { duration: 1.5 });
          }}
          earthquakes={earthquakes}
          wildfires={wildfires}
          conflicts={conflictEvents}
          nuclearStations={nuclearMonitors.stations}
          nuclearFacilities={nuclearMonitors.facilities}
          airQuality={airQuality}
          aisVessels={aisVessels}
          newsMarkers={newsMarkers}
          telegramMarkers={telegramMarkers}
          airspaceAlerts={airspaceAlerts}
          vessels={vessels}
          geoAlerts={geoAlerts}
          rockets={rockets}
          flightCount={flightData.length}
          layers={layers}
          onToggleLayer={(layer) => onToggleLayer?.(layer)}
        />
      )}

      <MapLegend />
      <div ref={mapContainerRef} className="h-full w-full rounded-lg" aria-label="Intelligence map" />
    </div>
  );
};
