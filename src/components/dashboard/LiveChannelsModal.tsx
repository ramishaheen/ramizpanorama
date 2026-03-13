import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X, Plus, Trash2, RefreshCw, Play, ExternalLink, Youtube,
  Radio, WifiOff, Edit2, Check, AlertTriangle, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const FN_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/youtube-channels`;

interface YTChannel {
  id: string;
  name: string;
  source_type: string;
  original_url: string;
  youtube_video_id: string | null;
  youtube_channel_id: string | null;
  embed_url: string | null;
  status: string;
  is_live: boolean;
  thumbnail_url: string | null;
  country: string;
  category: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  onClose: () => void;
}

const CATEGORIES = ["public", "news", "weather", "traffic", "military", "ports", "tourism"];

// ═══════════════ YOUTUBE URL VALIDATOR ═══════════════
function isValidYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/.+/i.test(url.trim());
}

// ═══════════════ YOUTUBE PLAYER ═══════════════
function YouTubePlayer({ videoId, channel }: { videoId: string; channel: YTChannel }) {
  const embedParams = new URLSearchParams({
    autoplay: "1",
    mute: "1",
    playsinline: "1",
    rel: "0",
    modestbranding: "1",
    enablejsapi: "1",
    origin: window.location.origin,
    widget_referrer: window.location.href,
  });

  const embedSrc = `https://www.youtube.com/embed/${videoId}?${embedParams.toString()}`;

  return (
    <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", background: "#000", borderRadius: 8, overflow: "hidden" }}>
      <iframe
        key={videoId}
        src={embedSrc}
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        title={channel.name}
      />
    </div>
  );
}

// ═══════════════ OFFLINE STATE ═══════════════
function OfflineState({ channel }: { channel: YTChannel }) {
  return (
    <div style={{
      width: "100%", paddingBottom: "56.25%", position: "relative",
      background: "linear-gradient(135deg, rgba(15,20,30,0.95), rgba(25,30,45,0.95))",
      borderRadius: 8, overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 12,
      }}>
        <WifiOff style={{ width: 48, height: 48, color: "hsl(var(--muted-foreground))", opacity: 0.5 }} />
        <span style={{ color: "hsl(var(--muted-foreground))", fontSize: 14, fontWeight: 600 }}>Channel is currently offline</span>
        <span style={{ color: "hsl(var(--muted-foreground))", fontSize: 11, opacity: 0.7 }}>{channel.name}</span>
      </div>
    </div>
  );
}

// ═══════════════ ADD FORM ═══════════════
function AddChannelForm({ onAdd, onCancel }: { onAdd: (data: any) => void; onCancel: () => void }) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [category, setCategory] = useState("public");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!url.trim()) { setError("URL is required"); return; }
    if (!isValidYouTubeUrl(url)) { setError("Only valid YouTube URLs are accepted"); return; }
    setError("");
    onAdd({ url: url.trim(), name: name.trim() || "YouTube Channel", country, category });
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: 6,
    background: "hsl(var(--background))", border: "1px solid hsl(var(--border))",
    color: "hsl(var(--foreground))", fontSize: 13, outline: "none",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: 16, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "hsl(var(--foreground))" }}>Add YouTube Live Channel</div>
      <input style={inputStyle} placeholder="YouTube URL (watch, live, channel, embed)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <input style={inputStyle} placeholder="Channel name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
      <div style={{ display: "flex", gap: 8 }}>
        <input style={{ ...inputStyle, flex: 1 }} placeholder="Country" value={country} onChange={(e) => setCountry(e.target.value)} />
        <select style={{ ...inputStyle, flex: 1 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      {error && <div style={{ color: "hsl(var(--destructive))", fontSize: 11 }}><AlertTriangle style={{ width: 12, height: 12, display: "inline", marginRight: 4 }} />{error}</div>}
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid hsl(var(--border))", background: "transparent", color: "hsl(var(--muted-foreground))", fontSize: 12, cursor: "pointer" }}>Cancel</button>
        <button onClick={handleSubmit} style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add Channel</button>
      </div>
    </div>
  );
}

// ═══════════════ MAIN MODAL ═══════════════
export function LiveChannelsModal({ onClose }: Props) {
  const [channels, setChannels] = useState<YTChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [activeChannel, setActiveChannel] = useState<YTChannel | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const fetchChannels = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("youtube_channels").select("*").order("created_at", { ascending: false });
      setChannels((data as any[]) || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchChannels(); }, [fetchChannels]);

  const addChannel = async (formData: any) => {
    try {
      const res = await fetch(`${FN_URL}?action=add`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify(formData),
      });
      const json = await res.json();
      if (json.error) { toast.error(json.error); return; }
      toast.success("Channel added");
      setShowAdd(false);
      fetchChannels();
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteChannel = async (id: string) => {
    try {
      await fetch(`${FN_URL}?action=delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ id }),
      });
      toast.success("Channel removed");
      if (activeChannel?.id === id) setActiveChannel(null);
      fetchChannels();
    } catch (e: any) { toast.error(e.message); }
  };

  const refreshChannel = async (id: string) => {
    setRefreshing(id);
    try {
      await fetch(`${FN_URL}?action=refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ id }),
      });
      fetchChannels();
    } catch (e: any) { toast.error(e.message); }
    setRefreshing(null);
  };

  const overlay = createPortal(
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(95vw, 900px)", maxHeight: "90vh",
          background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
          borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column",
          margin: "0 auto",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid hsl(var(--border))",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Youtube style={{ width: 20, height: 20, color: "#ef4444" }} />
            <span style={{ fontSize: 16, fontWeight: 700, color: "hsl(var(--foreground))" }}>Live Channels</span>
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 10,
              background: "hsl(var(--primary) / 0.15)", color: "hsl(var(--primary))", fontWeight: 600,
            }}>
              {channels.length}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={() => setShowAdd(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 14px",
                borderRadius: 6, border: "none", background: "hsl(var(--primary))",
                color: "hsl(var(--primary-foreground))", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Plus style={{ width: 14, height: 14 }} /> Add Channel
            </button>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "hsl(var(--muted-foreground))", cursor: "pointer", padding: 4 }}>
              <X style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Player area */}
          {activeChannel && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "hsl(var(--foreground))" }}>{activeChannel.name}</span>
                <button onClick={() => setActiveChannel(null)} style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 4, border: "1px solid hsl(var(--border))",
                  background: "transparent", color: "hsl(var(--muted-foreground))", cursor: "pointer",
                }}>Close Player</button>
              </div>
              {activeChannel.youtube_video_id ? (
                <YouTubePlayer videoId={activeChannel.youtube_video_id} channel={activeChannel} />
              ) : (
                <OfflineState channel={activeChannel} />
              )}
            </div>
          )}

          {/* Add form */}
          {showAdd && <AddChannelForm onAdd={addChannel} onCancel={() => setShowAdd(false)} />}

          {/* Channel list */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "hsl(var(--muted-foreground))", fontSize: 13 }}>Loading channels...</div>
          ) : channels.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "hsl(var(--muted-foreground))", fontSize: 13 }}>
              No channels added yet. Click "Add Channel" to get started.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {channels.map((ch) => (
                <div
                  key={ch.id}
                  style={{
                    borderRadius: 8, border: `1px solid ${activeChannel?.id === ch.id ? "hsl(var(--primary))" : "hsl(var(--border))"}`,
                    background: activeChannel?.id === ch.id ? "hsl(var(--primary) / 0.05)" : "hsl(var(--card))",
                    overflow: "hidden", cursor: "pointer", transition: "all 0.2s",
                  }}
                  onClick={() => setActiveChannel(ch)}
                >
                  {/* Thumbnail */}
                  <div style={{ position: "relative", width: "100%", paddingBottom: "56.25%", background: "#111" }}>
                    {ch.thumbnail_url ? (
                      <img src={ch.thumbnail_url} alt={ch.name} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Youtube style={{ width: 32, height: 32, color: "hsl(var(--muted-foreground))", opacity: 0.3 }} />
                      </div>
                    )}
                    {/* Status badge */}
                    <div style={{
                      position: "absolute", top: 6, right: 6, display: "flex", alignItems: "center", gap: 4,
                      padding: "2px 8px", borderRadius: 4, fontSize: 9, fontWeight: 700,
                      background: ch.is_live ? "rgba(34,197,94,0.9)" : "rgba(107,114,128,0.9)",
                      color: "#fff",
                    }}>
                      {ch.is_live ? <><Radio style={{ width: 10, height: 10 }} /> LIVE</> : "OFFLINE"}
                    </div>
                    {/* Play overlay */}
                    <div style={{
                      position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(0,0,0,0.3)", opacity: 0, transition: "opacity 0.2s",
                    }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0")}
                    >
                      <Play style={{ width: 36, height: 36, color: "#fff" }} />
                    </div>
                  </div>
                  {/* Info */}
                  <div style={{ padding: "8px 10px" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "hsl(var(--foreground))", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {ch.name}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                      <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>
                        {ch.country || "—"} · {ch.category}
                      </span>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); refreshChannel(ch.id); }}
                          style={{ background: "none", border: "none", color: "hsl(var(--primary))", cursor: "pointer", padding: 2 }}
                          title="Refresh"
                        >
                          <RefreshCw style={{ width: 12, height: 12, animation: refreshing === ch.id ? "spin 1s linear infinite" : "none" }} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); window.open(ch.original_url, "_blank"); }}
                          style={{ background: "none", border: "none", color: "hsl(var(--muted-foreground))", cursor: "pointer", padding: 2 }}
                          title="Open on YouTube"
                        >
                          <ExternalLink style={{ width: 12, height: 12 }} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteChannel(ch.id); }}
                          style={{ background: "none", border: "none", color: "hsl(var(--destructive))", cursor: "pointer", padding: 2 }}
                          title="Delete"
                        >
                          <Trash2 style={{ width: 12, height: 12 }} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );

  return overlay;
}
