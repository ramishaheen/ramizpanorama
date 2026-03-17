import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from "react-leaflet";
import L from "leaflet";
import type { CyberThreat } from "@/hooks/useCyberThreats";
import type { LayerConfig } from "@/components/dashboard/cyber/MapLayersPanel";
import { getThreatLayerColor } from "@/components/dashboard/cyber/MapLayersPanel";
import RamiFishModal from "@/components/dashboard/RamiFishModal";
import "leaflet/dist/leaflet.css";

/* ── Country coords (lat, lng for Leaflet) ── */
const COUNTRY_COORDS: Record<string, [number, number]> = {
  Iran: [32, 53], Israel: [31, 35], USA: [38, -98], "United States": [38, -98],
  Russia: [55, 60], China: [35, 104], "North Korea": [40, 127],
  "Saudi Arabia": [24, 45], UAE: [24, 54], Qatar: [25, 51],
  Turkey: [39, 35], Syria: [35, 38], Lebanon: [33.9, 35.8],
  Iraq: [33, 44], Yemen: [15, 48], Pakistan: [30, 69],
  India: [21, 78], Ukraine: [49, 32], Germany: [51, 10],
  UK: [54, -2], France: [47, 2], Multiple: [20, 10],
  Unknown: [10, 0], Japan: [36, 138], "South Korea": [36, 127],
  Egypt: [27, 30], Jordan: [31, 36], Bahrain: [26, 50.5],
  Kuwait: [29.3, 47.5], Oman: [21, 57], Libya: [27, 17],
  Tunisia: [34, 9], Algeria: [28, 3], Morocco: [32, -5],
  Sudan: [15, 30], Ethiopia: [9, 40], Kenya: [0, 38],
  Nigeria: [10, 8], "South Africa": [-30, 25], Brazil: [-14, -51],
  Canada: [56, -106], Mexico: [23, -102], Australia: [-25, 133],
};

function hashCountryCoords(name: string): [number, number] {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  const lng = ((h & 0xFFFF) / 0xFFFF) * 300 - 150;
  const lat = (((h >> 16) & 0xFFFF) / 0xFFFF) * 120 - 60;
  return [lat, lng];
}

function getCoords(name: string): [number, number] {
  return COUNTRY_COORDS[name] || hashCountryCoords(name);
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#e53e3e",
  high: "#ed8936",
  medium: "#ecc94b",
  low: "#38bdf8",
};

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴", high: "🟠", medium: "🟡", low: "🔵",
};

function arcPoints(from: [number, number], to: [number, number], segments = 30): [number, number][] {
  const pts: [number, number][] = [];
  const midLat = (from[0] + to[0]) / 2;
  const midLng = (from[1] + to[1]) / 2;
  const dist = Math.sqrt((to[0] - from[0]) ** 2 + (to[1] - from[1]) ** 2);
  const bulge = Math.max(dist * 0.3, 8);
  const cpLat = midLat + bulge;
  const cpLng = midLng;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    const lat = u * u * from[0] + 2 * u * t * cpLat + t * t * to[0];
    const lng = u * u * from[1] + 2 * u * t * cpLng + t * t * to[1];
    pts.push([lat, lng]);
  }
  return pts;
}

interface Props {
  threats: CyberThreat[];
  onSelect: (t: CyberThreat) => void;
  selectedId?: string;
}

/* ── Reticle markers layer ── */
function ReticleMarkers({ nodes, onHover, onLeave, hoveredNode }: {
  nodes: { country: string; count: number; severity: string; lat: number; lng: number }[];
  onHover: (c: string) => void;
  onLeave: () => void;
  hoveredNode: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    const markers: L.Marker[] = [];
    nodes.forEach(n => {
      const color = SEVERITY_COLORS[n.severity] || SEVERITY_COLORS.medium;
      const size = Math.min(12 + n.count * 2, 32);

      const icon = L.divIcon({
        className: "cyber-reticle-marker",
        html: `
          <div class="cyber-reticle-wrap" style="--reticle-color:${color};--reticle-size:${size}px">
            <div class="cyber-reticle-outer"></div>
            <div class="cyber-reticle-inner"></div>
            <div class="cyber-reticle-core"></div>
            <div class="cyber-reticle-pulse"></div>
            <div class="cyber-reticle-label">${n.country}</div>
            <div class="cyber-reticle-count">${n.count} INC</div>
          </div>
        `,
        iconSize: [size * 3, size * 3],
        iconAnchor: [size * 1.5, size * 1.5],
      });

      const marker = L.marker([n.lat, n.lng], { icon, interactive: true })
        .on("mouseover", () => onHover(n.country))
        .on("mouseout", () => onLeave())
        .addTo(map);
      markers.push(marker);
    });

    return () => { markers.forEach(m => map.removeLayer(m)); };
  }, [nodes, map, hoveredNode, onHover, onLeave]);

  return null;
}

/* ── Animated Attack Projectiles ── */
interface ProjectileState {
  progress: number;
  speed: number;
  delay: number;
  elapsed: number;
}

function AttackProjectiles({ arcs, onImpact }: {
  arcs: { id: string; points: [number, number][]; color: string; threat: CyberThreat }[];
  onImpact: (target: string, color: string, lat: number, lng: number) => void;
}) {
  const map = useMap();
  const markersRef = useRef<L.Marker[]>([]);
  const statesRef = useRef<ProjectileState[]>([]);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Clean up old markers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    statesRef.current = [];

    if (arcs.length === 0) return;

    // Create projectile markers
    arcs.forEach((arc, i) => {
      const isCritical = arc.threat.severity === "critical";
      const dotSize = isCritical ? 10 : 6;
      const icon = L.divIcon({
        className: "cyber-projectile-marker",
        html: `<div class="cyber-projectile-dot" style="--proj-color:${arc.color};width:${dotSize}px;height:${dotSize}px;background:${arc.color}"></div>`,
        iconSize: [dotSize, dotSize],
        iconAnchor: [dotSize / 2, dotSize / 2],
      });

      const marker = L.marker(arc.points[0], { icon, interactive: false, pane: "markerPane" }).addTo(map);
      markersRef.current.push(marker);

      const speed = isCritical ? 0.012 : arc.threat.severity === "high" ? 0.008 : 0.005;
      statesRef.current.push({
        progress: 0,
        speed,
        delay: i * 0.4 + Math.random() * 1.5, // staggered start
        elapsed: 0,
      });
    });

    let lastTime = performance.now();

    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      statesRef.current.forEach((state, i) => {
        if (i >= arcs.length || i >= markersRef.current.length) return;
        const arc = arcs[i];
        const marker = markersRef.current[i];

        if (state.delay > 0) {
          state.delay -= dt;
          // Hide while waiting
          marker.setLatLng(arc.points[0]);
          marker.setOpacity(0);
          return;
        }

        marker.setOpacity(1);
        state.progress += state.speed;

        if (state.progress >= 1) {
          // Impact!
          const target = arc.threat.targetCountry || arc.threat.target || "Unknown";
          const lastPt = arc.points[arc.points.length - 1];
          onImpact(target, arc.color, lastPt[0], lastPt[1]);
          // Reset with new delay
          state.progress = 0;
          state.delay = 1 + Math.random() * 3;
          marker.setOpacity(0);
          return;
        }

        // Interpolate position along arc
        const totalPts = arc.points.length;
        const exactIdx = state.progress * (totalPts - 1);
        const idx = Math.floor(exactIdx);
        const frac = exactIdx - idx;
        const nextIdx = Math.min(idx + 1, totalPts - 1);
        const lat = arc.points[idx][0] + (arc.points[nextIdx][0] - arc.points[idx][0]) * frac;
        const lng = arc.points[idx][1] + (arc.points[nextIdx][1] - arc.points[idx][1]) * frac;
        marker.setLatLng([lat, lng]);
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafRef.current);
      markersRef.current.forEach(m => map.removeLayer(m));
      markersRef.current = [];
      statesRef.current = [];
    };
  }, [arcs, map, onImpact]);

  return null;
}

/* ── Impact Ripple Layer ── */
function ImpactRipples({ impacts }: { impacts: { id: number; lat: number; lng: number; color: string }[] }) {
  const map = useMap();
  const markersRef = useRef<Map<number, L.Marker>>(new Map());

  useEffect(() => {
    impacts.forEach(imp => {
      if (markersRef.current.has(imp.id)) return;
      const icon = L.divIcon({
        className: "cyber-projectile-marker",
        html: `<div class="cyber-impact-ring" style="--impact-color:${imp.color};width:24px;height:24px"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });
      const marker = L.marker([imp.lat, imp.lng], { icon, interactive: false }).addTo(map);
      markersRef.current.set(imp.id, marker);
      // Remove after animation
      setTimeout(() => {
        map.removeLayer(marker);
        markersRef.current.delete(imp.id);
      }, 1100);
    });
  }, [impacts, map]);

  useEffect(() => {
    return () => {
      markersRef.current.forEach(m => map.removeLayer(m));
      markersRef.current.clear();
    };
  }, [map]);

  return null;
}

export default function CyberThreatMapLeaflet({ threats, onSelect, selectedId }: Props) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [showRamiFish, setShowRamiFish] = useState(false);
  const [impacts, setImpacts] = useState<{ id: number; lat: number; lng: number; color: string }[]>([]);
  const [tickerEntries, setTickerEntries] = useState<{ id: number; text: string; emoji: string }[]>([]);
  const impactIdRef = useRef(0);
  const mapRef = useRef<L.Map | null>(null);

  const nodes = useMemo(() => {
    const map = new Map<string, { country: string; count: number; severity: string; lat: number; lng: number }>();
    threats.forEach((t) => {
      for (const c of [t.attackerCountry || t.attacker, t.targetCountry || t.target]) {
        const key = c || "Unknown";
        const [lat, lng] = getCoords(key);
        const existing = map.get(key);
        if (existing) {
          existing.count++;
          if (t.severity === "critical" || (t.severity === "high" && existing.severity !== "critical")) existing.severity = t.severity;
        } else {
          map.set(key, { country: key, count: 1, severity: t.severity, lat, lng });
        }
      }
    });
    return Array.from(map.values());
  }, [threats]);

  const corridors = useMemo(() => {
    const pairMap = new Map<string, { count: number; maxSeverity: string; from: [number, number]; to: [number, number] }>();
    threats.forEach((t) => {
      const ac = t.attackerCountry || t.attacker || "Unknown";
      const tc = t.targetCountry || t.target || "Unknown";
      const key = `${ac}→${tc}`;
      const from = getCoords(ac);
      const to = getCoords(tc);
      const existing = pairMap.get(key);
      if (existing) {
        existing.count++;
        if (t.severity === "critical") existing.maxSeverity = "critical";
        else if (t.severity === "high" && existing.maxSeverity !== "critical") existing.maxSeverity = "high";
      } else {
        pairMap.set(key, { count: 1, maxSeverity: t.severity, from, to });
      }
    });
    const maxCount = Math.max(...Array.from(pairMap.values()).map(v => v.count), 1);
    return Array.from(pairMap.values()).map(v => ({
      ...v,
      intensity: v.count / maxCount,
      points: arcPoints(v.from, v.to),
    }));
  }, [threats]);

  const arcs = useMemo(() => {
    return threats.slice(0, 30).map((t) => {
      const ac = t.attackerCountry || t.attacker || "Unknown";
      const tc = t.targetCountry || t.target || "Unknown";
      return {
        id: t.id,
        points: arcPoints(getCoords(ac), getCoords(tc)),
        color: SEVERITY_COLORS[t.severity] || SEVERITY_COLORS.medium,
        threat: t,
        isSelected: t.id === selectedId,
      };
    });
  }, [threats, selectedId]);

  const totalAttacks = threats.length;
  const activeCorridors = corridors.length;
  const topAttacker = useMemo(() => {
    const counts: Record<string, number> = {};
    threats.forEach(t => { const a = t.attackerCountry || t.attacker || "Unknown"; counts[a] = (counts[a] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  }, [threats]);

  const handleHover = useCallback((c: string) => setHoveredNode(c), []);
  const handleLeave = useCallback(() => setHoveredNode(null), []);

  const handleImpact = useCallback((target: string, color: string, lat: number, lng: number) => {
    const id = ++impactIdRef.current;
    setImpacts(prev => [...prev.slice(-15), { id, lat, lng, color }]);
    // Remove after 1.1s
    setTimeout(() => setImpacts(prev => prev.filter(i => i.id !== id)), 1200);

    // Find the threat for ticker
    const t = threats.find(th => (th.targetCountry || th.target) === target);
    if (t) {
      const attacker = t.attackerCountry || t.attacker || "?";
      const emoji = SEVERITY_EMOJI[t.severity] || "⚪";
      const text = `${attacker} → ${target} | ${t.type} | ${t.severity.toUpperCase()}`;
      setTickerEntries(prev => [{ id, text, emoji }, ...prev].slice(0, 4));
    }
  }, [threats]);

  return (
    <div className="relative w-full h-full cyber-threat-map" style={{ minHeight: 300 }}>
      <MapContainer
        center={[30, 30]}
        zoom={2}
        minZoom={2}
        maxZoom={6}
        scrollWheelZoom={true}
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full"
        style={{ background: "hsl(220, 30%, 4%)" }}
        ref={mapRef}
        maxBounds={[[-85, -200], [85, 200]]}
        maxBoundsViscosity={0.8}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          opacity={0.7}
        />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          opacity={0.3}
        />

        {/* Corridor glow */}
        {corridors.map((c, i) => (
          <Polyline
            key={`corridor-glow-${i}`}
            positions={c.points}
            pathOptions={{
              color: SEVERITY_COLORS[c.maxSeverity] || SEVERITY_COLORS.medium,
              weight: 6 + c.intensity * 10,
              opacity: 0.06,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        ))}

        {/* Corridor core */}
        {corridors.map((c, i) => (
          <Polyline
            key={`corridor-core-${i}`}
            positions={c.points}
            pathOptions={{
              color: SEVERITY_COLORS[c.maxSeverity] || SEVERITY_COLORS.medium,
              weight: 2 + c.intensity * 3,
              opacity: 0.3 + c.intensity * 0.4,
              lineCap: "round",
              lineJoin: "round",
              dashArray: "6,10",
              className: "cyber-corridor-animated",
            }}
          />
        ))}

        {/* Individual attack arcs */}
        {arcs.map(a => (
          <Polyline
            key={`arc-${a.id}`}
            positions={a.points}
            pathOptions={{
              color: a.color,
              weight: a.isSelected ? 3 : 1.5,
              opacity: a.isSelected ? 0.8 : 0.35,
              dashArray: a.isSelected ? "8,4" : "4,6",
              className: "cyber-arc-animated",
            }}
            eventHandlers={{ click: () => onSelect(a.threat) }}
          />
        ))}

        {/* Node glow circles */}
        {nodes.map(n => (
          <CircleMarker
            key={`glow-${n.country}`}
            center={[n.lat, n.lng]}
            radius={Math.min(8 + n.count * 2, 28)}
            pathOptions={{
              color: SEVERITY_COLORS[n.severity] || SEVERITY_COLORS.medium,
              fillColor: SEVERITY_COLORS[n.severity] || SEVERITY_COLORS.medium,
              fillOpacity: 0.08,
              weight: 1,
              opacity: 0.25,
              className: "cyber-node-pulse",
            }}
          />
        ))}

        <ReticleMarkers nodes={nodes} onHover={handleHover} onLeave={handleLeave} hoveredNode={hoveredNode} />

        {/* Animated projectiles */}
        <AttackProjectiles arcs={arcs} onImpact={handleImpact} />

        {/* Impact ripples */}
        <ImpactRipples impacts={impacts} />
      </MapContainer>

      {/* Scan line overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-[401]">
        <div className="cyber-map-scan-line w-full h-10" />
      </div>

      {/* Corner brackets */}
      <div className="absolute inset-0 pointer-events-none z-[450]">
        <div className="absolute top-1 left-1 w-8 h-8 border-l-2 border-t-2 border-primary/50" />
        <div className="absolute top-1 right-1 w-8 h-8 border-r-2 border-t-2 border-primary/50" />
        <div className="absolute bottom-1 left-1 w-8 h-8 border-l-2 border-b-2 border-primary/50" />
        <div className="absolute bottom-1 right-1 w-8 h-8 border-r-2 border-b-2 border-primary/50" />
      </div>

      {/* HUD Title */}
      <div className="absolute top-3 left-3 z-[450] flex items-center gap-2">
        <div className="px-3 py-1.5 bg-[hsl(220,30%,6%)]/95 backdrop-blur-md border border-[hsl(190,40%,25%)] border-l-2 border-l-primary rounded-sm flex items-center gap-2 pointer-events-none">
          <span className="font-mono text-[10px] font-bold tracking-[0.12em] text-primary">
            CYBER THREAT OPERATIONS CENTER
          </span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(142,70%,45%)] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(142,70%,45%)]"></span>
          </span>
          <span className="font-mono text-[8px] font-semibold text-[hsl(142,70%,45%)]">LIVE</span>
        </div>
        <button
          onClick={() => setShowRamiFish(true)}
          className="px-3 py-1.5 bg-[hsl(220,30%,6%)]/95 backdrop-blur-md border border-[hsl(35,90%,50%)] rounded-sm flex items-center gap-1.5 hover:bg-[hsl(35,90%,50%)]/10 transition-colors"
        >
          <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-[hsl(35,90%,55%)]">🐟 RamiFish</span>
        </button>
      </div>

      {/* HUD Live Stats */}
      <div className="absolute top-3 right-3 z-[450] pointer-events-none">
        <div className="px-3 py-2.5 bg-[hsl(220,30%,6%)]/95 backdrop-blur-md border border-[hsl(190,40%,25%)] border-l-2 border-l-primary rounded-sm min-w-[160px]">
          <div className="font-mono text-[9px] font-semibold tracking-[0.1em] text-[hsl(190,60%,40%)] mb-1.5">LIVE STATISTICS</div>
          <div className="font-mono text-[10px] text-[hsl(0,0%,55%)]">ATTACKS: <span className="font-bold text-destructive">{totalAttacks}</span></div>
          <div className="font-mono text-[10px] text-[hsl(0,0%,55%)]">CORRIDORS: <span className="font-bold text-warning">{activeCorridors}</span></div>
          <div className="font-mono text-[10px] text-[hsl(0,0%,55%)]">TOP THREAT: <span className="font-bold text-primary">{topAttacker.substring(0, 12)}</span></div>
        </div>
      </div>

      {/* Severity legend — bottom right */}
      <div className="absolute bottom-3 right-3 z-[450] pointer-events-none">
        <div className="px-3 py-2.5 bg-[hsl(220,30%,6%)]/95 backdrop-blur-md border border-[hsl(190,40%,25%)] border-l-2 border-l-primary rounded-sm">
          <div className="font-mono text-[9px] font-semibold tracking-[0.1em] text-[hsl(190,60%,40%)] mb-1.5">SEVERITY</div>
          {(["critical", "high", "medium", "low"] as const).map(sev => (
            <div key={sev} className="flex items-center gap-2 mb-1 last:mb-0">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: SEVERITY_COLORS[sev] }} />
              <span className="font-mono text-[9px] text-[hsl(0,0%,60%)] uppercase">{sev}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live Attack Ticker — bottom left */}
      <div className="absolute bottom-3 left-3 z-[450] pointer-events-none">
        <div className="px-3 py-2 bg-[hsl(220,30%,6%)]/95 backdrop-blur-md border border-[hsl(190,40%,25%)] border-l-2 border-l-destructive rounded-sm min-w-[200px] max-w-[280px]">
          <div className="font-mono text-[9px] font-semibold tracking-[0.1em] text-destructive mb-1.5">LIVE ATTACK FEED</div>
          {tickerEntries.length === 0 ? (
            <div className="font-mono text-[9px] text-muted-foreground">Awaiting attack data…</div>
          ) : (
            tickerEntries.map(e => (
              <div key={e.id} className="cyber-ticker-entry font-mono text-[9px] text-[hsl(0,0%,65%)] truncate mb-0.5 last:mb-0">
                {e.emoji} {e.text}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredNode && (() => {
        const nd = nodes.find(n => n.country === hoveredNode);
        if (!nd) return null;
        return (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[460] pointer-events-none">
            <div className="px-4 py-2.5 bg-[hsl(220,30%,6%)]/95 backdrop-blur-md border rounded-sm min-w-[140px]"
              style={{ borderColor: SEVERITY_COLORS[nd.severity], borderLeftWidth: 3 }}>
              <div className="font-mono text-[11px] font-bold text-primary">{nd.country}</div>
              <div className="font-mono text-[9px] text-muted-foreground">TOTAL: {nd.count} INCIDENTS</div>
            </div>
          </div>
        );
      })()}

      {/* RamiFish Modal */}
      <RamiFishModal open={showRamiFish} onClose={() => setShowRamiFish(false)} liveThreats={threats} />
    </div>
  );
}
