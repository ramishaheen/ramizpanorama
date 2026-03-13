import { useMemo } from "react";
import { AlertTriangle, Zap, Shield, Bug } from "lucide-react";
import type { CyberThreat } from "@/hooks/useCyberThreats";

interface CyberAlertBannerProps {
  threats: CyberThreat[];
}

export function CyberAlertBanner({ threats }: CyberAlertBannerProps) {
  const alerts = useMemo(() => {
    const result: { id: string; icon: typeof AlertTriangle; text: string; severity: string }[] = [];

    // Attack spike detection
    const criticals = threats.filter(t => t.severity === "critical");
    if (criticals.length >= 5) {
      result.push({ id: "spike", icon: AlertTriangle, text: `ALERT: ${criticals.length} critical incidents detected — elevated threat posture`, severity: "critical" });
    }

    // Ransomware detection
    const ransomware = threats.filter(t => t.type.toLowerCase().includes("ransomware"));
    if (ransomware.length >= 2) {
      result.push({ id: "ransomware", icon: Bug, text: `RANSOMWARE: ${ransomware.length} active campaigns detected across multiple targets`, severity: "high" });
    }

    // Mass scanning
    const attackerCounts: Record<string, number> = {};
    threats.forEach(t => { const a = t.attackerCountry || t.attacker; attackerCounts[a] = (attackerCounts[a] || 0) + 1; });
    const topAttacker = Object.entries(attackerCounts).sort((a, b) => b[1] - a[1])[0];
    if (topAttacker && topAttacker[1] >= 5) {
      result.push({ id: "mass-scan", icon: Zap, text: `CONCENTRATED: ${topAttacker[1]} attacks originating from ${topAttacker[0]} — possible coordinated campaign`, severity: "high" });
    }

    // APT detection
    const aptThreats = threats.filter(t => t.type.toLowerCase().includes("espionage") || t.details.toLowerCase().includes("apt"));
    if (aptThreats.length >= 2) {
      result.push({ id: "apt", icon: Shield, text: `APT ACTIVITY: ${aptThreats.length} state-sponsored operations detected`, severity: "critical" });
    }

    return result.slice(0, 2);
  }, [threats]);

  if (alerts.length === 0) return null;

  const severityStyles: Record<string, string> = {
    critical: "bg-destructive/10 border-destructive/30 text-destructive",
    high: "bg-orange-500/10 border-orange-500/30 text-orange-400",
  };

  return (
    <div className="border-b border-border">
      {alerts.map(alert => {
        const Icon = alert.icon;
        return (
          <div key={alert.id} className={`flex items-center gap-2 px-4 py-1 text-[9px] font-mono border-b border-border last:border-b-0 cyber-alert-slide ${severityStyles[alert.severity] || severityStyles.high}`}>
            <Icon className="h-3 w-3 flex-shrink-0 animate-pulse" />
            <span className="truncate">{alert.text}</span>
          </div>
        );
      })}
    </div>
  );
}
