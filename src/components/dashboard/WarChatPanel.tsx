import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Send, Bot, User, Loader2, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/war-chat`;

async function streamChat({
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

    if (!resp.body) {
      onError("No response body");
      return;
    }

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

    // Flush remaining
    if (buffer.trim()) {
      for (let raw of buffer.split("\n")) {
        if (!raw || !raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {}
      }
    }

    onDone();
  } catch (e) {
    onError(e instanceof Error ? e.message : "Connection failed");
  }
}

interface WarChatPanelProps {
  open: boolean;
  onClose: () => void;
}

export const WarChatPanel = ({ open, onClose }: WarChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const userMsg: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    await streamChat({
      messages: updatedMessages,
      onDelta: upsert,
      onDone: () => setIsLoading(false),
      onError: (err) => {
        upsert(`\n\n⚠️ Error: ${err}`);
        setIsLoading(false);
      },
    });
  }, [input, isLoading, messages]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, x: -320, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: -320, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed top-12 left-2 z-[9999] w-[380px] h-[calc(100vh-64px)] max-h-[700px] flex flex-col bg-card border border-border rounded-lg shadow-2xl overflow-hidden"
        >
          {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/90">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-primary" />
                <span className="text-xs font-mono font-bold text-foreground tracking-wide">WarOS-RamiZPanorma</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-critical/20 text-critical font-mono uppercase">Agent</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMessages([])}
                className="p-1 rounded hover:bg-muted transition-colors"
                title="Clear chat"
              >
                <Trash2 className="h-3 w-3 text-muted-foreground" />
              </button>
              <button
                onClick={onClose}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-8">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-mono font-bold text-foreground">WarOS-RamiZPanorma</p>
                  <p className="text-[10px] text-muted-foreground mt-1 max-w-[260px]">
                    I can analyze live dashboard data, calculate war costs by country/sector/scenario, and answer any question about the conflict.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                  {[
                    "Show current system status & alerts",
                    "Calculate total war cost for all countries",
                    "Israel vs Iran cost breakdown (3 scenarios)",
                    "What's the economic impact on Arab countries?",
                    "Red Sea shipping disruption cost analysis",
                    "Defense spending: Iron Dome vs Arrow costs",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); }}
                      className="text-[9px] font-mono px-2 py-1 rounded border border-border hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-xs ${
                    msg.role === "user"
                      ? "bg-primary/20 text-foreground"
                      : "bg-muted/50 text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none text-xs [&_p]:mb-1.5 [&_li]:mb-0.5 [&_h1]:text-sm [&_h2]:text-xs [&_h3]:text-xs [&_ul]:pl-4 [&_ol]:pl-4">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>{msg.content}</p>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 h-5 w-5 rounded-full bg-accent/20 flex items-center justify-center mt-0.5">
                    <User className="h-3 w-3 text-accent" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-3 w-3 text-primary animate-spin" />
                </div>
                <span className="text-[10px] text-muted-foreground font-mono animate-pulse">Analyzing...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border px-3 py-2 bg-card/90">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                placeholder="Ask about the conflict..."
                className="flex-1 bg-muted/50 border border-border rounded px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                disabled={isLoading}
              />
              <button
                onClick={send}
                disabled={isLoading || !input.trim()}
                className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30 disabled:opacity-30 transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[8px] text-muted-foreground/50 font-mono mt-1 text-center">
              WarOS-RamiZPanorma • Live dashboard agent • OSINT only
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
