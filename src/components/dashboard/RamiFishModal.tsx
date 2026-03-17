import { useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Brain, Zap, Upload, Play, RotateCcw, Users, FileText } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
}

type Phase = "input" | "running" | "complete";

const EXAMPLE_SEEDS = [
  { label: "Iran–Israel Escalation", text: "Recent intelligence indicates increased Iranian missile production, IRGC naval exercises in the Strait of Hormuz, and Israeli Air Force deployment to forward bases. Diplomatic channels have gone silent after the collapse of Vienna talks." },
  { label: "Taiwan Strait Crisis", text: "PLA amphibious exercises detected near Fujian province. US carrier group repositioning from Japan. Taiwan activating reserve forces. Semiconductor supply chain showing early disruption signals." },
  { label: "Oil Supply Shock", text: "Houthi attacks on Red Sea shipping intensifying. Saudi Aramco reports pipeline sabotage attempt. Strategic petroleum reserves at 10-year low. OPEC+ emergency meeting scheduled." },
];

export default function RamiFishModal({ open, onClose }: Props) {
  const [phase, setPhase] = useState<Phase>("input");
  const [seedText, setSeedText] = useState("");
  const [question, setQuestion] = useState("");
  const [agentCount, setAgentCount] = useState(6);
  const [rounds, setRounds] = useState(5);
  const [output, setOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const handleRun = useCallback(async () => {
    if (!seedText.trim() || !question.trim()) {
      toast.error("Provide seed intelligence and a prediction question");
      return;
    }

    setPhase("running");
    setOutput("");
    setIsStreaming(true);
    abortRef.current = new AbortController();

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ramifish-simulate`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ seedText, question, agentCount, rounds }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${resp.status}`);
      }

      if (!resp.body) throw new Error("No stream body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              setOutput(accumulated);
              if (outputRef.current) {
                outputRef.current.scrollTop = outputRef.current.scrollHeight;
              }
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      setPhase("complete");
    } catch (e: any) {
      if (e.name === "AbortError") {
        toast.info("Simulation cancelled");
      } else {
        toast.error(e.message || "Simulation failed");
      }
      if (!output) setPhase("input");
      else setPhase("complete");
    } finally {
      setIsStreaming(false);
    }
  }, [seedText, question, agentCount, rounds, output]);

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleReset = () => {
    abortRef.current?.abort();
    setPhase("input");
    setOutput("");
    setSeedText("");
    setQuestion("");
  };

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 flex flex-col bg-background text-foreground" style={{ zIndex: 100000 }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-[hsl(220,30%,6%)]">
        <div className="flex items-center gap-3">
          <Brain className="w-5 h-5 text-primary" />
          <span className="font-mono text-xs font-bold tracking-[0.15em] text-primary uppercase">
            RamiFish — Swarm Intelligence Prediction Engine
          </span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded hover:bg-muted transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel — Config */}
        <div className="w-[380px] border-r border-border bg-[hsl(220,30%,5%)] flex flex-col overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Seed Intel */}
            <div>
              <label className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[hsl(190,60%,40%)] uppercase mb-2 block">
                <FileText className="w-3 h-3 inline mr-1.5" />Seed Intelligence
              </label>
              <textarea
                value={seedText}
                onChange={e => setSeedText(e.target.value)}
                placeholder="Paste intelligence reports, news articles, signals data, or any seed material for the simulation…"
                className="w-full h-36 bg-[hsl(220,30%,8%)] border border-border rounded-sm px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary"
                disabled={isStreaming}
              />
            </div>

            {/* Quick Seeds */}
            <div>
              <label className="font-mono text-[9px] font-semibold tracking-[0.1em] text-muted-foreground uppercase mb-1.5 block">
                Quick Scenarios
              </label>
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_SEEDS.map(s => (
                  <button
                    key={s.label}
                    onClick={() => { setSeedText(s.text); setQuestion(`What are the most likely outcomes in the next 30 days?`); }}
                    disabled={isStreaming}
                    className="px-2 py-1 text-[9px] font-mono bg-[hsl(220,30%,10%)] border border-border rounded-sm hover:border-primary hover:text-primary transition-colors disabled:opacity-50"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Question */}
            <div>
              <label className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[hsl(190,60%,40%)] uppercase mb-2 block">
                <Zap className="w-3 h-3 inline mr-1.5" />Prediction Question
              </label>
              <textarea
                value={question}
                onChange={e => setQuestion(e.target.value)}
                placeholder="What do you want the swarm to predict? e.g. 'What are the most likely escalation scenarios in the next 30 days?'"
                className="w-full h-20 bg-[hsl(220,30%,8%)] border border-border rounded-sm px-3 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary"
                disabled={isStreaming}
              />
            </div>

            {/* Agent Config */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-mono text-[9px] font-semibold tracking-[0.1em] text-muted-foreground uppercase mb-1.5 block">
                  <Users className="w-3 h-3 inline mr-1" />Agents
                </label>
                <select
                  value={agentCount}
                  onChange={e => setAgentCount(Number(e.target.value))}
                  disabled={isStreaming}
                  className="w-full bg-[hsl(220,30%,8%)] border border-border rounded-sm px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                >
                  {[4, 6, 8, 10].map(n => <option key={n} value={n}>{n} agents</option>)}
                </select>
              </div>
              <div>
                <label className="font-mono text-[9px] font-semibold tracking-[0.1em] text-muted-foreground uppercase mb-1.5 block">
                  <RotateCcw className="w-3 h-3 inline mr-1" />Rounds
                </label>
                <select
                  value={rounds}
                  onChange={e => setRounds(Number(e.target.value))}
                  disabled={isStreaming}
                  className="w-full bg-[hsl(220,30%,8%)] border border-border rounded-sm px-2 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                >
                  {[3, 5, 7, 10].map(n => <option key={n} value={n}>{n} rounds</option>)}
                </select>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              {isStreaming ? (
                <button
                  onClick={handleStop}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-destructive text-destructive-foreground rounded-sm font-mono text-[10px] font-bold tracking-[0.1em] uppercase hover:opacity-90 transition-opacity"
                >
                  <X className="w-3 h-3" /> ABORT SIMULATION
                </button>
              ) : (
                <>
                  <button
                    onClick={handleRun}
                    disabled={!seedText.trim() || !question.trim()}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-sm font-mono text-[10px] font-bold tracking-[0.1em] uppercase hover:opacity-90 transition-opacity disabled:opacity-40"
                  >
                    <Play className="w-3 h-3" /> {phase === "complete" ? "RE-RUN" : "LAUNCH SWARM"}
                  </button>
                  {phase === "complete" && (
                    <button
                      onClick={handleReset}
                      className="px-3 py-2.5 bg-muted text-muted-foreground rounded-sm font-mono text-[10px] font-bold tracking-[0.1em] uppercase hover:opacity-90 transition-opacity"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Status bar */}
          <div className="mt-auto p-3 border-t border-border">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isStreaming ? "bg-primary animate-pulse" : phase === "complete" ? "bg-[hsl(142,70%,45%)]" : "bg-muted-foreground/50"}`} />
              <span className="font-mono text-[9px] text-muted-foreground uppercase">
                {isStreaming ? "Agents debating…" : phase === "complete" ? "Simulation complete" : "Awaiting seed data"}
              </span>
            </div>
          </div>
        </div>

        {/* Right Panel — Output */}
        <div className="flex-1 flex flex-col bg-[hsl(220,30%,4%)]">
          {/* Output header */}
          <div className="px-4 py-2 border-b border-border flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-[hsl(190,60%,40%)] uppercase">
              Simulation Output
            </span>
            {isStreaming && (
              <span className="font-mono text-[9px] text-primary animate-pulse">● STREAMING</span>
            )}
          </div>

          {/* Output content */}
          <div ref={outputRef} className="flex-1 overflow-y-auto p-5">
            {!output && phase === "input" ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Brain className="w-16 h-16 text-muted-foreground/20 mb-4" />
                <div className="font-mono text-sm text-muted-foreground/50 max-w-md">
                  Provide seed intelligence and a prediction question, then launch the swarm to begin multi-agent simulation.
                </div>
                <div className="mt-6 grid grid-cols-3 gap-4 text-center max-w-lg">
                  {[
                    { icon: "📡", label: "Feed Intel", desc: "Paste reports, news, signals" },
                    { icon: "🧠", label: "AI Agents Debate", desc: "Multi-perspective analysis" },
                    { icon: "📊", label: "Predict", desc: "Consensus prediction report" },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-sm border border-border/50 bg-[hsl(220,30%,6%)]">
                      <div className="text-2xl mb-2">{s.icon}</div>
                      <div className="font-mono text-[10px] font-bold text-primary">{s.label}</div>
                      <div className="font-mono text-[8px] text-muted-foreground mt-1">{s.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
                {output}
                {isStreaming && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Corner brackets */}
      <div className="absolute inset-0 pointer-events-none z-[1]">
        <div className="absolute top-0 left-0 w-10 h-10 border-l-2 border-t-2 border-primary/40" />
        <div className="absolute top-0 right-0 w-10 h-10 border-r-2 border-t-2 border-primary/40" />
        <div className="absolute bottom-0 left-0 w-10 h-10 border-l-2 border-b-2 border-primary/40" />
        <div className="absolute bottom-0 right-0 w-10 h-10 border-r-2 border-b-2 border-primary/40" />
      </div>
    </div>,
    document.body
  );
}
