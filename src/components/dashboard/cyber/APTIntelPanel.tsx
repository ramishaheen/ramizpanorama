import { useState, useEffect } from "react";
import { Target, Shield, Crosshair, Bug, Globe, ExternalLink, RefreshCw, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { useAPTIntel, type APTGroup } from "@/hooks/useAPTIntel";

const RISK_COLORS: Record<string, string> = {
  critical: "bg-destructive/20 text-destructive border-destructive/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  low: "bg-primary/20 text-primary border-primary/30",
};

const TACTIC_COLORS: Record<string, string> = {
  "Initial Access": "text-orange-400",
  "Execution": "text-destructive",
  "Persistence": "text-yellow-400",
  "Privilege Escalation": "text-orange-400",
  "Defense Evasion": "text-purple-400",
  "Credential Access": "text-pink-400",
  "Discovery": "text-primary",
  "Lateral Movement": "text-green-400",
  "Collection": "text-yellow-400",
  "Impact": "text-destructive",
  "Exfiltration": "text-orange-400",
  "Command and Control": "text-purple-400",
  "Resource Development": "text-muted-foreground",
  "Reconnaissance": "text-primary",
};

export function APTIntelPanel() {
  const { groups, loading, error, fetchGroups } = useAPTIntel();
  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<APTGroup | null>(null);
  const [filterCountry, setFilterCountry] = useState("All");

  useEffect(() => { fetchGroups(); }, []);

  const countries = ["All", ...Array.from(new Set(groups.map(g => g.country)))];

  const filtered = groups.filter(g => {
    if (filterCountry !== "All" && g.country !== filterCountry) return false;
    if (search) {
      const q = search.toLowerCase();
      return g.name.toLowerCase().includes(q) || g.aliases.some(a => a.toLowerCase().includes(q)) ||
        g.tools.some(t => t.toLowerCase().includes(q)) || g.country.toLowerCase().includes(q);
    }
    return true;
  });

  if (selectedGroup) {
    return (
      <div className="h-full flex flex-col" style={{ background: "hsl(var(--background))" }}>
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2">
            <button onClick={() => setSelectedGroup(null)} className="text-[9px] px-2 py-0.5 rounded border border-border hover:border-primary/50 text-muted-foreground hover:text-foreground transition-colors font-mono">← BACK</button>
            <span className="text-xs font-bold">{selectedGroup.flag} {selectedGroup.name}</span>
            <span className={`text-[7px] px-1.5 py-0.5 rounded border font-mono uppercase font-bold ${RISK_COLORS[selectedGroup.risk_level]}`}>{selectedGroup.risk_level}</span>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* Overview */}
            <div className="p-3 rounded border border-border bg-card/50">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Overview</div>
              <p className="text-[11px] text-foreground leading-relaxed">{selectedGroup.description}</p>
              <div className="flex gap-2 mt-2 text-[9px]">
                <span className="text-muted-foreground">Sponsorship:</span>
                <span className="text-foreground font-bold">{selectedGroup.sponsorship}</span>
                <span className="text-muted-foreground ml-2">Active Since:</span>
                <span className="text-foreground font-bold">{selectedGroup.active_since}</span>
                <span className="text-muted-foreground ml-2">IOCs:</span>
                <span className="text-destructive font-bold">{selectedGroup.iocs_count}</span>
              </div>
              {selectedGroup.aliases.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {selectedGroup.aliases.map((a, i) => (
                    <span key={i} className="text-[7px] px-1.5 py-0.5 rounded bg-muted/30 border border-border text-muted-foreground font-mono">{a}</span>
                  ))}
                </div>
              )}
            </div>

            {/* MITRE ATT&CK */}
            <div className="p-3 rounded border border-destructive/20 bg-destructive/5">
              <div className="text-[9px] font-mono text-destructive uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Crosshair className="h-3 w-3" /> MITRE ATT&CK Techniques
              </div>
              <div className="space-y-1.5">
                {selectedGroup.mitre_techniques.map((t, i) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span className="font-mono text-destructive font-bold w-12 flex-shrink-0">{t.id}</span>
                    <span className="font-bold text-foreground">{t.name}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded bg-muted/20 border border-border font-mono ${TACTIC_COLORS[t.tactic] || "text-muted-foreground"}`}>{t.tactic}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Campaigns */}
            <div className="p-3 rounded border border-border bg-card/50">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Target className="h-3 w-3" /> Known Campaigns
              </div>
              <div className="space-y-2">
                {selectedGroup.known_campaigns.map((c, i) => (
                  <div key={i} className="p-2 rounded bg-muted/20 border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-foreground">{c.name}</span>
                      <span className="text-[8px] font-mono text-muted-foreground">{c.year}</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground">{c.description}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Targeting */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded border border-border bg-card/50">
                <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Target Sectors</div>
                <div className="space-y-1">
                  {selectedGroup.target_sectors.map((s, i) => (
                    <div key={i} className="text-[9px] text-foreground">• {s}</div>
                  ))}
                </div>
              </div>
              <div className="p-3 rounded border border-border bg-card/50">
                <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Target Countries</div>
                <div className="space-y-1">
                  {selectedGroup.target_countries.map((c, i) => (
                    <div key={i} className="text-[9px] text-foreground">• {c}</div>
                  ))}
                </div>
              </div>
            </div>

            {/* Tools */}
            <div className="p-3 rounded border border-border bg-card/50">
              <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Bug className="h-3 w-3" /> Tools & Malware Arsenal
              </div>
              <div className="flex gap-1 flex-wrap">
                {selectedGroup.tools.map((t, i) => (
                  <span key={i} className="text-[8px] px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" style={{ background: "hsl(var(--background))" }}>
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <Shield className="h-4 w-4 text-destructive" />
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-foreground">APT Group Intelligence</span>
        <span className="text-[8px] font-mono text-muted-foreground ml-auto">{groups.length} groups tracked</span>
        <button onClick={fetchGroups} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-border flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search APT group, tool, country..." className="h-7 pl-7 text-[10px] bg-background/50 border-border" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {countries.slice(0, 8).map(c => (
            <button key={c} onClick={() => setFilterCountry(c)} className={`text-[7px] px-1.5 py-0.5 rounded border font-mono transition-colors ${filterCountry === c ? "bg-primary/20 text-primary border-primary/40" : "border-border text-muted-foreground hover:text-foreground"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {loading && groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Shield className="h-8 w-8 mb-2 animate-pulse text-destructive" />
              <span className="text-xs font-mono">COMPILING APT INTELLIGENCE...</span>
              <span className="text-[9px] text-muted-foreground/60 mt-1">Querying threat intelligence databases</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-[10px] text-muted-foreground py-8 font-mono">No APT groups match filters</div>
          ) : filtered.map(group => (
            <button
              key={group.id}
              onClick={() => setSelectedGroup(group)}
              className="w-full text-left p-3 rounded border border-border bg-card/50 hover:bg-card/80 hover:border-primary/30 transition-all"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-sm">{group.flag}</span>
                <span className="text-[11px] font-bold text-foreground">{group.name}</span>
                <span className={`text-[7px] px-1.5 py-0.5 rounded border font-mono uppercase font-bold ${RISK_COLORS[group.risk_level]}`}>{group.risk_level}</span>
                <span className="text-[8px] font-mono text-muted-foreground ml-auto">{group.sponsorship}</span>
              </div>
              <p className="text-[9px] text-muted-foreground line-clamp-2 mb-2">{group.description}</p>
              <div className="flex gap-1 flex-wrap">
                {group.mitre_techniques.slice(0, 3).map((t, i) => (
                  <span key={i} className="text-[7px] px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 font-mono">{t.id}</span>
                ))}
                {group.tools.slice(0, 3).map((t, i) => (
                  <span key={i} className="text-[7px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20 font-mono">{t}</span>
                ))}
                <span className="text-[7px] px-1.5 py-0.5 rounded bg-muted/30 border border-border text-muted-foreground font-mono">{group.iocs_count} IOCs</span>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
