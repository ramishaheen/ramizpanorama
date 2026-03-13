import { useState } from "react";
import { useSensorFeeds, SensorFeed } from "@/hooks/useSensorFeeds";
import { supabase } from "@/integrations/supabase/client";
import { Wifi, WifiOff, Radio, Satellite, Eye, Activity, Plus, Search, RefreshCw, Link2, Globe } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const PROTOCOL_ICONS: Record<string, typeof Wifi> = {
  mavlink: Radio,
  stanag_4586: Radio,
  rtsp: Eye,
  srt: Eye,
  stac_api: Satellite,
  ais_nmea: Activity,
  api_rest: Wifi,
  api_ws: Wifi,
  hls_stream: Eye,
  mqtt: Activity,
  webhook: Globe,
  manual: Link2,
};

const FEED_TYPES = [
  "satellite_eo", "satellite_sar", "satellite_ir",
  "drone_fmv", "drone_lidar",
  "cctv",
  "sigint_rf", "sigint_comint", "sigint_elint",
  "osint_social", "osint_news", "osint_adsb", "osint_ais",
  "ground_radar", "ground_acoustic",
  "iot_scada", "iot_edge",
];

const PROTOCOLS = ["api_rest", "api_ws", "hls_stream", "rtsp", "mqtt", "webhook", "manual", "mavlink", "stanag_4586", "srt", "stac_api", "ais_nmea"];

const CLASSIFICATION_LEVELS = ["unclassified", "restricted", "confidential", "secret", "top_secret"];

const ADAPTERS = ["dji", "mavlink", "adsb", "generic_cv", "stanag_4586"];

export default function DataLinksPanel({ onLocate }: { onLocate?: (lat: number, lng: number) => void }) {
  const { feeds, summary, loading, fetchFeeds } = useSensorFeeds();
  const [stacSearching, setStacSearching] = useState(false);
  const [stacResults, setStacResults] = useState<any[]>([]);
  const [showRegForm, setShowRegForm] = useState(false);
  const [showCustomLink, setShowCustomLink] = useState(false);
  const [regForm, setRegForm] = useState({
    source_name: "",
    feed_type: "osint_news",
    protocol: "api_rest",
    lat: "0",
    lng: "0",
    endpoint_url: "",
    coverage_radius_km: "50",
    data_rate_hz: "0.1",
    classification_level: "unclassified",
  });
  const [customLink, setCustomLink] = useState({ name: "", url: "" });

  const byProtocol: Record<string, SensorFeed[]> = {};
  feeds.forEach(f => {
    const p = f.protocol || "api_rest";
    if (!byProtocol[p]) byProtocol[p] = [];
    byProtocol[p].push(f);
  });

  const handleRegister = async () => {
    try {
      const { error } = await supabase.functions.invoke("sensor-adapt", {
        body: {
          action: "register_feed",
          source_name: regForm.source_name,
          feed_type: regForm.feed_type,
          protocol: regForm.protocol,
          lat: parseFloat(regForm.lat),
          lng: parseFloat(regForm.lng),
          endpoint_url: regForm.endpoint_url || undefined,
          coverage_radius_km: parseFloat(regForm.coverage_radius_km) || 50,
          data_rate_hz: parseFloat(regForm.data_rate_hz) || 0.1,
          classification_level: regForm.classification_level,
        },
      });
      if (error) throw error;
      toast({ title: "Feed registered" });
      setShowRegForm(false);
      setRegForm({ source_name: "", feed_type: "osint_news", protocol: "api_rest", lat: "0", lng: "0", endpoint_url: "", coverage_radius_km: "50", data_rate_hz: "0.1", classification_level: "unclassified" });
      fetchFeeds();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleAddCustomLink = async () => {
    if (!customLink.name || !customLink.url) return;
    try {
      const { error } = await supabase.functions.invoke("sensor-adapt", {
        body: {
          action: "register_feed",
          source_name: customLink.name,
          feed_type: "osint_news",
          protocol: customLink.url.startsWith("ws") ? "api_ws" : customLink.url.includes(".m3u8") ? "hls_stream" : "api_rest",
          lat: 0,
          lng: 0,
          endpoint_url: customLink.url,
          coverage_radius_km: 0,
          data_rate_hz: 0.01,
          classification_level: "unclassified",
        },
      });
      if (error) throw error;
      toast({ title: `Link added: ${customLink.name}` });
      setCustomLink({ name: "", url: "" });
      setShowCustomLink(false);
      fetchFeeds();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const handleStacSearch = async () => {
    setStacSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("stac-connector", {
        body: {
          action: "search",
          collections: ["sentinel-2-l2a"],
          bbox: [34, 29, 36, 33],
          datetime: `${new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)}T00:00:00Z/..`,
          limit: 5,
        },
      });
      if (error) throw error;
      setStacResults(data?.features || []);
      toast({ title: `${data?.numberReturned || 0} STAC items found` });
    } catch (e: any) {
      toast({ title: "STAC Error", description: e.message, variant: "destructive" });
    } finally {
      setStacSearching(false);
    }
  };

  const getLatencyColor = (f: SensorFeed) => {
    if (!f.last_data_at) return "bg-muted";
    const age = Date.now() - new Date(f.last_data_at).getTime();
    if (age < 200) return "bg-emerald-500";
    if (age < 2000) return "bg-yellow-500";
    if (age < 30000) return "bg-orange-500";
    return "bg-destructive";
  };

  const totalActive = feeds.filter(f => f.status === "active").length;
  const totalDegraded = feeds.filter(f => f.status === "degraded").length;

  return (
    <div className="flex flex-col h-full text-foreground">
      {/* Header stats */}
      <div className="px-3 py-1.5 border-b border-border/30 bg-card/30">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-mono font-bold tracking-widest text-primary">TACTICAL DATA LINKS</span>
          <button onClick={fetchFeeds} className="text-muted-foreground hover:text-primary transition-colors">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        <div className="flex gap-2 text-[8px] font-mono">
          <span className="text-emerald-400">{totalActive} ACTIVE</span>
          <span className="text-yellow-500">{totalDegraded} DEGRADED</span>
          <span className="text-muted-foreground">{feeds.length} TOTAL</span>
        </div>
      </div>

      {/* Quick actions */}
      <div className="px-2 py-1.5 border-b border-border/20 flex gap-1 flex-wrap">
        <button onClick={() => { setShowRegForm(!showRegForm); setShowCustomLink(false); }}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
          <Plus className="h-2.5 w-2.5" /> REGISTER
        </button>
        <button onClick={() => { setShowCustomLink(!showCustomLink); setShowRegForm(false); }}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors">
          <Link2 className="h-2.5 w-2.5" /> ADD LINK
        </button>
        <button onClick={handleStacSearch} disabled={stacSearching}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[7px] font-mono border border-border/40 text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors disabled:opacity-40">
          <Search className="h-2.5 w-2.5" /> {stacSearching ? "SCANNING..." : "STAC SEARCH"}
        </button>
      </div>

      {/* Quick custom link form */}
      {showCustomLink && (
        <div className="px-2 py-1.5 border-b border-border/20 bg-card/20 space-y-1">
          <div className="text-[7px] font-mono text-muted-foreground tracking-wider mb-1">ADD ANY DATA LINK</div>
          <input value={customLink.name} onChange={e => setCustomLink(p => ({ ...p, name: e.target.value }))}
            placeholder="Link name (e.g. My RSS Feed)" className="w-full bg-background/50 border border-border/30 rounded px-1.5 py-0.5 text-[8px] font-mono text-foreground placeholder:text-muted-foreground" />
          <input value={customLink.url} onChange={e => setCustomLink(p => ({ ...p, url: e.target.value }))}
            placeholder="URL (https://, ws://, rtsp://...)" className="w-full bg-background/50 border border-border/30 rounded px-1.5 py-0.5 text-[8px] font-mono text-foreground placeholder:text-muted-foreground" />
          <button onClick={handleAddCustomLink} disabled={!customLink.name || !customLink.url}
            className="w-full py-0.5 rounded text-[8px] font-mono font-bold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors disabled:opacity-30">
            ADD LINK
          </button>
        </div>
      )}

      {/* Full register form */}
      {showRegForm && (
        <div className="px-2 py-1.5 border-b border-border/20 bg-card/20 space-y-1">
          <div className="text-[7px] font-mono text-muted-foreground tracking-wider mb-1">REGISTER SENSOR FEED</div>
          <input value={regForm.source_name} onChange={e => setRegForm(p => ({ ...p, source_name: e.target.value }))}
            placeholder="Source name" className="w-full bg-background/50 border border-border/30 rounded px-1.5 py-0.5 text-[8px] font-mono text-foreground placeholder:text-muted-foreground" />
          <input value={regForm.endpoint_url} onChange={e => setRegForm(p => ({ ...p, endpoint_url: e.target.value }))}
            placeholder="Endpoint URL (optional)" className="w-full bg-background/50 border border-border/30 rounded px-1.5 py-0.5 text-[8px] font-mono text-foreground placeholder:text-muted-foreground" />
          <div className="flex gap-1">
            <select value={regForm.feed_type} onChange={e => setRegForm(p => ({ ...p, feed_type: e.target.value }))}
              className="flex-1 bg-background/50 border border-border/30 rounded px-1 py-0.5 text-[8px] font-mono text-foreground">
              {FEED_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, " ").toUpperCase()}</option>)}
            </select>
            <select value={regForm.protocol} onChange={e => setRegForm(p => ({ ...p, protocol: e.target.value }))}
              className="flex-1 bg-background/50 border border-border/30 rounded px-1 py-0.5 text-[8px] font-mono text-foreground">
              {PROTOCOLS.map(p => <option key={p} value={p}>{p.toUpperCase()}</option>)}
            </select>
          </div>
          <div className="flex gap-1">
            <input value={regForm.lat} onChange={e => setRegForm(p => ({ ...p, lat: e.target.value }))}
              placeholder="Lat" className="w-14 bg-background/50 border border-border/30 rounded px-1 py-0.5 text-[8px] font-mono text-foreground" />
            <input value={regForm.lng} onChange={e => setRegForm(p => ({ ...p, lng: e.target.value }))}
              placeholder="Lng" className="w-14 bg-background/50 border border-border/30 rounded px-1 py-0.5 text-[8px] font-mono text-foreground" />
            <input value={regForm.coverage_radius_km} onChange={e => setRegForm(p => ({ ...p, coverage_radius_km: e.target.value }))}
              placeholder="Radius km" className="w-14 bg-background/50 border border-border/30 rounded px-1 py-0.5 text-[8px] font-mono text-foreground" title="Coverage radius (km)" />
            <input value={regForm.data_rate_hz} onChange={e => setRegForm(p => ({ ...p, data_rate_hz: e.target.value }))}
              placeholder="Hz" className="w-12 bg-background/50 border border-border/30 rounded px-1 py-0.5 text-[8px] font-mono text-foreground" title="Data rate (Hz)" />
          </div>
          <select value={regForm.classification_level} onChange={e => setRegForm(p => ({ ...p, classification_level: e.target.value }))}
            className="w-full bg-background/50 border border-border/30 rounded px-1 py-0.5 text-[8px] font-mono text-foreground">
            {CLASSIFICATION_LEVELS.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
          </select>
          <button onClick={handleRegister} disabled={!regForm.source_name}
            className="w-full py-0.5 rounded text-[8px] font-mono font-bold bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors disabled:opacity-30">
            REGISTER FEED
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        {/* Protocol groups */}
        {Object.entries(byProtocol).map(([proto, protoFeeds]) => {
          const Icon = PROTOCOL_ICONS[proto] || Wifi;
          return (
            <div key={proto} className="border-b border-border/15">
              <div className="px-2 py-1 bg-card/10 flex items-center gap-1.5">
                <Icon className="h-3 w-3 text-primary/70" />
                <span className="text-[8px] font-mono font-bold tracking-wider text-foreground/80">{proto.toUpperCase()}</span>
                <span className="text-[7px] font-mono text-muted-foreground ml-auto">{protoFeeds.length}</span>
              </div>
              {protoFeeds.map(f => (
                <div key={f.id} className="px-2 py-1 border-b border-border/10 hover:bg-card/20 transition-colors cursor-pointer"
                  onClick={() => onLocate?.(f.lat, f.lng)}>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${f.status === "active" ? "bg-emerald-500" : f.status === "degraded" ? "bg-yellow-500" : "bg-destructive"}`} />
                    <span className="text-[8px] font-mono font-bold truncate text-foreground/90">{f.source_name}</span>
                    <div className={`w-6 h-1 rounded-full ml-auto flex-shrink-0 ${getLatencyColor(f)}`} title="Latency indicator" />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 pl-3">
                    <span className="text-[7px] font-mono text-muted-foreground">{f.feed_type}</span>
                    <span className="text-[7px] font-mono text-muted-foreground">{f.data_rate_hz}Hz</span>
                    <span className="text-[7px] font-mono text-muted-foreground">{f.coverage_radius_km}km</span>
                    {f.last_data_at && (
                      <span className="text-[7px] font-mono text-muted-foreground ml-auto">
                        {new Date(f.last_data_at).toISOString().slice(11, 19)}Z
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {feeds.length === 0 && !loading && (
          <div className="px-3 py-6 text-center text-[9px] font-mono text-muted-foreground">
            No sensor feeds registered<br />
            <span className="text-primary/60">Use REGISTER or ADD LINK to add a data source</span>
          </div>
        )}

        {/* Adapter status */}
        <div className="border-b border-border/15">
          <div className="px-2 py-1 bg-card/10">
            <span className="text-[8px] font-mono font-bold tracking-wider text-foreground/80">VENDOR ADAPTERS</span>
          </div>
          {ADAPTERS.map(a => (
            <div key={a} className="px-2 py-0.5 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/60" />
              <span className="text-[8px] font-mono text-foreground/70">{a.toUpperCase()}</span>
              <span className="text-[7px] font-mono text-muted-foreground ml-auto">READY</span>
            </div>
          ))}
        </div>

        {/* Health summary */}
        {Object.keys(summary).length > 0 && (
          <div className="border-b border-border/15">
            <div className="px-2 py-1 bg-card/10">
              <span className="text-[8px] font-mono font-bold tracking-wider text-foreground/80">HEALTH SUMMARY</span>
            </div>
            {Object.entries(summary).map(([cat, s]) => (
              <div key={cat} className="px-2 py-0.5 flex items-center gap-1">
                <span className="text-[8px] font-mono text-foreground/70 w-16">{cat.toUpperCase()}</span>
                <div className="flex-1 h-1.5 rounded-full bg-muted/30 overflow-hidden flex">
                  {s.active > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(s.active / s.total) * 100}%` }} />}
                  {s.degraded > 0 && <div className="bg-yellow-500 h-full" style={{ width: `${(s.degraded / s.total) * 100}%` }} />}
                  {s.offline > 0 && <div className="bg-destructive h-full" style={{ width: `${(s.offline / s.total) * 100}%` }} />}
                </div>
                <span className="text-[7px] font-mono text-muted-foreground w-8 text-right">{s.active}/{s.total}</span>
              </div>
            ))}
          </div>
        )}

        {/* STAC results */}
        {stacResults.length > 0 && (
          <div className="border-b border-border/15">
            <div className="px-2 py-1 bg-card/10">
              <span className="text-[8px] font-mono font-bold tracking-wider text-foreground/80">STAC IMAGERY</span>
            </div>
            {stacResults.map((r, i) => (
              <div key={i} className="px-2 py-1 border-b border-border/10">
                <div className="text-[8px] font-mono font-bold text-foreground/80 truncate">{r.id}</div>
                <div className="flex gap-2 text-[7px] font-mono text-muted-foreground">
                  <span>{r.platform}</span>
                  <span>☁ {r.cloud_cover?.toFixed(0) ?? "?"}%</span>
                  <span>{r.datetime?.slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Latency target */}
        <div className="px-2 py-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[7px] font-mono text-muted-foreground">LATENCY TARGET</span>
            <span className="text-[7px] font-mono text-emerald-400">&lt;200ms</span>
          </div>
          <div className="h-1 rounded-full bg-muted/30 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-emerald-500 via-yellow-500 to-destructive" style={{ width: "100%" }} />
          </div>
          <div className="flex justify-between text-[6px] font-mono text-muted-foreground mt-0.5">
            <span>0ms</span><span>200ms</span><span>2s</span><span>30s+</span>
          </div>
        </div>
      </div>
    </div>
  );
}
