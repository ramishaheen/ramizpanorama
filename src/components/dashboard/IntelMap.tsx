import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AirspaceAlert, MaritimeVessel, GeoAlert } from "@/data/mockData";
import type { LayerState } from "./LayerControls";

interface IntelMapProps {
  airspaceAlerts: AirspaceAlert[];
  vessels: MaritimeVessel[];
  geoAlerts: GeoAlert[];
  layers: LayerState;
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
  });
};

export const IntelMap = ({ airspaceAlerts, vessels, geoAlerts, layers }: IntelMapProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [25, 50],
      zoom: 3,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OSM",
    }).addTo(map);

    overlayGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      overlayGroupRef.current?.clearLayers();
      map.remove();
      mapRef.current = null;
      overlayGroupRef.current = null;
    };
  }, []);

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
            <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#ccc;background:#1a1d27;padding:8px;border-radius:4px;min-width:200px;">
              <div style="color:${severityColors[alert.severity]};font-weight:700;margin-bottom:4px;">${alert.type} — ${alert.region}</div>
              <div style="margin-bottom:4px;">${alert.description}</div>
              <div style="font-size:9px;opacity:0.6;">${new Date(alert.timestamp).toLocaleString()}</div>
            </div>
          `);

          circle.addTo(group);
        });
    }

    if (layers.maritime) {
      vessels.forEach((vessel) => {
        const marker = L.marker([vessel.lat, vessel.lng], {
          icon: createVesselIcon(vessel.type, vessel.heading),
        });

        marker.bindPopup(`
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#ccc;background:#1a1d27;padding:8px;border-radius:4px;min-width:180px;">
            <div style="color:${vesselColors[vessel.type]};font-weight:700;margin-bottom:4px;">${vessel.name}</div>
            <div>Flag: ${vessel.flag} | Type: ${vessel.type}</div>
            <div>Speed: ${vessel.speed}kts | HDG: ${vessel.heading}°</div>
            ${vessel.destination ? `<div>Dest: ${vessel.destination}</div>` : ""}
            <div style="font-size:9px;opacity:0.6;margin-top:4px;">${new Date(vessel.timestamp).toLocaleString()}</div>
          </div>
        `);

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
          <div style="font-family:'JetBrains Mono',monospace;font-size:11px;color:#ccc;background:#1a1d27;padding:8px;border-radius:4px;min-width:200px;">
            <div style="color:${severityColors[alert.severity]};font-weight:700;margin-bottom:4px;">[${alert.type}] ${alert.title}</div>
            <div style="margin-bottom:4px;">${alert.summary}</div>
            <div style="font-size:9px;opacity:0.6;">${alert.source} — ${new Date(alert.timestamp).toLocaleString()}</div>
          </div>
        `);

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
  }, [airspaceAlerts, vessels, geoAlerts, layers]);

  return <div ref={mapContainerRef} className="h-full w-full rounded-lg" aria-label="Intelligence map" />;
};
