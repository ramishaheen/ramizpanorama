import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2, Trash2, Shield } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/c2-assistant`;

async function streamC2({
  messages,
  onDelta,
  onDone,
  onError,
}: {
  messages: Message[];
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (err: string) => void;
}) {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages }),
    });

    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      onError(data.error || `Error ${resp.status}`);
      return;
    }
    if (!resp.body) { onError("No response body"); return; }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

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
          if (content) onDelta(content);
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }

    if (buffer.trim()) {
      for (let raw of buffer.split("\n")) {
        if (!raw || !raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch { /* ignore */ }
      }
    }
    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Connection failed");
  }
}

export const C2ChatTab = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    const userMsg: Message = { role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        return [...prev, { role: "assistant", content: assistantSoFar }];
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

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
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
                <button key={q} onClick={() => setInput(q)}
                  className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-[hsl(220,15%,18%)] hover:border-[#f97316]/50 hover:bg-[#f97316]/5 text-muted-foreground hover:text-foreground transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="flex-shrink-0 h-4 w-4 rounded-full bg-[#f97316]/10 flex items-center justify-center mt-0.5">
                <Bot className="h-2.5 w-2.5 text-[#f97316]" />
              </div>
            )}
            <div className={`max-w-[85%] rounded px-2 py-1.5 text-[9px] ${msg.role === "user" ? "bg-primary/20 text-foreground" : "bg-muted/50 text-foreground"}`}>
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none text-[9px] [&_p]:mb-1 [&_li]:mb-0.5 [&_h1]:text-xs [&_h2]:text-[10px] [&_h3]:text-[10px] [&_ul]:pl-3 [&_ol]:pl-3">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : <p>{msg.content}</p>}
            </div>
            {msg.role === "user" && (
              <div className="flex-shrink-0 h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center mt-0.5">
                <User className="h-2.5 w-2.5 text-primary" />
              </div>
            )}
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

      <div className="border-t border-[hsl(190,60%,12%)] px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setMessages([])} className="p-1 rounded hover:bg-muted transition-colors" title="Clear">
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
          <button onClick={send} disabled={isLoading || !input.trim()} className="p-1 rounded bg-[#f97316]/20 text-[#f97316] hover:bg-[#f97316]/30 disabled:opacity-30 transition-colors">
            <Send className="h-3 w-3" />
          </button>
        </div>
        <p className="text-[7px] text-muted-foreground/50 font-mono mt-0.5 text-center">AEGIS • JADC2 C2 Assistant • SIMULATION ONLY</p>
      </div>
    </div>
  );
};
