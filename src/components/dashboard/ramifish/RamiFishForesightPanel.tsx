import { GitBranch, TrendingUp, AlertTriangle, Shield } from "lucide-react";

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

function extractRelationDiagram(output: string): string | null {
  const diagMatch = output.match(/## 📊 Data Relation Diagram[\s\S]*?(?=## 🔮|$)/i);
  if (!diagMatch) return null;
  const lines = diagMatch[0].split("\n").slice(1).filter(l => l.trim()).join("\n");
  return lines || null;
}

const SCENARIO_ICONS = [TrendingUp, AlertTriangle, Shield];
const SCENARIO_COLORS = [
  "border-[hsl(190,60%,40%)]/50 bg-[hsl(190,60%,40%)]/5",
  "border-[hsl(40,90%,50%)]/50 bg-[hsl(40,90%,50%)]/5",
  "border-[hsl(0,70%,50%)]/50 bg-[hsl(0,70%,50%)]/5",
];

export default function RamiFishForesightPanel({ output, isComplete }: Props) {
  if (!isComplete || !output) return null;

  const scenarios = extractScenarios(output);
  const diagram = extractRelationDiagram(output);

  if (!scenarios.length && !diagram) return null;

  return (
    <div className="border-t border-border bg-[hsl(220,30%,5%)] p-4 space-y-4 max-h-[45%] overflow-y-auto">
      {/* Relation Diagram */}
      {diagram && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <GitBranch className="w-3.5 h-3.5 text-primary" />
            <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-primary uppercase">
              Data Relation Diagram
            </span>
          </div>
          <pre className="bg-[hsl(220,30%,8%)] border border-border rounded-sm p-3 text-[10px] font-mono text-foreground/80 whitespace-pre-wrap leading-relaxed overflow-x-auto">
            {diagram}
          </pre>
        </div>
      )}

      {/* Foresight Scenarios */}
      {scenarios.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">🔮</span>
            <span className="font-mono text-[10px] font-bold tracking-[0.1em] text-primary uppercase">
              Future Foresight Scenarios
            </span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {scenarios.map((s, i) => {
              const Icon = SCENARIO_ICONS[i] || TrendingUp;
              return (
                <div
                  key={i}
                  className={`border rounded-sm p-3 ${SCENARIO_COLORS[i] || SCENARIO_COLORS[0]} transition-colors`}
                >
                  <div className="flex items-start gap-2 mb-2">
                    <Icon className="w-4 h-4 text-foreground/70 mt-0.5 shrink-0" />
                    <div>
                      <div className="font-mono text-[10px] font-bold text-foreground leading-tight">
                        {s.title}
                      </div>
                      <div className="font-mono text-[9px] text-primary font-bold mt-0.5">
                        {s.probability}
                      </div>
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
                    <div className="font-mono text-[9px] text-foreground/70 mt-1 line-clamp-3">
                      {s.description}
                    </div>
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
    </div>
  );
}
