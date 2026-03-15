import { useState, useEffect, useRef, useCallback } from "react";
import { X, Minimize2, Maximize2, Radio, Activity, Signal, Cpu, Satellite, Camera, Globe, Radar } from "lucide-react";
import type { SensorFeed } from "@/hooks/useSensorFeeds";

const FEED_ICONS: Record<string, React.ReactNode> = {
  satellite: <Satellite className="h-3 w-3" />,
  drone: <Globe className="h-3 w-3" />,
  cctv: <Camera className="h-3 w-3" />,
  sigint: <Radio className="h-3 w-3" />,
  osint: <Globe className="h-3 w-3" />,
  ground: <Radar className="h-3 w-3" />,
  iot: <Cpu className="h-3 w-3" />,
};

const FEED_ACCENT: Record<string, string> = {
  satellite: "hsl(var(--primary))",
  drone: "#f97316",
  cctv: "#22c55e",
  sigint: "#a855f7",
  osint: "#eab308",
  ground: "#ef4444",
  iot: "#06b6d4",
};

interface DataPacket {
  id: number;
  ts: string;
  type: string;
  payload: string;
  signal: number;
  bytes: number;
}

function generatePacket(feed: SensorFeed, seq: number): DataPacket {
  const cat = feed.feed_type.split("_")[0];
  const payloads: Record<string, string[]> = {
    satellite: ["EO_FRAME", "SAR_PULSE", "IR_SCAN", "MULTISPECTRAL", "PANCHROMATIC", "SWIR_BAND"],
    drone: ["FMV_FRAME", "LIDAR_PT", "GIMBAL_TEL", "NAV_UPDATE", "FLIR_IMG"],
    cctv: ["H264_PKT", "MJPEG_FR", "ONVIF_EVT", "PTZ_CMD", "ANALYTICS"],
    sigint: ["RF_BURST", "COMINT_PKT", "ELINT_PDW", "FREQ_SCAN", "DEMOD_SIG"],
    osint: ["ADS_B_MSG", "AIS_NMEA", "TWEET", "RSS_ITEM", "NEWS_ITEM"],
    ground: ["RDR_TRACK", "ACOUSTIC", "SEISMIC", "DOPPLER", "IFF_RESP"],
    iot: ["SCADA_REG", "MODBUS_PK", "SENSOR_RD", "ALERT_EVT", "TELEMETRY"],
  };
  const catPayloads = payloads[cat] || payloads.osint;
  const p = catPayloads[Math.floor(Math.random() * catPayloads.length)];
  const signal = Math.max(0, Math.min(100, feed.health_score + (Math.random() - 0.5) * 20));
  return {
    id: seq,
    ts: new Date().toISOString().slice(11, 23),
    type: p,
    payload: `0x${Array.from({ length: 8 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0")).join("")}`,
    signal: Math.round(signal),
    bytes: Math.floor(Math.random() * 4096) + 64,
  };
}

interface SensorPiPViewProps {
  feed: SensorFeed;
  onClose: () => void;
}

export const SensorPiPView = ({ feed, onClose }: SensorPiPViewProps) => {
  const [packets, setPackets] = useState<DataPacket[]>([]);
  const [minimized, setMinimized] = useState(false);
  const [paused, setPaused] = useState(false);
  const [totalBytes, setTotalBytes] = useState(0);
  const [pktCount, setPktCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);

  // Dragging state
  const [pos, setPos] = useState({ x: 16, y: 60 });
  const dragRef = useRef<{ dragging: boolean; offsetX: number; offsetY: number }>({ dragging: false, offsetX: 0, offsetY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragRef.current = { dragging: true, offsetX: e.clientX - pos.x, offsetY: e.clientY - pos.y };
    e.preventDefault();
  }, [pos]);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragRef.current.dragging) return;
      setPos({ x: e.clientX - dragRef.current.offsetX, y: e.clientY - dragRef.current.offsetY });
    };
    const handleUp = () => { dragRef.current.dragging = false; };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
  }, []);

  // Simulate data stream
  useEffect(() => {
    if (paused || feed.status === "offline") return;
    const rateMs = feed.data_rate_hz >= 1 ? 1000 / feed.data_rate_hz : feed.data_rate_hz > 0 ? 1000 / feed.data_rate_hz : 2000;
    const interval = Math.max(150, Math.min(rateMs, 3000)); // clamp 150ms–3s
    const iv = setInterval(() => {
      seqRef.current += 1;
      const pkt = generatePacket(feed, seqRef.current);
      setPackets(prev => [...prev.slice(-50), pkt]);
      setTotalBytes(prev => prev + pkt.bytes);
      setPktCount(prev => prev + 1);
    }, interval);
    return () => clearInterval(iv);
  }, [feed, paused]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [packets]);

  const cat = feed.feed_type.split("_")[0];
  const accent = FEED_ACCENT[cat] || "hsl(var(--primary))";
  const icon = FEED_ICONS[cat] || <Signal className="h-3 w-3" />;

  const formatBytes = (b: number) => b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : b >= 1024 ? `${(b / 1024).toFixed(1)} KB` : `${b} B`;

  return (
    <div
      ref={containerRef}
      className="fixed z-[9999] rounded-lg overflow-hidden shadow-2xl border border-border/50"
      style={{
        left: pos.x,
        top: pos.y,
        width: minimized ? 220 : 340,
        backgroundColor: "hsl(220, 20%, 4%)",
        borderColor: `${accent}40`,
        boxShadow: `0 0 30px ${accent}15, 0 8px 32px rgba(0,0,0,0.6)`,
      }}
    >
      {/* Title bar — draggable */}
      <div
        className="flex items-center justify-between px-2 py-1.5 cursor-move select-none"
        style={{ background: `linear-gradient(90deg, ${accent}15, transparent)`, borderBottom: `1px solid ${accent}25` }}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: feed.status === "active" ? "#22c55e" : feed.status === "degraded" ? "#eab308" : "#ef4444" }} />
          <span style={{ color: accent }}>{icon}</span>
          <span className="text-[8px] font-mono font-bold text-foreground tracking-wider truncate max-w-[120px]">
            {feed.source_name}
          </span>
          <span className="text-[7px] font-mono px-1 py-0.5 rounded" style={{ backgroundColor: `${accent}15`, color: accent }}>
            {feed.feed_type.split("_").slice(0, 2).join("_").toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => setPaused(!paused)} className="p-0.5 rounded hover:bg-accent/20 transition-colors" title={paused ? "Resume" : "Pause"}>
            <Activity className={`h-3 w-3 ${paused ? "text-muted-foreground" : "text-primary"}`} />
          </button>
          <button onClick={() => setMinimized(!minimized)} className="p-0.5 rounded hover:bg-accent/20 transition-colors">
            {minimized ? <Maximize2 className="h-3 w-3 text-muted-foreground" /> : <Minimize2 className="h-3 w-3 text-muted-foreground" />}
          </button>
          <button onClick={onClose} className="p-0.5 rounded hover:bg-destructive/20 transition-colors">
            <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Stats bar */}
          <div className="flex items-center gap-3 px-2 py-1 border-b border-border/20">
            <div className="flex items-center gap-1">
              <Signal className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="text-[7px] font-mono text-muted-foreground">{feed.data_rate_hz >= 1 ? `${feed.data_rate_hz} Hz` : `${(feed.data_rate_hz * 60).toFixed(1)}/min`}</span>
            </div>
            <div className="text-[7px] font-mono text-muted-foreground">{pktCount} pkts</div>
            <div className="text-[7px] font-mono text-muted-foreground">{formatBytes(totalBytes)}</div>
            <div className="text-[7px] font-mono" style={{ color: accent }}>HP:{feed.health_score}%</div>
            {paused && <span className="text-[7px] font-mono text-destructive animate-pulse ml-auto">⏸ PAUSED</span>}
            {feed.status === "offline" && <span className="text-[7px] font-mono text-destructive ml-auto">⚠ OFFLINE</span>}
          </div>

          {/* Raw data stream */}
          <div ref={scrollRef} className="overflow-y-auto overflow-x-hidden scrollbar-thin" style={{ height: 180 }}>
            {packets.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <span className="text-[8px] font-mono text-muted-foreground animate-pulse">Awaiting data stream…</span>
              </div>
            )}
            {packets.map(pkt => (
              <div key={pkt.id} className="flex items-center gap-1.5 px-2 py-0.5 border-b border-border/5 hover:bg-accent/5 transition-colors font-mono text-[7px]">
                <span className="text-muted-foreground/60 w-[62px] flex-shrink-0">{pkt.ts}</span>
                <span className="w-[70px] flex-shrink-0 font-bold" style={{ color: accent }}>{pkt.type}</span>
                <span className="text-muted-foreground flex-1 truncate">{pkt.payload}</span>
                <span className="text-muted-foreground/50 w-[38px] text-right flex-shrink-0">{pkt.bytes}B</span>
                <div className="w-8 h-1 rounded-full bg-muted/30 flex-shrink-0 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pkt.signal}%`, backgroundColor: pkt.signal >= 80 ? "#22c55e" : pkt.signal >= 50 ? "#eab308" : "#ef4444" }} />
                </div>
              </div>
            ))}
          </div>

          {/* Protocol footer */}
          <div className="flex items-center justify-between px-2 py-1 border-t border-border/20">
            <span className="text-[6px] font-mono text-muted-foreground/50">
              {feed.protocol.toUpperCase()} • {feed.classification_level.toUpperCase()} • {feed.lat.toFixed(2)}°N {feed.lng.toFixed(2)}°E
            </span>
            <span className="text-[6px] font-mono text-muted-foreground/50">r={feed.coverage_radius_km}km</span>
          </div>
        </>
      )}

      {/* Minimized summary */}
      {minimized && (
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-[7px] font-mono text-muted-foreground">{pktCount} pkts • {formatBytes(totalBytes)}</span>
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: paused ? "#ef4444" : "#22c55e" }} />
        </div>
      )}
    </div>
  );
};
