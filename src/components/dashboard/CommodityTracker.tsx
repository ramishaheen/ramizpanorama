import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Fuel, Gem, Flame, Bitcoin, DollarSign, Wheat, Shield, CircleDot } from "lucide-react";
import { useCommodityPrices, type PriceData } from "@/hooks/useCommodityPrices";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage, translations as tr } from "@/hooks/useLanguage";
import { ScrollArea } from "@/components/ui/scroll-area";

const commodityConfig = [
  { key: "oil", label: "WTI Crude", labelAr: "خام غرب تكساس", unit: "$/bbl", icon: Fuel, color: "hsl(25 90% 50%)" },
  { key: "brent", label: "Brent Crude", labelAr: "خام برنت", unit: "$/bbl", icon: Fuel, color: "hsl(15 80% 55%)" },
  { key: "gold", label: "Gold", labelAr: "الذهب", unit: "$/oz", icon: Gem, color: "hsl(45 100% 55%)" },
  { key: "silver", label: "Silver", labelAr: "الفضة", unit: "$/oz", icon: Gem, color: "hsl(210 15% 70%)" },
  { key: "gas", label: "Nat Gas", labelAr: "الغاز الطبيعي", unit: "$/MMBtu", icon: Flame, color: "hsl(200 80% 55%)" },
  { key: "copper", label: "Copper", labelAr: "النحاس", unit: "$/lb", icon: CircleDot, color: "hsl(20 70% 55%)" },
  { key: "wheat", label: "Wheat", labelAr: "القمح", unit: "¢/bu", icon: Wheat, color: "hsl(40 70% 55%)" },
  { key: "usdils", label: "USD/ILS", labelAr: "دولار/شيكل", unit: "", icon: DollarSign, color: "hsl(210 60% 55%)" },
  { key: "usdsar", label: "USD/SAR", labelAr: "دولار/ريال", unit: "", icon: DollarSign, color: "hsl(120 40% 50%)" },
  { key: "ita", label: "Defense ETF", labelAr: "صندوق الدفاع", unit: "USD", icon: Shield, color: "hsl(0 60% 55%)" },
  { key: "btc", label: "Bitcoin", labelAr: "بيتكوين", unit: "USD", icon: Bitcoin, color: "hsl(35 100% 55%)" },
  { key: "eth", label: "Ethereum", labelAr: "إيثريوم", unit: "USD", icon: Gem, color: "hsl(230 60% 60%)" },
] as const;

const formatPrice = (price: number, key: string) => {
  if (key === "btc") return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (key === "gold" || key === "wheat") return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (key === "usdsar") return price.toFixed(4);
  if (key === "usdils") return price.toFixed(3);
  return price.toFixed(2);
};

const Sparkline = ({ data, color, label, width = 60, height = 20 }: { data: number[]; color: string; label: string; width?: number; height?: number }) => {
  const [hovered, setHovered] = useState(false);

  if (data.length < 2) return <div style={{ width, height }} />;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 1;

  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = padding + (1 - (v - min) / range) * (height - padding * 2);
    return `${x},${y}`;
  });

  const strokeColor = color;
  const fillId = `spark-${label.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div
      className="relative flex-shrink-0"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <svg width={width} height={height}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0} />
          </linearGradient>
        </defs>
        <polygon
          points={`${points[0].split(",")[0]},${height} ${points.join(" ")} ${points[points.length - 1].split(",")[0]},${height}`}
          fill={`url(#${fillId})`}
        />
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx={parseFloat(points[points.length - 1].split(",")[0])}
          cy={parseFloat(points[points.length - 1].split(",")[1])}
          r={1.8}
          fill={strokeColor}
        />
      </svg>
      {hovered && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-popover border border-border shadow-lg whitespace-nowrap z-50">
          <div className="font-mono text-[8px] text-muted-foreground uppercase tracking-wider mb-0.5">{label} ({data.length})</div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-success font-bold">H: ${max.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
            <span className="font-mono text-[9px] text-destructive font-bold">L: ${min.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span>
          </div>
        </div>
      )}
    </div>
  );
};

const PriceRow = ({ config, data, history, isArabic }: { config: typeof commodityConfig[number]; data: PriceData; history: number[]; isArabic: boolean }) => {
  const isUp = data.change > 0;
  const isFlat = data.change === 0;
  const Icon = config.icon;
  const TrendIcon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;
  const changeColor = isFlat ? "text-muted-foreground" : isUp ? "text-success" : "text-destructive";

  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 flex-shrink-0" style={{ color: config.color }} />
        <div>
          <span className="font-mono text-[10px] font-semibold text-foreground">{isArabic ? config.labelAr : config.label}</span>
          {config.unit && <span className="font-mono text-[8px] text-muted-foreground ml-1">{config.unit}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Sparkline data={history} color={config.color} label={config.label} />
        <AnimatePresence mode="popLayout">
          <motion.span
            key={data.price}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="font-mono text-xs font-bold text-foreground min-w-[52px] text-right"
          >
            ${formatPrice(data.price, config.key)}
          </motion.span>
        </AnimatePresence>
        <div className={`flex items-center gap-0.5 min-w-[42px] ${changeColor}`}>
          <TrendIcon className="h-2.5 w-2.5" />
          <span className="font-mono text-[9px] font-semibold">
            {isUp ? "+" : ""}{data.changePercent}%
          </span>
        </div>
      </div>
    </div>
  );
};

export const CommodityTracker = () => {
  const prices = useCommodityPrices();
  const { t, isArabic } = useLanguage();

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          {t(tr["section.commodities"].en, tr["section.commodities"].ar)}
        </h4>
        {prices.loading && (
          <RefreshCw className="h-3 w-3 animate-spin text-primary" />
        )}
      </div>
      <ScrollArea className="h-[260px] pr-2">
        <div>
          {commodityConfig.map((cfg) => (
            <PriceRow key={cfg.key} config={cfg} data={prices[cfg.key]} history={prices.history[cfg.key] || []} isArabic={isArabic} />
          ))}
        </div>
      </ScrollArea>
      <p className="font-mono text-[7px] text-muted-foreground/50 mt-1.5 text-right">
        {t("Oil, Gold & commodities simulated • Crypto via CoinGecko • FX & ETF simulated • Updates every 15–30s",
          "النفط والذهب والسلع محاكاة • العملات الرقمية عبر CoinGecko • العملات وصناديق ETF محاكاة • تحديث كل 15-30 ثانية")}
      </p>
    </div>
  );
};
