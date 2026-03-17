import { useState, useEffect, useRef } from "react";
import { Bell, Rocket, X, AlertTriangle, Shield, Anchor, Plane } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { Rocket as RocketType, GeoAlert } from "@/data/mockData";
import type { TelegramMarker } from "@/hooks/useTelegramIntel";
import { useLanguage } from "@/hooks/useLanguage";

export interface NotificationItem {
  id: string;
  type: "missile" | "alert" | "military" | "maritime" | "airspace" | "warsleaks";
  title: string;
  detail: string;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: number;
  read: boolean;
}

function getRegionName(lat: number, lng: number): string {
  if (lat > 29 && lat < 38 && lng > 35 && lng < 46) return "Levant / Iraq";
  if (lat > 24 && lat < 32 && lng > 46 && lng < 56) return "Persian Gulf";
  if (lat > 20 && lat < 28 && lng > 36 && lng < 46) return "Arabian Peninsula";
  if (lat > 32 && lat < 40 && lng > 44 && lng < 62) return "Iran";
  if (lat > 12 && lat < 20 && lng > 42 && lng < 55) return "Yemen / Red Sea";
  if (lat > 30 && lat < 36 && lng > 33 && lng < 37) return "Eastern Mediterranean";
  return `${lat.toFixed(1)}°N ${lng.toFixed(1)}°E`;
}

function playMissileAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    for (let i = 0; i < 3; i++) {
      const t = ctx.currentTime + i * 1.0;
      osc.frequency.linearRampToValueAtTime(880, t + 0.5);
      osc.frequency.linearRampToValueAtTime(440, t + 1.0);
    }
    gain.gain.setValueAtTime(0, ctx.currentTime);
    for (let i = 0; i < 6; i++) {
      const t = ctx.currentTime + i * 0.5;
      gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.25);
    }
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 3.0);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 3.2);
    setTimeout(() => ctx.close(), 4000);
  } catch (e) {
    console.warn("Could not play alert sound:", e);
  }
}

const severityColors: Record<string, string> = {
  low: "text-success",
  medium: "text-primary",
  high: "text-warning",
  critical: "text-destructive",
};

const severityBg: Record<string, string> = {
  low: "bg-success/10 border-success/20",
  medium: "bg-primary/10 border-primary/20",
  high: "bg-warning/10 border-warning/20",
  critical: "bg-destructive/10 border-destructive/20",
};

const typeIcons: Record<string, React.ReactNode> = {
  missile: <Rocket className="h-3.5 w-3.5" />,
  alert: <AlertTriangle className="h-3.5 w-3.5" />,
  military: <Shield className="h-3.5 w-3.5" />,
  maritime: <Anchor className="h-3.5 w-3.5" />,
  airspace: <Plane className="h-3.5 w-3.5" />,
  warsleaks: <AlertTriangle className="h-3.5 w-3.5" />,
};

interface NotificationCenterProps {
  rockets: RocketType[];
  alertMuted?: boolean;
  telegramMarkers?: TelegramMarker[];
}

export const NotificationCenter = ({ rockets, alertMuted, telegramMarkers = [] }: NotificationCenterProps) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const seenRocketIds = useRef<Set<string>>(new Set());
  const seenTelegramIds = useRef<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const telegramInitRef = useRef(false);
  const { t } = useLanguage();

  // Track new rocket launches
  useEffect(() => {
    if (!initializedRef.current) {
      rockets.forEach((r) => seenRocketIds.current.add(r.id));
      initializedRef.current = true;
      return;
    }
    const newLaunches = rockets.filter(
      (r) => (r.status === "launched" || r.status === "in_flight") && !seenRocketIds.current.has(r.id)
    );
    if (newLaunches.length > 0) {
      const newNotifs: NotificationItem[] = newLaunches.map((r) => ({
        id: `missile-${r.id}-${Date.now()}`,
        type: "missile" as const,
        title: `🚀 MISSILE LAUNCH — ${r.name || "Unknown"}`,
        detail: `${r.type || "BALLISTIC"} • ${getRegionName(r.originLat, r.originLng)} → ${getRegionName(r.targetLat, r.targetLng)}`,
        severity: "critical" as const,
        timestamp: Date.now(),
        read: false,
      }));
      setNotifications((prev) => [...newNotifs, ...prev].slice(0, 50));
      if (!alertMuted) playMissileAlertSound();
    }
    newLaunches.forEach((r) => seenRocketIds.current.add(r.id));
    rockets.forEach((r) => seenRocketIds.current.add(r.id));
  }, [rockets, alertMuted]);

  // Track WarsLeaks
  useEffect(() => {
    if (telegramMarkers.length === 0) return;
    if (!telegramInitRef.current) {
      telegramMarkers.forEach((m) => seenTelegramIds.current.add(m.headline));
      telegramInitRef.current = true;
      const criticalMarkers = telegramMarkers.filter((m) => m.severity === "critical" || m.special);
      if (criticalMarkers.length > 0) {
        const newNotifs: NotificationItem[] = criticalMarkers.map((m) => ({
          id: `wl-${m.id}`,
          type: "warsleaks" as const,
          title: `📡 WARSLEAKS: ${m.headline}`,
          detail: `${m.summary} • ${m.category}`,
          severity: m.severity,
          timestamp: Date.now(),
          read: false,
        }));
        setNotifications((prev) => {
          const existingTitles = new Set(prev.map((n) => n.title));
          const unique = newNotifs.filter((n) => !existingTitles.has(n.title));
          return [...unique, ...prev].slice(0, 50);
        });
      }
      return;
    }
    const newCritical = telegramMarkers.filter(
      (m) => (m.severity === "critical" || m.severity === "high" || m.special) && !seenTelegramIds.current.has(m.headline)
    );
    if (newCritical.length > 0) {
      const newNotifs: NotificationItem[] = newCritical.map((m) => ({
        id: `wl-${m.id}`,
        type: "warsleaks" as const,
        title: `📡 WARSLEAKS: ${m.headline}`,
        detail: `${m.summary} • ${m.category}`,
        severity: m.severity,
        timestamp: Date.now(),
        read: false,
      }));
      setNotifications((prev) => {
        const existingTitles = new Set(prev.map((n) => n.title));
        const unique = newNotifs.filter((n) => !existingTitles.has(n.title));
        return [...unique, ...prev].slice(0, 50);
      });
      if (!alertMuted && newCritical.some((m) => m.severity === "critical" || m.special)) {
        playMissileAlertSound();
      }
    }
    telegramMarkers.forEach((m) => seenTelegramIds.current.add(m.headline));
  }, [telegramMarkers, alertMuted]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  const clearAll = () => setNotifications([]);
  const dismiss = (id: string) => setNotifications((prev) => prev.filter((n) => n.id !== id));

  const formatTime = (ts: number) => {
    const diff = Math.floor((Date.now() - ts) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    return `${Math.floor(diff / 3600)}h ago`;
  };

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) markAllRead(); }}>
      <PopoverTrigger asChild>
        <button
          className={`relative flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-300 ${
            unreadCount > 0
              ? "border-destructive/50 text-destructive bg-destructive/10 shadow-[0_0_12px_hsl(0_80%_50%/0.2)]"
              : open
              ? "border-primary bg-primary/20 text-primary"
              : "border-border hover:border-primary/50 text-muted-foreground hover:text-primary hover:bg-primary/5"
          }`}
          title={t("Notifications", "الإشعارات")}
        >
          <Bell className="h-3.5 w-3.5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 text-[8px] font-bold bg-destructive text-white rounded-full animate-pulse">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[360px] max-w-[90vw] p-0 bg-card/95 backdrop-blur-xl border-border shadow-2xl overflow-hidden"
        style={{ zIndex: 999999 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <Bell className="h-3.5 w-3.5 text-primary" />
            <span className="text-[11px] font-semibold uppercase tracking-widest text-foreground">
              {t("Notifications", "الإشعارات")}
            </span>
            {notifications.length > 0 && (
              <span className="text-[9px] font-mono text-muted-foreground">({notifications.length})</span>
            )}
          </div>
          {notifications.length > 0 && (
            <button
              onClick={clearAll}
              className="text-[8px] font-mono text-muted-foreground hover:text-foreground uppercase transition-colors px-1.5 py-0.5 rounded hover:bg-secondary/50"
            >
              {t("Clear All", "مسح الكل")}
            </button>
          )}
        </div>

        {/* Notification List */}
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-[10px] font-mono text-muted-foreground/50">
              {t("No notifications yet", "لا توجد إشعارات بعد")}
            </p>
          </div>
        ) : (
          <div className="h-[320px] max-h-[60vh]">
            <ScrollArea className="h-full">
              <div className="p-1.5 space-y-1">
                <AnimatePresence initial={false}>
                  {notifications.map((notif) => (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className={`relative rounded border px-2.5 py-2 transition-colors ${severityBg[notif.severity]} ${
                        !notif.read ? "ring-1 ring-primary/20" : ""
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div className={`flex-shrink-0 mt-0.5 ${severityColors[notif.severity]}`}>
                          {typeIcons[notif.type] || typeIcons.alert}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-[10px] font-semibold leading-tight ${
                            notif.severity === "critical" ? "text-destructive" : "text-foreground"
                          }`}>
                            {notif.title}
                          </p>
                          <p className="text-[9px] text-muted-foreground leading-snug mt-0.5">{notif.detail}</p>
                          <span className="text-[7px] font-mono text-muted-foreground/50 mt-0.5 block">
                            {formatTime(notif.timestamp)}
                          </span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); dismiss(notif.id); }}
                          className="flex-shrink-0 p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors rounded"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};
