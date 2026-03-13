import { ExternalLink, Github, Activity, CheckCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface IntelEngine {
  name: string;
  description: string;
  repo: string;
  docs: string;
  status: "connected" | "active" | "monitoring";
  statusLabel: string;
  category: string;
  features: string[];
}

const ENGINES: IntelEngine[] = [
  {
    name: "SpiderFoot",
    description: "Open source intelligence (OSINT) automation tool. Integrates with over 200 data sources to gather intelligence on IP addresses, domain names, email addresses, and more.",
    repo: "https://github.com/smicallef/spiderfoot",
    docs: "https://www.spiderfoot.net/documentation/",
    status: "connected",
    statusLabel: "Connected",
    category: "OSINT Reconnaissance",
    features: ["IP/Domain Enumeration", "Email Harvesting", "Dark Web Scanning", "200+ Modules"],
  },
  {
    name: "OpenCTI",
    description: "Open Cyber Threat Intelligence Platform. Structures, stores, organizes and visualizes technical and non-technical cyber threat intelligence. STIX2 compliant.",
    repo: "https://github.com/OpenCTI-Platform/opencti",
    docs: "https://docs.opencti.io/latest/",
    status: "active",
    statusLabel: "Active Feed",
    category: "Threat Intelligence Platform",
    features: ["STIX2 Ingestion", "Knowledge Graph", "APT Tracking", "Connector Ecosystem"],
  },
  {
    name: "Raven",
    description: "Real-time cyber threat map visualization tool. Displays attack origins, targets, and threat types on a global map with animated attack paths.",
    repo: "https://github.com/qeeqbox/raven",
    docs: "https://github.com/qeeqbox/raven#readme",
    status: "active",
    statusLabel: "Active",
    category: "Cyber Threat Map",
    features: ["Real-time Visualization", "Attack Path Animation", "Geo IP Mapping", "Honeypot Integration"],
  },
  {
    name: "Global Threat Map",
    description: "Security threat visualization platform providing real-time global cyber attack mapping with interactive geospatial intelligence overlays.",
    repo: "https://github.com/Cybersight-Security/Global-Threat-Map",
    docs: "https://github.com/Cybersight-Security/Global-Threat-Map#readme",
    status: "monitoring",
    statusLabel: "Monitoring",
    category: "Attack Visualization",
    features: ["Heatmap Overlays", "Country Statistics", "Threat Clustering", "Real-time Updates"],
  },
  {
    name: "Threat Intelligence MCP",
    description: "Model Context Protocol server for aggregating threat intelligence from multiple feeds. Supports AbuseIPDB, Shodan, VirusTotal, and more.",
    repo: "https://github.com/marc-shade/threat-intel-mcp",
    docs: "https://github.com/marc-shade/threat-intel-mcp#readme",
    status: "connected",
    statusLabel: "Connected",
    category: "MCP-Based Threat Feeds",
    features: ["Multi-Feed Aggregation", "AbuseIPDB", "Shodan Integration", "VirusTotal Queries"],
  },
];

const STATUS_STYLES: Record<string, string> = {
  connected: "bg-green-500/15 text-green-400 border-green-500/30",
  active: "bg-primary/15 text-primary border-primary/30",
  monitoring: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

export function IntelEnginesPanel() {
  return (
    <div className="h-full flex flex-col" style={{ background: "hsl(var(--background))" }}>
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border">
        <Github className="h-4 w-4 text-foreground" />
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-foreground">Integrated Intelligence Engines</span>
        <span className="text-[8px] font-mono text-muted-foreground ml-auto">{ENGINES.length} engines</span>
      </div>

      {/* Summary bar */}
      <div className="px-4 py-2 border-b border-border bg-card/30 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="h-3 w-3 text-green-400" />
          <span className="text-[9px] font-mono text-muted-foreground">
            <span className="text-green-400 font-bold">{ENGINES.filter(e => e.status === "connected").length}</span> Connected
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-primary" />
          <span className="text-[9px] font-mono text-muted-foreground">
            <span className="text-primary font-bold">{ENGINES.filter(e => e.status === "active").length}</span> Active Feeds
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
          <span className="text-[9px] font-mono text-muted-foreground">
            <span className="text-yellow-400 font-bold">{ENGINES.filter(e => e.status === "monitoring").length}</span> Monitoring
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {ENGINES.map(engine => (
            <div key={engine.name} className="p-4 rounded border border-border bg-card/50 hover:bg-card/80 transition-all">
              <div className="flex items-center gap-3 mb-2">
                <div className="h-8 w-8 rounded bg-muted/30 border border-border flex items-center justify-center">
                  <Github className="h-4 w-4 text-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-foreground">{engine.name}</span>
                    <span className={`text-[7px] px-1.5 py-0.5 rounded border font-mono uppercase font-bold ${STATUS_STYLES[engine.status]}`}>
                      <span className="inline-block h-1.5 w-1.5 rounded-full mr-1" style={{ background: engine.status === "connected" ? "hsl(145 70% 50%)" : engine.status === "active" ? "hsl(190 100% 50%)" : "hsl(45 90% 50%)" }} />
                      {engine.statusLabel}
                    </span>
                  </div>
                  <span className="text-[8px] font-mono text-muted-foreground">{engine.category}</span>
                </div>
              </div>

              <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">{engine.description}</p>

              <div className="flex gap-1 flex-wrap mb-3">
                {engine.features.map((f, i) => (
                  <span key={i} className="text-[7px] px-1.5 py-0.5 rounded bg-muted/30 border border-border text-muted-foreground font-mono">{f}</span>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={engine.repo}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[9px] px-2.5 py-1 rounded border border-border hover:border-primary/50 text-muted-foreground hover:text-primary transition-colors font-mono"
                >
                  <Github className="h-3 w-3" />
                  Repository
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
                <a
                  href={engine.docs}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[9px] px-2.5 py-1 rounded border border-border hover:border-primary/50 text-muted-foreground hover:text-primary transition-colors font-mono"
                >
                  Documentation
                  <ExternalLink className="h-2.5 w-2.5" />
                </a>
              </div>
            </div>
          ))}

          {/* OSINT Data Sources */}
          <div className="p-3 rounded border border-primary/20 bg-primary/5 mt-4">
            <div className="text-[9px] font-mono text-primary uppercase tracking-wider mb-2">Connected OSINT Data Sources</div>
            <div className="grid grid-cols-2 gap-1.5">
              {["AbuseIPDB", "AlienVault OTX", "Shodan", "VirusTotal", "MalwareBazaar", "Censys", "GreyNoise", "FireHOL", "CISA KEV", "NIST NVD", "ThreatFox", "Feodo Tracker"].map(source => (
                <div key={source} className="flex items-center gap-1.5 text-[8px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  <span className="text-muted-foreground font-mono">{source}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
