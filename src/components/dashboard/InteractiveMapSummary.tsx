import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { useCrucixIntel } from "@/hooks/useCrucixIntel";
import { WORLD_REGIONS, COUNTRY_LABELS, GRATICULE_LATS, GRATICULE_LONS } from "@/data/worldMapPaths";
import { RefreshCw, Flame, Ship, TrendingUp, TrendingDown, Minus, Fuel, Activity, Anchor } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

/* ── Helpers ── */
const toSvg = (lon: number, lat: number): [number, number] => [
  ((lon + 180) / 360) * 900,
  ((90 - lat) / 180) * 450,
];

const fmt = (v: number | null, decimals = 2) =>
  v === null ? "—" : v.toLocaleString(undefined, { maximumFractionDigits: decimals });

const TrendIcon = ({ change }: { change: number | null }) => {
  if (change === null) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (change > 0) return <TrendingUp className="h-3 w-3 text-green-400" />;
  if (change < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
};

/* ── Sweep bar ── */
const SweepBar = ({ fred, firms, eia, ais }: { fred: any; firms: any; eia: any; ais: any }) => {
  const sources = [
    { label: "FRED", ok: !!fred, ts: fred?.timestamp },
    { label: "FIRMS", ok: !!firms, ts: firms?.timestamp },
    { label: "EIA", ok: !!eia, ts: eia?.timestamp },
    { label: "AIS", ok: !!ais, ts: ais?.timestamp },
  ];
  return (
    <div className="flex items-center gap-2 px-2 py-1 border-t border-border bg-card/50">
      <span className="text-[8px] font-mono text-muted-foreground uppercase">Data Sweep</span>
      {sources.map(s => (
        <div key={s.label} className="flex items-center gap-1">
          <div className={`w-1.5 h-1.5 rounded-full ${s.ok ? "bg-green-500 animate-pulse" : "bg-muted-foreground/30"}`} />
          <span className={`text-[7px] font-mono ${s.ok ? "text-foreground" : "text-muted-foreground/50"}`}>{s.label}</span>
        </div>
      ))}
    </div>
  );
};

export default function InteractiveMapSummary() {
  const { fred, firms, eia, ais, loading, error, refresh } = useCrucixIntel();
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [svgZoom, setSvgZoom] = useState(1);
  const [svgPan, setSvgPan] = useState<[number, number]>([0, 0]);
  const dragRef = useRef<{ start: [number, number]; panStart: [number, number] } | null>(null);

  /* ── Fires flattened ── */
  const allFires = useMemo(() =>
    firms?.hotspots?.flatMap(h => h.fires) || [], [firms]);

  /* ── Mouse pan/zoom handlers ── */
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setSvgZoom(z => Math.max(0.5, Math.min(4, z - e.deltaY * 0.002)));
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { start: [e.clientX, e.clientY], panStart: svgPan };
  }, [svgPan]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.start[0];
    const dy = e.clientY - dragRef.current.start[1];
    setSvgPan([dragRef.current.panStart[0] + dx / svgZoom, dragRef.current.panStart[1] + dy / svgZoom]);
  }, [svgZoom]);

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  if (loading && !fred && !firms && !eia && !ais) {
    return (
      <div className="flex items-center justify-center h-full w-full">
        <div className="text-center space-y-3">
          <RefreshCw className="h-8 w-8 text-primary animate-spin mx-auto" />
          <p className="text-[10px] font-mono text-muted-foreground">INITIALIZING CRUCIX INTELLIGENCE SWEEP…</p>
          <div className="flex gap-2 justify-center">
            {["FRED", "FIRMS", "EIA", "AIS"].map(s => (
              <span key={s} className="text-[8px] font-mono px-2 py-0.5 rounded border border-border text-muted-foreground/50">{s}</span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-background/50">
      {/* ── TOP: Signal summary ── */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border bg-card/30">
        <span className="text-[9px] font-mono text-primary uppercase tracking-wider font-semibold">CRUCIX INTEL</span>
        <div className="flex items-center gap-2 text-[8px] font-mono text-muted-foreground">
          <Flame className="h-3 w-3 text-orange-400" />{firms?.totalGlobal ?? "—"} fires
          <Ship className="h-3 w-3 text-cyan-400 ml-1" />{ais?.totalVessels ?? "—"} vessels
          <Activity className="h-3 w-3 text-primary ml-1" />{fred?.indicators?.length ?? 0} indicators
          <Fuel className="h-3 w-3 text-yellow-400 ml-1" />{eia?.series?.length ?? 0} energy series
        </div>
        <button onClick={refresh} className="ml-auto text-[8px] px-2 py-0.5 rounded border border-primary/30 text-primary hover:bg-primary/10 transition-colors font-mono flex items-center gap-1">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />REFRESH
        </button>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="flex flex-1 min-h-0">
        {/* ── LEFT SIDEBAR: Economic + Energy ── */}
        <div className="w-48 border-r border-border bg-card/20 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              {/* FRED Indicators */}
              <div>
                <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Activity className="h-3 w-3 text-primary" />ECONOMIC INDICATORS
                </div>
                <div className="space-y-0.5">
                  {fred?.indicators?.map(ind => (
                    <div key={ind.id} className="flex items-center justify-between px-1.5 py-1 rounded bg-muted/20 border border-border/50 hover:bg-muted/40 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-[8px] font-mono text-foreground truncate">{ind.label}</div>
                        <div className="text-[7px] text-muted-foreground">{ind.date}</div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[9px] font-mono font-bold text-foreground">{fmt(ind.value)}</span>
                        <TrendIcon change={ind.change} />
                      </div>
                    </div>
                  )) || <p className="text-[8px] text-muted-foreground/50">Loading…</p>}
                </div>
              </div>

              {/* EIA Energy */}
              <div>
                <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Fuel className="h-3 w-3 text-yellow-400" />ENERGY MARKETS
                </div>
                <div className="space-y-0.5">
                  {eia?.series?.map(s => (
                    <div key={s.id} className="flex items-center justify-between px-1.5 py-1 rounded bg-muted/20 border border-border/50 hover:bg-muted/40 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="text-[8px] font-mono text-foreground truncate">{s.label}</div>
                        <div className="text-[7px] text-muted-foreground">{s.unit}</div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-[9px] font-mono font-bold text-foreground">{fmt(s.value)}</span>
                        <TrendIcon change={s.change} />
                      </div>
                    </div>
                  )) || <p className="text-[8px] text-muted-foreground/50">Loading…</p>}
                </div>
              </div>

              {/* VIX Gauge */}
              {fred?.indicators?.find(i => i.id === "VIXCLS") && (() => {
                const vix = fred.indicators.find(i => i.id === "VIXCLS")!;
                const pct = Math.min(100, ((vix.value ?? 0) / 80) * 100);
                const color = (vix.value ?? 0) > 30 ? "bg-red-500" : (vix.value ?? 0) > 20 ? "bg-yellow-500" : "bg-green-500";
                return (
                  <div className="p-2 rounded border border-border bg-muted/10">
                    <div className="text-[8px] font-mono text-muted-foreground mb-1">VIX FEAR GAUGE</div>
                    <div className="w-full h-2 bg-muted/30 rounded-full overflow-hidden">
                      <div className={`h-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-[7px] text-muted-foreground">0</span>
                      <span className="text-[9px] font-mono font-bold text-foreground">{fmt(vix.value, 1)}</span>
                      <span className="text-[7px] text-muted-foreground">80</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </ScrollArea>
        </div>

        {/* ── CENTER: D3 SVG World Map ── */}
        <div className="flex-1 relative overflow-hidden bg-background"
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <svg
            viewBox="0 0 900 450"
            className="w-full h-full select-none"
            style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
          >
            <g transform={`scale(${svgZoom}) translate(${svgPan[0]}, ${svgPan[1]})`}>
              {/* Graticule */}
              {GRATICULE_LATS.map(lat => {
                const y = ((90 - lat) / 180) * 450;
                return <line key={`lat-${lat}`} x1={0} x2={900} y1={y} y2={y} stroke="hsl(var(--border))" strokeWidth={0.3} strokeDasharray="4,4" />;
              })}
              {GRATICULE_LONS.map(lon => {
                const x = ((lon + 180) / 360) * 900;
                return <line key={`lon-${lon}`} x1={x} x2={x} y1={0} y2={450} stroke="hsl(var(--border))" strokeWidth={0.3} strokeDasharray="4,4" />;
              })}

              {/* Regions */}
              {WORLD_REGIONS.map(r => (
                <path
                  key={r.name}
                  d={r.d}
                  fill={hoveredRegion === r.name ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted) / 0.2)"}
                  stroke="hsl(var(--primary) / 0.4)"
                  strokeWidth={0.5}
                  onMouseEnter={() => setHoveredRegion(r.name)}
                  onMouseLeave={() => setHoveredRegion(null)}
                  className="transition-colors cursor-pointer"
                />
              ))}

              {/* Region labels */}
              {WORLD_REGIONS.filter(r => r.showLabel).map(r => (
                <text key={`lbl-${r.name}`} x={r.labelX} y={r.labelY} textAnchor="middle"
                  className="text-[6px] font-mono fill-muted-foreground/50 pointer-events-none select-none">{r.name}</text>
              ))}

              {/* Country labels */}
              {COUNTRY_LABELS.map(c => {
                const [x, y] = toSvg(c.lon, c.lat);
                return <text key={c.name} x={x} y={y} textAnchor="middle"
                  className="text-[5px] font-mono fill-muted-foreground/40 pointer-events-none select-none">{c.name}</text>;
              })}

              {/* 🔥 Fire markers */}
              {allFires.slice(0, 300).map(f => {
                const [x, y] = toSvg(f.lng, f.lat);
                const r = Math.max(1, Math.min(3, f.frp / 50));
                return (
                  <circle key={f.id} cx={x} cy={y} r={r}
                    fill={f.confidence === "high" ? "hsl(0 90% 55%)" : "hsl(30 90% 55%)"}
                    opacity={0.7}
                    className="pointer-events-none"
                  >
                    <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2s" repeatCount="indefinite" />
                  </circle>
                );
              })}

              {/* 🚢 Vessel markers */}
              {ais?.chokepoints?.map(cp => {
                const [cx, cy] = toSvg(cp.lng, cp.lat);
                return (
                  <g key={cp.chokepoint}>
                    <circle cx={cx} cy={cy} r={8} fill="hsl(var(--primary) / 0.1)" stroke="hsl(190 80% 50%)" strokeWidth={0.5}>
                      <animate attributeName="r" values="6;10;6" dur="3s" repeatCount="indefinite" />
                    </circle>
                    {cp.vessels.slice(0, 6).map((v, i) => {
                      const [vx, vy] = toSvg(v.lng, v.lat);
                      return <circle key={`${cp.chokepoint}-${i}`} cx={vx} cy={vy} r={1}
                        fill={v.type === "Naval" ? "hsl(0 80% 60%)" : v.type === "Tanker" ? "hsl(40 80% 60%)" : "hsl(190 80% 60%)"}
                        opacity={0.8} className="pointer-events-none" />;
                    })}
                    <text x={cx} y={cy - 10} textAnchor="middle"
                      className="text-[5px] font-mono fill-cyan-400 pointer-events-none select-none">
                      {cp.chokepoint} ({cp.vesselCount})
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>

          {/* Map legend overlay */}
          <div className="absolute bottom-2 left-2 bg-card/80 backdrop-blur border border-border rounded p-2 space-y-1" style={{ zIndex: 10 }}>
            <div className="text-[7px] font-mono text-muted-foreground uppercase">Legend</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-[7px] text-muted-foreground">High conf fire</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-400" /><span className="text-[7px] text-muted-foreground">Fire detection</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-cyan-400" /><span className="text-[7px] text-muted-foreground">Vessel</span></div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /><span className="text-[7px] text-muted-foreground">Naval vessel</span></div>
          </div>
        </div>

        {/* ── RIGHT SIDEBAR: Maritime chokepoints ── */}
        <div className="w-44 border-l border-border bg-card/20 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-2">
              <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Anchor className="h-3 w-3 text-cyan-400" />MARITIME CHOKEPOINTS
              </div>
              {ais?.chokepoints?.map(cp => (
                <div key={cp.chokepoint} className="p-1.5 rounded border border-border bg-muted/10 hover:bg-muted/30 transition-colors">
                  <div className="text-[8px] font-mono text-foreground font-semibold">{cp.chokepoint}</div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[7px] text-muted-foreground">{cp.vesselCount} vessels tracked</span>
                    <Ship className="h-3 w-3 text-cyan-400" />
                  </div>
                  <div className="flex gap-0.5 mt-1 flex-wrap">
                    {["Tanker", "Cargo", "Naval"].map(t => {
                      const cnt = cp.vessels.filter(v => v.type === t).length;
                      if (cnt === 0) return null;
                      return (
                        <span key={t} className={`text-[6px] px-1 py-0.5 rounded font-mono ${t === "Naval" ? "bg-red-500/20 text-red-400" : t === "Tanker" ? "bg-yellow-500/20 text-yellow-400" : "bg-muted/30 text-muted-foreground"}`}>
                          {t}: {cnt}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )) || <p className="text-[8px] text-muted-foreground/50">Loading…</p>}

              {/* FIRMS hotspot summary */}
              <div className="mt-2">
                <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Flame className="h-3 w-3 text-orange-400" />THERMAL HOTSPOTS
                </div>
                {firms?.hotspots?.map(h => (
                  <div key={h.region} className="flex items-center justify-between px-1.5 py-1 rounded bg-muted/10 border border-border/50 mt-0.5">
                    <span className="text-[8px] font-mono text-foreground">{h.region}</span>
                    <span className="text-[8px] font-mono text-orange-400 font-bold">{h.fires.length}</span>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* ── BOTTOM: Sweep status ── */}
      <SweepBar fred={fred} firms={firms} eia={eia} ais={ais} />

      {error && (
        <div className="px-3 py-1 bg-destructive/10 border-t border-destructive/30 text-[8px] font-mono text-destructive">
          Error: {error}
        </div>
      )}
    </div>
  );
}
