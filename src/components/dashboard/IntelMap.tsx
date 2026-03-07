import { useEffect, useRef, useState, useCallback } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AirspaceAlert, MaritimeVessel, GeoAlert, Rocket } from "@/data/mockData";
import type { LayerState } from "./LayerControls";
import type { CountrySafety } from "@/hooks/useCitizenSecurity";
import { getCountryGeoJSON, SAFETY_LEVEL_MAP_COLORS } from "@/data/countryBorders";
import { MapToolbar, type MapToolMode, type UserMapItem } from "./MapToolbar";
import { HolographicOverlay } from "./HolographicOverlay";
import { TotalLaunchesWidget } from "./TotalLaunchesWidget";
import { ImageryLayerPanel, DEFAULT_IMAGERY_LAYERS, type ImageryLayer } from "./ImageryLayerPanel";
import { Satellite } from "lucide-react";
import { useEarthquakes, type Earthquake } from "@/hooks/useEarthquakes";
import { useWildfires, type Wildfire } from "@/hooks/useWildfires";
import { useConflictEvents, type ConflictEvent } from "@/hooks/useConflictEvents";

interface IntelMapProps {
  airspaceAlerts: AirspaceAlert[];
  vessels: MaritimeVessel[];
  geoAlerts: GeoAlert[];
  rockets: Rocket[];
  layers: LayerState;
  safetyData?: CountrySafety[];
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

export const IntelMap = ({ airspaceAlerts, vessels, geoAlerts, rockets, layers, safetyData }: IntelMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const userItemsGroupRef = useRef<L.LayerGroup | null>(null);
  const bordersGroupRef = useRef<L.LayerGroup | null>(null);
  const earthquakeGroupRef = useRef<L.LayerGroup | null>(null);
  const wildfireGroupRef = useRef<L.LayerGroup | null>(null);
  const conflictGroupRef = useRef<L.LayerGroup | null>(null);
  const weatherTileRef = useRef<L.TileLayer | null>(null);
  const tileLayersRef = useRef<Map<string, L.TileLayer>>(new Map());
  const [imageryLayers, setImageryLayers] = useState<ImageryLayer[]>(DEFAULT_IMAGERY_LAYERS);

  // OSINT data hooks
  const earthquakes = useEarthquakes();
  const wildfires = useWildfires();
  const conflictEvents = useConflictEvents();

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
    userItemsGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      overlayGroupRef.current?.clearLayers();
      bordersGroupRef.current?.clearLayers();
      earthquakeGroupRef.current?.clearLayers();
      wildfireGroupRef.current?.clearLayers();
      conflictGroupRef.current?.clearLayers();
      userItemsGroupRef.current?.clearLayers();
      if (weatherTileRef.current) map.removeLayer(weatherTileRef.current);
      tileLayersRef.current.clear();
      map.remove();
      mapRef.current = null;
      overlayGroupRef.current = null;
      bordersGroupRef.current = null;
      earthquakeGroupRef.current = null;
      wildfireGroupRef.current = null;
      conflictGroupRef.current = null;
      userItemsGroupRef.current = null;
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

  // Render earthquake layer
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

  // Weather radar tile layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (weatherTileRef.current) {
      map.removeLayer(weatherTileRef.current);
      weatherTileRef.current = null;
    }

    if (layers.weather) {
      // OpenWeatherMap free precipitation tile layer
      weatherTileRef.current = L.tileLayer(
        "https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=b1b15e88fa797225412429c1c50c122a1",
        { attribution: "&copy; OpenWeatherMap", opacity: 0.5, maxZoom: 18 }
      ).addTo(map);
    }
  }, [layers.weather]);

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

  const totalAlerts = geoAlerts.length + airspaceAlerts.filter(a => a.active).length;

  // Satellite count badge - fetch from edge function
  const [satCount, setSatCount] = useState(0);
  useEffect(() => {
    const fetchSats = async () => {
      try {
        const { data } = await import("@/integrations/supabase/client").then(m => m.supabase.functions.invoke("celestrak-satellites"));
        if (data?.satellites) setSatCount(data.satellites.length);
      } catch {}
    };
    fetchSats();
    const interval = setInterval(fetchSats, 120_000);
    return () => clearInterval(interval);
  }, []);

  const activeBase = imageryLayers.find(l => l.type === "base" && l.enabled);

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

      {/* Satellite count badge */}
      {satCount > 0 && (
        <div className="absolute top-14 right-3 z-[1000] flex items-center gap-1.5 bg-card/90 backdrop-blur border border-border rounded-md px-2 py-1 shadow-lg">
          <Satellite className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-mono font-bold text-primary">{satCount}</span>
          <span className="text-[9px] font-mono text-muted-foreground uppercase">SAT</span>
        </div>
      )}

      <div ref={mapContainerRef} className="h-full w-full rounded-lg" aria-label="Intelligence map" />
    </div>
  );
};
