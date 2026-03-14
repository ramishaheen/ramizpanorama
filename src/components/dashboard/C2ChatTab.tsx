import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { Send, Bot, User, Loader2, Trash2, Shield, Copy, Check, X, Maximize2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/c2-assistant`;

async function streamC2({ messages, onDelta, onDone, onError }: {
  messages: Message[]; onDelta: (text: string) => void; onDone: () => void; onError: (err: string) => void;
}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ messages: messages.map(m => ({ role: m.role, content: m.content })) }),
    });
    if (!resp.ok) { const d = await resp.json().catch(() => ({})); onError(d.error || `Error ${resp.status}`); return; }
    if (!resp.body) { onError("No response body"); return; }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || !line.trim() || !line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") break;
        try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) onDelta(c); }
        catch { buffer = line + "\n" + buffer; break; }
      }
    }
    if (buffer.trim()) {
      for (const raw of buffer.split("\n")) {
        if (!raw?.startsWith("data: ")) continue;
        const json = raw.slice(6).trim();
        if (json === "[DONE]") continue;
        try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) onDelta(c); } catch {}
      }
    }
    onDone();
  } catch (e) { onError(e instanceof Error ? e.message : "Connection failed"); }
}

// Detect intel report type from content
function detectReportType(content: string): { type: string; color: string; icon: string } | null {
  const lower = content.toLowerCase();
  if (lower.includes("battle damage assessment") || lower.includes("bda")) return { type: "BDA REPORT", color: "#a855f7", icon: "📋" };
  if (lower.includes("sitrep") || lower.includes("situation report") || lower.includes("situational")) return { type: "SITREP", color: "#00d4ff", icon: "📡" };
  if (lower.includes("course of action") || lower.includes("coa")) return { type: "COA ANALYSIS", color: "#22c55e", icon: "🗺" };
  if (lower.includes("threat assessment") || lower.includes("threat analysis")) return { type: "THREAT ASSESSMENT", color: "#ef4444", icon: "⚠️" };
  if (lower.includes("target") && (lower.includes("priorit") || lower.includes("ranking"))) return { type: "TARGET PRIORITY", color: "#f97316", icon: "🎯" };
  return null;
}

// Extract actionable suggestions from content
function extractSuggestions(content: string): string[] {
  const suggestions: string[] = [];
  const lower = content.toLowerCase();
  // Look for mentioned targets
  const trkMatches = content.match(/TRK-\d+/gi);
  if (trkMatches) {
    const unique = [...new Set(trkMatches)];
    unique.slice(0, 2).forEach(trk => suggestions.push(`Generate BDA for ${trk}`));
  }
  // Context-based suggestions
  if (lower.includes("sitrep") || lower.includes("overview")) {
    suggestions.push("Prioritize all critical targets");
    suggestions.push("Recommend COA for neutralization");
  }
  if (lower.includes("bda") || lower.includes("damage")) {
    suggestions.push("Re-strike recommendation");
    suggestions.push("Update target status");
  }
  if (lower.includes("threat") || lower.includes("hostile")) {
    suggestions.push("Asset allocation for threats");
    suggestions.push("ROE status for engagement");
  }
  if (lower.includes("coa") || lower.includes("course of action")) {
    suggestions.push("Risk assessment for selected COA");
    suggestions.push("Resource requirements analysis");
  }
  return suggestions.slice(0, 4);
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="p-0.5 rounded hover:bg-muted/50 transition-colors" title="Copy">
      {copied ? <Check className="h-2.5 w-2.5 text-[#22c55e]" /> : <Copy className="h-2.5 w-2.5 text-muted-foreground hover:text-foreground" />}
    </button>
  );
};

const IntelMessage = ({ content }: { content: string }) => {
  const report = detectReportType(content);
  return (
    <div>
      {report && (
        <div className="flex items-center gap-1.5 mb-1.5 pb-1 border-b" style={{ borderColor: `${report.color}30` }}>
          <span className="text-[10px]">{report.icon}</span>
          <span className="text-[8px] font-mono font-bold tracking-[0.1em]" style={{ color: report.color }}>{report.type}</span>
        </div>
      )}
      <div className="prose prose-sm prose-invert max-w-none text-[10px] leading-relaxed
        [&_p]:mb-1.5 [&_li]:mb-0.5
        [&_h1]:text-[11px] [&_h1]:font-bold [&_h1]:text-foreground [&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:border-b [&_h1]:border-[hsl(220,15%,20%)] [&_h1]:pb-0.5
        [&_h2]:text-[10px] [&_h2]:font-bold [&_h2]:text-primary [&_h2]:mb-1 [&_h2]:mt-1.5
        [&_h3]:text-[10px] [&_h3]:font-bold [&_h3]:text-foreground/80 [&_h3]:mb-0.5
        [&_ul]:pl-3 [&_ol]:pl-3
        [&_strong]:text-foreground
        [&_code]:text-[9px] [&_code]:bg-muted/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded
        [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-2 [&_blockquote]:text-muted-foreground [&_blockquote]:italic">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
};

export const C2ChatTab = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [contextSuggestions, setContextSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Update suggestions after assistant response
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find(m => m.role === "assistant");
    if (lastAssistant && !isLoading) {
      setContextSuggestions(extractSuggestions(lastAssistant.content));
    }
  }, [messages, isLoading]);

  const send = useCallback(async (overrideText?: string) => {
    const text = (overrideText || input).trim();
    if (!text || isLoading) return;
    const userMsg: Message = { role: "user", content: text, timestamp: Date.now() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setContextSuggestions([]);
    setIsLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        return [...prev, { role: "assistant", content: assistantSoFar, timestamp: Date.now() }];
      });
    };

    await streamC2({
      messages: updated,
      onDelta: upsert,
      onDone: () => setIsLoading(false),
      onError: (err) => { upsert(`\n\n⚠️ Error: ${err}`); setIsLoading(false); },
    });
  }, [input, isLoading, messages]);

  const quickPrompts = [
    "SITREP: Current battlespace overview",
    "Prioritize all critical targets",
    "Generate BDA for TRK-002",
    "Recommend COA for S-300 neutralization",
    "Threat assessment: Strait of Hormuz",
  ];

  const formatTime = (ts?: number) => ts ? new Date(ts).toISOString().slice(11, 19) + " UTC" : "";

  return (
    <div className="flex flex-col h-full min-h-0">
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-thin px-2 py-2 space-y-2">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-4">
            <div className="h-10 w-10 rounded-full bg-[#f97316]/10 flex items-center justify-center">
              <Shield className="h-5 w-5 text-[#f97316]" />
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold text-foreground">AEGIS • C2 ASSISTANT</p>
              <p className="text-[8px] text-muted-foreground mt-1 max-w-[220px]">
                Joint Force C2 analyst. BDA, COA recommendations, threat correlation, mission planning.
              </p>
            </div>
            <div className="flex flex-wrap gap-1 justify-center mt-1">
              {quickPrompts.map(q => (
                <button key={q} onClick={() => send(q)}
                  className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-[hsl(220,15%,18%)] hover:border-[#f97316]/50 hover:bg-[#f97316]/5 text-muted-foreground hover:text-foreground transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            {/* Timestamp header for first message or when gap > 2 min */}
            {(i === 0 || (msg.timestamp && messages[i - 1]?.timestamp && msg.timestamp - messages[i - 1].timestamp! > 120000)) && (
              <div className="flex items-center justify-center my-1">
                <span className="text-[7px] font-mono text-muted-foreground/50 px-2">{formatTime(msg.timestamp)}</span>
              </div>
            )}
            <div className={`flex gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 h-4 w-4 rounded-full bg-[#f97316]/10 flex items-center justify-center mt-0.5">
                  <Bot className="h-2.5 w-2.5 text-[#f97316]" />
                </div>
              )}
              <div className={`max-w-[88%] rounded px-2 py-1.5 ${msg.role === "user" ? "bg-primary/20 text-foreground" : "bg-[hsl(220,15%,8%)] border border-[hsl(220,15%,15%)] text-foreground"}`}>
                {msg.role === "assistant" ? (
                  <div>
                    <IntelMessage content={msg.content} />
                    <div className="flex justify-end mt-1">
                      <CopyButton text={msg.content} />
                    </div>
                  </div>
                ) : <p className="text-[10px] font-mono">{msg.content}</p>}
              </div>
              {msg.role === "user" && (
                <div className="flex-shrink-0 h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                  <User className="h-2.5 w-2.5 text-primary" />
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex items-center gap-1.5">
            <div className="h-4 w-4 rounded-full bg-[#f97316]/10 flex items-center justify-center">
              <Loader2 className="h-2.5 w-2.5 text-[#f97316] animate-spin" />
            </div>
            <span className="text-[8px] text-muted-foreground font-mono animate-pulse">AEGIS analyzing...</span>
          </div>
        )}
      </div>

      {/* Context-aware suggestions */}
      {contextSuggestions.length > 0 && !isLoading && (
        <div className="px-2 py-1 border-t border-[hsl(190,60%,10%)] flex flex-wrap gap-1">
          {contextSuggestions.map(s => (
            <button key={s} onClick={() => send(s)}
              className="text-[7px] font-mono px-1.5 py-0.5 rounded border border-[#f97316]/20 text-[#f97316]/70 hover:text-[#f97316] hover:border-[#f97316]/40 hover:bg-[#f97316]/5 transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="border-t border-[hsl(190,60%,12%)] px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <button onClick={() => { setMessages([]); setContextSuggestions([]); }} className="p-1 rounded hover:bg-muted transition-colors" title="Clear">
            <Trash2 className="h-2.5 w-2.5 text-muted-foreground" />
          </button>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
            placeholder="C2 query..."
            className="flex-1 bg-muted/50 border border-[hsl(220,15%,18%)] rounded px-2 py-1 text-[9px] font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#f97316]/50 transition-colors"
            disabled={isLoading}
          />
          <button onClick={() => send()} disabled={isLoading || !input.trim()} className="p-1 rounded bg-[#f97316]/20 text-[#f97316] hover:bg-[#f97316]/30 disabled:opacity-30 transition-colors">
            <Send className="h-3 w-3" />
          </button>
        </div>
        <p className="text-[7px] text-muted-foreground/50 font-mono mt-0.5 text-center">AEGIS • JADC2 C2 Assistant • SIMULATION ONLY</p>
      </div>
    </div>
  );
};
