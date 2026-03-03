import { MapContainer, TileLayer, CircleMarker, Circle, Popup, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AirspaceAlert, MaritimeVessel, GeoAlert } from "@/data/mockData";
import type { LayerState } from "./LayerControls";

// Fix default marker icon without using delete operator
const defaultIcon = L.icon({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

interface IntelMapProps {
  airspaceAlerts: AirspaceAlert[];
  vessels: MaritimeVessel[];
  geoAlerts: GeoAlert[];
  layers: LayerState;
}

const severityColors = {
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
  });
};

export const IntelMap = ({ airspaceAlerts, vessels, geoAlerts, layers }: IntelMapProps) => {
  return (
    <MapContainer
      center={[25, 50]}
      zoom={3}
      className="h-full w-full rounded-lg"
      zoomControl={true}
      attributionControl={true}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; OSM'
      />

      {/* Airspace layer */}
      {layers.airspace && airspaceAlerts.filter(a => a.active).map(alert => (
        <Circle
          key={alert.id}
          center={[alert.lat, alert.lng]}
          radius={alert.radius * 1000}
          pathOptions={{
            color: severityColors[alert.severity],
            fillColor: severityColors[alert.severity],
            fillOpacity: 0.12,
            weight: 1.5,
            dashArray: alert.type === 'CLOSURE' ? undefined : '5 5',
          }}
        >
          <Popup>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#ccc", background: "#1a1d27", padding: 8, borderRadius: 4, minWidth: 200 }}>
              <div style={{ color: severityColors[alert.severity], fontWeight: 700, marginBottom: 4 }}>
                {alert.type} — {alert.region}
              </div>
              <div style={{ marginBottom: 4 }}>{alert.description}</div>
              <div style={{ fontSize: 9, opacity: 0.6 }}>
                {new Date(alert.timestamp).toLocaleString()}
              </div>
            </div>
          </Popup>
        </Circle>
      ))}

      {/* Maritime layer */}
      {layers.maritime && vessels.map(vessel => (
        <Marker
          key={vessel.id}
          position={[vessel.lat, vessel.lng]}
          icon={createVesselIcon(vessel.type, vessel.heading)}
        >
          <Popup>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#ccc", background: "#1a1d27", padding: 8, borderRadius: 4, minWidth: 180 }}>
              <div style={{ color: vesselColors[vessel.type], fontWeight: 700, marginBottom: 4 }}>
                {vessel.name}
              </div>
              <div>Flag: {vessel.flag} | Type: {vessel.type}</div>
              <div>Speed: {vessel.speed}kts | HDG: {vessel.heading}°</div>
              {vessel.destination && <div>Dest: {vessel.destination}</div>}
              <div style={{ fontSize: 9, opacity: 0.6, marginTop: 4 }}>
                {new Date(vessel.timestamp).toLocaleString()}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Alert markers */}
      {layers.alerts && geoAlerts.map(alert => (
        <CircleMarker
          key={alert.id}
          center={[alert.lat, alert.lng]}
          radius={8}
          pathOptions={{
            color: severityColors[alert.severity],
            fillColor: severityColors[alert.severity],
            fillOpacity: 0.7,
            weight: 2,
          }}
        >
          <Popup>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#ccc", background: "#1a1d27", padding: 8, borderRadius: 4, minWidth: 200 }}>
              <div style={{ color: severityColors[alert.severity], fontWeight: 700, marginBottom: 4 }}>
                [{alert.type}] {alert.title}
              </div>
              <div style={{ marginBottom: 4 }}>{alert.summary}</div>
              <div style={{ fontSize: 9, opacity: 0.6 }}>
                {alert.source} — {new Date(alert.timestamp).toLocaleString()}
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Heatmap: simple circles */}
      {layers.heatmap && [...airspaceAlerts, ...geoAlerts].map((item, i) => (
        <Circle
          key={`heat-${i}`}
          center={[item.lat, item.lng]}
          radius={300000}
          pathOptions={{
            color: "transparent",
            fillColor: severityColors[item.severity],
            fillOpacity: 0.08,
            weight: 0,
          }}
        />
      ))}
    </MapContainer>
  );
};
