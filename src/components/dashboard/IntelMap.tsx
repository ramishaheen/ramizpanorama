import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AirspaceAlert, MaritimeVessel, GeoAlert, Rocket } from "@/data/mockData";
import type { LayerState } from "./LayerControls";
import { MapStyleToggle, type MapStyle } from "./MapStyleToggle";
import type { CountrySafety } from "@/hooks/useCitizenSecurity";
import { getCountryGeoJSON, SAFETY_LEVEL_MAP_COLORS } from "@/data/countryBorders";

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

const defaultIcon = L.icon({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

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

const TILE_LAYERS: Record<MapStyle, { url: string; attribution: string }> = {
  dark: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OSM",
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri",
  },
};

// Shared popup options — always open above marker
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
  const bordersGroupRef = useRef<L.LayerGroup | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [mapStyle, setMapStyle] = useState<MapStyle>("dark");

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [28, 48],
      zoom: 5,
      zoomControl: true,
      attributionControl: true,
    });

    const tile = TILE_LAYERS.dark;
    tileLayerRef.current = L.tileLayer(tile.url, {
      attribution: tile.attribution,
    }).addTo(map);

    bordersGroupRef.current = L.layerGroup().addTo(map);
    overlayGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      overlayGroupRef.current?.clearLayers();
      bordersGroupRef.current?.clearLayers();
      map.remove();
      mapRef.current = null;
      overlayGroupRef.current = null;
      bordersGroupRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  // Handle tile layer changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const tile = TILE_LAYERS[mapStyle];
    tileLayerRef.current = L.tileLayer(tile.url, {
      attribution: tile.attribution,
    }).addTo(map);

    // Move tile layer behind overlays
    tileLayerRef.current.bringToBack();
  }, [mapStyle]);

  useEffect(() => {
    const group = overlayGroupRef.current;
    if (!group) return;

    group.clearLayers();

    if (layers.airspace) {
      airspaceAlerts
        .filter((alert) => alert.active)
        .forEach((alert) => {
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

    // Rockets layer
    if (layers.rockets) {
      rockets.forEach((rocket) => {
        const isActive = rocket.status === "launched" || rocket.status === "in_flight";
        const color = rocketStatusColors[rocket.status] || "#ef4444";

        // Draw trajectory line from origin to target
        const trajectory = L.polyline(
          [[rocket.originLat, rocket.originLng], [rocket.targetLat, rocket.targetLng]],
          {
            color: color,
            weight: 1.5,
            opacity: 0.4,
            dashArray: "6 4",
          }
        );
        trajectory.addTo(group);

        // Draw traveled path (origin to current)
        if (isActive) {
          const traveledPath = L.polyline(
            [[rocket.originLat, rocket.originLng], [rocket.currentLat, rocket.currentLng]],
            {
              color: color,
              weight: 2.5,
              opacity: 0.8,
            }
          );
          traveledPath.addTo(group);
        }

        // Origin marker (small circle)
        L.circleMarker([rocket.originLat, rocket.originLng], {
          radius: 4,
          color: color,
          fillColor: color,
          fillOpacity: 0.5,
          weight: 1,
        }).addTo(group);

        // Target marker (crosshair)
        L.circleMarker([rocket.targetLat, rocket.targetLng], {
          radius: 6,
          color: color,
          fillColor: "transparent",
          fillOpacity: 0,
          weight: 2,
          dashArray: "3 3",
        }).addTo(group);

        // Rocket current position marker
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
          radius: 300000,
          color: "transparent",
          fillColor: severityColors[item.severity],
          fillOpacity: 0.08,
          weight: 0,
        }).addTo(group);
      });
    }
  }, [airspaceAlerts, vessels, geoAlerts, rockets, layers]);

  // Safety-level country borders
  useEffect(() => {
    const group = bordersGroupRef.current;
    if (!group || !safetyData?.length) {
      group?.clearLayers();
      return;
    }

    group.clearLayers();

    const codes = safetyData.map(c => c.code);
    const geoJSON = getCountryGeoJSON(codes);
    const safetyMap = Object.fromEntries(safetyData.map(c => [c.code, c]));

    L.geoJSON(geoJSON, {
      style: (feature) => {
        const code = feature?.properties?.code;
        const country = safetyMap[code];
        const color = country ? SAFETY_LEVEL_MAP_COLORS[country.level] || "#888" : "#888";
        return {
          color,
          weight: 2,
          opacity: 0.7,
          fillColor: color,
          fillOpacity: 0.1,
          dashArray: "4 4",
        };
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

  return (
    <div className={`relative h-full w-full ${mapStyle === "satellite" ? "satellite-mode" : ""}`}>
      <MapStyleToggle style={mapStyle} onChange={setMapStyle} />
      <div ref={mapContainerRef} className="h-full w-full rounded-lg" aria-label="Intelligence map" />
    </div>
  );
};
