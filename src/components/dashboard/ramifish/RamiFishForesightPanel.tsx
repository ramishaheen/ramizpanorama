import { useMemo } from "react";
import { GitBranch, TrendingUp, AlertTriangle, Shield, Radar } from "lucide-react";

interface Props {
  output: string;
  isComplete: boolean;
}

interface Scenario {
  title: string;
  probability: string;
  timeframe: string;
  trigger: string;
  description: string;
  impact: string;
}

interface Entity {
  name: string;
  type: string;
  threat: number;
}

interface Relation {
  source: string;
  target: string;
  type: string;
  weight: number;
}

interface RadarDim {
  label: string;
  value: number;
}

function extractScenarios(output: string): Scenario[] {
  const scenarios: Scenario[] = [];
  const scenarioRegex = /### Scenario \d+:\s*(.+?)(?:\(Probability:\s*(\d+%?)\))?[\s\S]*?\*\*Timeframe:\*\*\s*(.+?)[\r\n][\s\S]*?\*\*Trigger:\*\*\s*(.+?)[\r\n][\s\S]*?\*\*Description:\*\*\s*(.+?)[\r\n][\s\S]*?\*\*Impact:\*\*\s*(.+?)(?=###|$)/gi;
  let match;
  while ((match = scenarioRegex.exec(output)) !== null && scenarios.length < 3) {
    scenarios.push({
      title: match[1].trim(),
      probability: match[2]?.trim() || "N/A",
      timeframe: match[3]?.trim() || "Unknown",
      trigger: match[4]?.trim() || "Unknown",
      description: match[5]?.trim() || "",
      impact: match[6]?.trim() || "",
    });
  }
  return scenarios;
}

function extractEntities(output: string): Entity[] {
  const entities: Entity[] = [];
  // Match variations: with or without markdown formatting, backticks, bold, bullets etc.
  const regex = /(?:^|\n)[*\-\s`]*ENTITY:\s*(.+?)\s*\|\s*TYPE:\s*(\w+)\s*\|\s*THREAT:\s*(\d+)/gi;
  let m;
  while ((m = regex.exec(output)) !== null) {
    entities.push({ name: m[1].replace(/[`*]/g, '').trim(), type: m[2].trim().toLowerCase(), threat: parseInt(m[3]) });
  }
  // Fallback: try table format  "| Name | Type | Threat |"
  if (entities.length === 0) {
    const tableRegex = /\|\s*([^|]+?)\s*\|\s*(actor|target|force|org|event)\s*\|\s*(\d+)\s*\|/gi;
    while ((m = tableRegex.exec(output)) !== null) {
      const name = m[1].replace(/[`*]/g, '').trim();
      if (name && name.toLowerCase() !== 'name' && name.toLowerCase() !== 'entity') {
        entities.push({ name, type: m[2].trim().toLowerCase(), threat: parseInt(m[3]) });
      }
    }
  }
  return entities;
}

function extractRelations(output: string): Relation[] {
  const relations: Relation[] = [];
  const regex = /(?:^|\n)[*\-\s`]*RELATION:\s*(.+?)\s*->\s*(.+?)\s*\|\s*TYPE:\s*(\w+)\s*\|\s*WEIGHT:\s*(\d+)/gi;
  let m;
  while ((m = regex.exec(output)) !== null) {
    relations.push({ source: m[1].replace(/[`*]/g, '').trim(), target: m[2].replace(/[`*]/g, '').trim(), type: m[3].trim().toLowerCase(), weight: parseInt(m[4]) });
  }
  // Fallback: table format "| Source | Target | Type | Weight |"
  if (relations.length === 0) {
    const tableRegex = /\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(threatens|attacks|opposes|destabilizes|supplies|funds|allied|supports|controls)\s*\|\s*(\d+)\s*\|/gi;
    while ((m = tableRegex.exec(output)) !== null) {
      const src = m[1].replace(/[`*]/g, '').trim();
      if (src && src.toLowerCase() !== 'source') {
        relations.push({ source: src, target: m[2].replace(/[`*]/g, '').trim(), type: m[3].trim().toLowerCase(), weight: parseInt(m[4]) });
      }
    }
  }
  return relations;
}

function extractRadar(output: string): RadarDim[] {
  const dims: RadarDim[] = [];
  const regex = /(?:^|\n)[*\-\s`]*RADAR:\s*(.+?)\s*\|\s*VALUE:\s*(\d+)/gi;
  let m;
  while ((m = regex.exec(output)) !== null) {
    dims.push({ label: m[1].replace(/[`*]/g, '').trim(), value: Math.min(parseInt(m[2]), 100) });
  }
  // Fallback: table "| Dimension | Value |"
  if (dims.length === 0) {
    const tableRegex = /\|\s*(Military Escalation|Economic Impact|Diplomatic Risk|Cyber Threat|Humanitarian Crisis|Regional Instability|[^|]{3,30})\s*\|\s*(\d+)%?\s*\|/gi;
    while ((m = tableRegex.exec(output)) !== null) {
      const label = m[1].replace(/[`*]/g, '').trim();
      if (label.toLowerCase() !== 'dimension' && label.toLowerCase() !== 'label') {
        dims.push({ label, value: Math.min(parseInt(m[2]), 100) });
      }
    }
  }
  return dims;
}

function extractAsciiDiagram(output: string): string | null {
  const diagMatch = output.match(/##\s*📊\s*Data Relation Diagram[\s\S]*?(?=##\s*🔮|$)/i);
  if (!diagMatch) return null;
  const lines = diagMatch[0].split("\n").slice(1)
    .filter(l => l.trim() && !l.match(/^[*\-\s`]*(ENTITY|RELATION|RADAR):/i) && !l.match(/^\|.*\|.*\|/))
    .join("\n");
  return lines || null;
}

/* ── Radar Chart SVG ── */
function RadarChart({ dims }: { dims: RadarDim[] }) {
  const cx = 140, cy = 140, maxR = 110;
  const n = dims.length;
  if (n < 3) return null;

  const angleStep = (Math.PI * 2) / n;

  const toXY = (index: number, value: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (value / 100) * maxR;
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  };

  const gridLevels = [25, 50, 75, 100];
  const dataPoints = dims.map((d, i) => toXY(i, d.value));
  const polygonPoints = dataPoints.map(p => `${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox="0 0 280 280" className="w-full max-w-[280px]">
      {/* Grid */}
      {gridLevels.map(lv => {
        const pts = Array.from({ length: n }, (_, i) => toXY(i, lv));
        return (
          <polygon
            key={lv}
            points={pts.map(p => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth={0.5}
            opacity={0.5}
          />
        );
      })}
      {/* Axes */}
      {dims.map((_, i) => {
        const end = toXY(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y} stroke="hsl(var(--border))" strokeWidth={0.5} opacity={0.3} />;
      })}
      {/* Data polygon */}
      <polygon points={polygonPoints} fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth={1.5} />
      {/* Data dots + labels */}
      {dims.map((d, i) => {
        const p = toXY(i, d.value);
        const labelP = toXY(i, 118);
        const color = d.value >= 70 ? "hsl(0 90% 55%)" : d.value >= 40 ? "hsl(40 90% 55%)" : "hsl(var(--primary))";
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={3} fill={color} />
            <text
              x={labelP.x}
              y={labelP.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="hsl(var(--foreground))"
              fontSize={7}
              fontFamily="monospace"
              opacity={0.8}
            >
              {d.label.length > 14 ? d.label.substring(0, 12) + ".." : d.label}
            </text>
            <text
              x={labelP.x}
              y={labelP.y + 10}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={color}
              fontSize={8}
              fontFamily="monospace"
              fontWeight="bold"
            >
              {d.value}%
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── Relation Graph SVG ── */
function RelationGraph({ entities, relations }: { entities: Entity[]; relations: Relation[] }) {
  const W = 500, H = 300;
  const cx = W / 2, cy = H / 2;

  const typeColors: Record<string, string> = {
    actor: "hsl(0 70% 55%)",
    target: "hsl(190 70% 55%)",
    force: "hsl(40 80% 55%)",
    org: "hsl(270 60% 60%)",
    event: "hsl(120 50% 50%)",
  };

  const relationColors: Record<string, string> = {
    threatens: "hsl(0 80% 55%)",
    attacks: "hsl(0 80% 55%)",
    opposes: "hsl(25 80% 55%)",
    destabilizes: "hsl(40 80% 55%)",
    supplies: "hsl(190 60% 50%)",
    funds: "hsl(270 60% 55%)",
    allied: "hsl(120 50% 50%)",
    supports: "hsl(120 50% 50%)",
    controls: "hsl(45 80% 50%)",
  };

  // Position entities in a circle
  const angleStep = (Math.PI * 2) / entities.length;
  const positioned = entities.map((e, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = Math.min(cx, cy) * 0.72;
    return { ...e, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  const entityMap = new Map(positioned.map(e => [e.name, e]));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <defs>
        <marker id="rf-arrow" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto">
          <path d="M0,0 L10,3 L0,6" fill="hsl(var(--muted-foreground))" opacity={0.5} />
        </marker>
      </defs>
      {/* Relations */}
      {relations.map((r, i) => {
        const src = entityMap.get(r.source);
        const tgt = entityMap.get(r.target);
        if (!src || !tgt) return null;
        const color = relationColors[r.type] || "hsl(var(--border))";
        const midX = (src.x + tgt.x) / 2;
        const midY = (src.y + tgt.y) / 2 - 8;
        return (
          <g key={i}>
            <line
              x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
              stroke={color} strokeWidth={Math.max(0.5, r.weight / 4)}
              opacity={0.5} markerEnd="url(#rf-arrow)"
            />
            <text x={midX} y={midY} textAnchor="middle" fill={color} fontSize={6} fontFamily="monospace" opacity={0.7}>
              {r.type}
            </text>
          </g>
        );
      })}
      {/* Entity nodes */}
      {positioned.map((e, i) => {
        const nodeColor = typeColors[e.type] || "hsl(var(--primary))";
        const radius = 6 + (e.threat / 100) * 10;
        return (
          <g key={i}>
            <circle cx={e.x} cy={e.y} r={radius + 3} fill={nodeColor} opacity={0.1} />
            <circle cx={e.x} cy={e.y} r={radius} fill={nodeColor} opacity={0.6} />
            <circle cx={e.x} cy={e.y} r={3} fill={nodeColor} />
            <text
              x={e.x} y={e.y + radius + 12}
              textAnchor="middle" fill="hsl(var(--foreground))" fontSize={7} fontFamily="monospace" opacity={0.85}
            >
              {e.name.length > 18 ? e.name.substring(0, 16) + ".." : e.name}
            </text>
            <text
              x={e.x} y={e.y - radius - 5}
              textAnchor="middle" fill={nodeColor} fontSize={6} fontFamily="monospace" fontWeight="bold"
            >
              {e.threat}%
            </text>
          </g>
        );
      })}
      {/* Legend */}
      {Object.entries(typeColors).slice(0, 5).map(([type, color], i) => (
        <g key={type}>
          <circle cx={12} cy={12 + i * 14} r={4} fill={color} opacity={0.7} />
          <text x={20} y={15 + i * 14} fill="hsl(var(--foreground))" fontSize={7} fontFamily="monospace" opacity={0.6}>
            {type}
          </text>
        </g>
      ))}
    </svg>
  );
}

const SCENARIO_ICONS = [TrendingUp, AlertTriangle, Shield];
const SCENARIO_COLORS = [
  "border-[hsl(190,60%,40%)]/50 bg-[hsl(190,60%,40%)]/5",
  "border-[hsl(40,90%,50%)]/50 bg-[hsl(40,90%,50%)]/5",
  "border-[hsl(0,70%,50%)]/50 bg-[hsl(0,70%,50%)]/5",
];

export default function RamiFishForesightPanel({ output, isComplete }: Props) {
  // Parse on every output change (not just isComplete) so graphs update live
  const scenarios = useMemo(() => output ? extractScenarios(output) : [], [output]);
  const entities = useMemo(() => output ? extractEntities(output) : [], [output]);
  const relations = useMemo(() => output ? extractRelations(output) : [], [output]);
  const radarDims = useMemo(() => output ? extractRadar(output) : [], [output]);
  const asciiDiagram = useMemo(() => output ? extractAsciiDiagram(output) : null, [output]);

  const hasGraph = entities.length >= 2;
  const hasRadar = radarDims.length >= 3;
  const hasVisuals = hasGraph || hasRadar || (!!asciiDiagram && !hasGraph);

  if (!output) return null;
  if (!scenarios.length && !hasVisuals) return null;

  return (
    <div className="border-t border-border bg-[hsl(220,30%,5%)] p-4 space-y-4 max-h-[55%] overflow-y-auto">
      {/* ── Main layout: Scenarios LEFT + Diagrams RIGHT ── */}
      <div className={`grid gap-4 ${scenarios.length > 0 && hasVisuals ? "grid-cols-[1fr_1fr]" : "grid-cols-1"}`}>

        {/* LEFT — Foresight Scenarios */}
        {scenarios.length > 0 && (
          <div className="border border-border rounded bg-[hsl(220,30%,7%)] p-3">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">🔮</span>
              <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-primary uppercase">
                Future Foresight Scenarios
              </span>
            </div>
            <div className="space-y-3">
              {scenarios.map((s, i) => {
                const Icon = SCENARIO_ICONS[i] || TrendingUp;
                return (
                  <div key={i} className={`border rounded-sm p-3 ${SCENARIO_COLORS[i] || SCENARIO_COLORS[0]} transition-colors`}>
                    <div className="flex items-start gap-2 mb-2">
                      <Icon className="w-4 h-4 text-foreground/70 mt-0.5 shrink-0" />
                      <div>
                        <div className="font-mono text-[10px] font-bold text-foreground leading-tight">{s.title}</div>
                        <div className="font-mono text-[9px] text-primary font-bold mt-0.5">{s.probability}</div>
                      </div>
                    </div>
                    <div className="space-y-1.5 mt-2">
                      <div>
                        <span className="font-mono text-[8px] text-muted-foreground uppercase">Timeframe: </span>
                        <span className="font-mono text-[9px] text-foreground/80">{s.timeframe}</span>
                      </div>
                      <div>
                        <span className="font-mono text-[8px] text-muted-foreground uppercase">Trigger: </span>
                        <span className="font-mono text-[9px] text-foreground/80">{s.trigger}</span>
                      </div>
                      <div className="font-mono text-[9px] text-foreground/70 mt-1 line-clamp-3">{s.description}</div>
                      <div className="border-t border-border/50 pt-1.5 mt-1.5">
                        <span className="font-mono text-[8px] text-muted-foreground uppercase">Impact: </span>
                        <span className="font-mono text-[9px] text-foreground/80">{s.impact}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* RIGHT — Relation Graph + Radar stacked in a box */}
        {hasVisuals && (
          <div className="border border-border rounded bg-[hsl(220,30%,7%)] p-3 space-y-4">
            {/* Relation Graph */}
            {hasGraph && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <GitBranch className="w-3.5 h-3.5 text-primary" />
                  <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-primary uppercase">
                    Entity Relation Diagram
                  </span>
                  <span className="font-mono text-[8px] text-muted-foreground ml-auto">
                    {entities.length} entities · {relations.length} relations
                  </span>
                </div>
                <div className="bg-[hsl(220,30%,5%)] border border-border rounded-sm p-2 overflow-hidden">
                  <RelationGraph entities={entities} relations={relations} />
                </div>
              </div>
            )}

            {/* ASCII Diagram fallback */}
            {asciiDiagram && !hasGraph && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <GitBranch className="w-3.5 h-3.5 text-primary" />
                  <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-primary uppercase">
                    Data Relation Diagram
                  </span>
                </div>
                <pre className="bg-[hsl(220,30%,5%)] border border-border rounded-sm p-3 text-[10px] font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed overflow-x-auto">
                  {asciiDiagram}
                </pre>
              </div>
            )}

            {/* Radar Chart */}
            {hasRadar && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Radar className="w-3.5 h-3.5 text-primary" />
                  <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-primary uppercase">
                    Threat Radar
                  </span>
                </div>
                <div className="bg-[hsl(220,30%,5%)] border border-border rounded-sm p-2 flex items-center justify-center">
                  <RadarChart dims={radarDims} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
