import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Server, Wifi, WifiOff, Book, Brain, Map, Shield, Wrench, ExternalLink, Globe, Database } from "lucide-react";

interface NomadModalProps {
  onClose: () => void;
}

const NOMAD_URL_KEY = "nomad-instance-url";

const CAPABILITIES = [
  { icon: Book, label: "Information Library", desc: "Offline Wikipedia, medical references, survival guides, ebooks via Kiwix", color: "text-primary" },
  { icon: Brain, label: "AI Assistant", desc: "Built-in chat with document upload and semantic search via Ollama + Qdrant", color: "text-accent" },
  { icon: Globe, label: "Education Platform", desc: "Khan Academy courses, progress tracking, multi-user support via Kolibri", color: "text-success" },
  { icon: Map, label: "Offline Maps", desc: "Downloadable regional maps with search and navigation via ProtoMaps", color: "text-warning" },
  { icon: Shield, label: "Data Tools", desc: "Encryption, encoding, hashing, and data analysis via CyberChef", color: "text-destructive" },
  { icon: Database, label: "Notes & Storage", desc: "Local note-taking with markdown support via FlatNotes", color: "text-primary" },
];

export function NomadModal({ onClose }: NomadModalProps) {
  const [instanceUrl, setInstanceUrl] = useState(() => localStorage.getItem(NOMAD_URL_KEY) || "");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [inputUrl, setInputUrl] = useState(instanceUrl);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  const handleConnect = () => {
    if (!inputUrl.trim()) return;
    const url = inputUrl.trim().replace(/\/$/, "");
    setConnecting(true);
    localStorage.setItem(NOMAD_URL_KEY, url);
    setInstanceUrl(url);
    setTimeout(() => {
      setConnected(true);
      setConnecting(false);
    }, 1500);
  };

  const handleDisconnect = () => {
    setConnected(false);
    setInstanceUrl("");
    localStorage.removeItem(NOMAD_URL_KEY);
    setInputUrl("");
  };

  return createPortal(
    <div className="fixed inset-0 z-[200000] bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/90 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 border border-primary/40 flex items-center justify-center">
            <Server className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold font-mono tracking-wide text-foreground">
              Project <span className="text-primary">N.O.M.A.D.</span>
            </h1>
            <p className="text-[8px] text-muted-foreground font-mono uppercase tracking-widest">
              Offline Knowledge Platform
            </p>
          </div>
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider ${
            connected
              ? "bg-success/10 text-success border border-success/30"
              : "bg-muted text-muted-foreground border border-border"
          }`}>
            {connected ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
            {connected ? "Connected" : "Offline"}
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Close (Esc)">
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* Body */}
      <div className="flex-1 overflow-hidden">
        {connected && instanceUrl ? (
          /* Embedded Nomad instance */
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between px-3 py-1.5 bg-card border-b border-border">
              <span className="text-[10px] font-mono text-muted-foreground truncate">{instanceUrl}</span>
              <button onClick={handleDisconnect} className="text-[10px] font-mono text-destructive hover:text-destructive/80 px-2 py-0.5 rounded border border-destructive/30 hover:bg-destructive/10 transition-colors">
                Disconnect
              </button>
            </div>
            <iframe
              src={instanceUrl}
              className="flex-1 w-full border-0"
              title="Project Nomad"
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
            />
          </div>
        ) : (
          /* Landing / connection page */
          <div className="h-full overflow-y-auto">
            <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
              {/* Hero */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/30 mx-auto">
                  <Server className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  Project <span className="text-primary">N.O.M.A.D.</span>
                </h2>
                <p className="text-sm text-muted-foreground max-w-lg mx-auto">
                  Network-Optimized Modular Autonomous Datastore — A self-hosted offline knowledge platform 
                  with AI, maps, education, and data tools. Zero telemetry, zero internet required after setup.
                </p>
              </div>

              {/* Capabilities grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {CAPABILITIES.map((cap) => {
                  const Icon = cap.icon;
                  return (
                    <div key={cap.label} className="p-4 rounded-lg border border-border bg-card/50 hover:border-primary/30 transition-colors space-y-2">
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${cap.color}`} />
                        <span className="text-xs font-bold font-mono text-foreground">{cap.label}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{cap.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* Connect form */}
              <div className="p-5 rounded-lg border border-primary/20 bg-primary/5 space-y-4">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold font-mono text-foreground">Connect to Your Instance</h3>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  If you have a self-hosted Project Nomad instance running on your network, enter its URL below to embed it directly.
                </p>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    placeholder="http://192.168.1.100:8080"
                    className="flex-1 px-3 py-2 rounded border border-border bg-background text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60"
                    onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                  />
                  <button
                    onClick={handleConnect}
                    disabled={connecting || !inputUrl.trim()}
                    className="px-4 py-2 rounded bg-primary text-primary-foreground text-xs font-mono font-bold uppercase tracking-wider hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {connecting ? "Connecting…" : "Connect"}
                  </button>
                </div>
              </div>

              {/* GitHub link */}
              <div className="text-center space-y-2">
                <p className="text-[11px] text-muted-foreground">Don't have an instance yet?</p>
                <a
                  href="https://github.com/Crosstalk-Solutions/project-nomad"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded border border-border hover:border-primary/40 text-sm font-mono text-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  View on GitHub
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
