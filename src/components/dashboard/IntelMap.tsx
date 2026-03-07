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
  const tileLayersRef = useRef<Map<string, L.TileLayer>>(new Map());
  const [imageryLayers, setImageryLayers] = useState<ImageryLayer[]>(DEFAULT_IMAGERY_LAYERS);

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
    userItemsGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      overlayGroupRef.current?.clearLayers();
      bordersGroupRef.current?.clearLayers();
      userItemsGroupRef.current?.clearLayers();
      tileLayersRef.current.clear();
      map.remove();
      mapRef.current = null;
      overlayGroupRef.current = null;
      bordersGroupRef.current = null;
      userItemsGroupRef.current = null;
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
