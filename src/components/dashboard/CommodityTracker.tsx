import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Fuel, Gem, Flame, Bitcoin, DollarSign, Wheat, Shield, CircleDot, ArrowLeftRight, Activity, AlertTriangle, ShieldAlert } from "lucide-react";
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

const OilSpreadIndicator = ({ brent, wti, isArabic }: { brent: PriceData; wti: PriceData; isArabic: boolean }) => {
  const spread = parseFloat((brent.price - wti.price).toFixed(2));
  const spreadPercent = wti.price > 0 ? parseFloat(((spread / wti.price) * 100).toFixed(2)) : 0;
  const isWidening = spread > 4;
  const isNarrowing = spread < 2;

  // Contango/Backwardation: simulated using spread trend
  // Positive spread + rising = contango (future > spot), negative/falling = backwardation
  const isContango = spread > 0 && brent.change >= wti.change;
  const curveLabel = isContango ? "CONTANGO" : "BACKWARDATION";
  const curveColor = isContango ? "text-warning" : "text-success";
  const curveBg = isContango ? "bg-warning/10 border-warning/30" : "bg-success/10 border-success/30";
  const curveDesc = isContango
    ? (isArabic ? "أسعار العقود الآجلة أعلى من الفورية" : "Futures priced above spot — storage costs rising")
    : (isArabic ? "أسعار الفورية أعلى من الآجلة" : "Spot priced above futures — immediate demand high");

  return (
    <div className="border-t border-border/40 pt-2 mt-1 space-y-1.5">
      {/* Brent-WTI Spread */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-full bg-primary/20 flex items-center justify-center">
            <ArrowLeftRight className="h-2 w-2 text-primary" />
          </div>
          <span className="font-mono text-[9px] font-semibold text-muted-foreground uppercase">
            {isArabic ? "فارق برنت-WTI" : "Brent-WTI Spread"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`font-mono text-xs font-bold ${spread > 5 ? "text-warning" : spread < 1 ? "text-success" : "text-foreground"}`}>
            ${spread.toFixed(2)}
          </span>
          <span className={`font-mono text-[8px] px-1.5 py-0.5 rounded border ${
            isWidening ? "bg-warning/10 border-warning/30 text-warning" :
            isNarrowing ? "bg-success/10 border-success/30 text-success" :
            "bg-muted/30 border-border text-muted-foreground"
          }`}>
            {isWidening ? (isArabic ? "يتسع" : "WIDENING") : isNarrowing ? (isArabic ? "يضيق" : "NARROW") : (isArabic ? "طبيعي" : "NORMAL")}
          </span>
          <span className="font-mono text-[8px] text-muted-foreground">
            ({spreadPercent > 0 ? "+" : ""}{spreadPercent}%)
          </span>
        </div>
      </div>

      {/* Spread bar visualization */}
      <div className="relative h-1.5 bg-muted/30 rounded-full overflow-hidden">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${spread > 5 ? "bg-warning" : spread < 1 ? "bg-success" : "bg-primary"}`}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, (spread / 10) * 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        <div className="absolute inset-y-0 left-[40%] w-px bg-muted-foreground/30" title="$4 avg" />
      </div>
      <div className="flex justify-between font-mono text-[7px] text-muted-foreground/50">
        <span>$0</span>
        <span>{isArabic ? "متوسط $4" : "$4 avg"}</span>
        <span>$10+</span>
      </div>

      {/* Contango / Backwardation */}
      <div className={`flex items-center justify-between px-2 py-1.5 rounded border ${curveBg}`}>
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-[8px] text-muted-foreground uppercase">
            {isArabic ? "منحنى العقود" : "Futures Curve"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <motion.span
            className={`font-mono text-[9px] font-black ${curveColor} uppercase tracking-wider`}
            animate={{ opacity: [1, 0.6, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {curveLabel}
          </motion.span>
        </div>
      </div>
      <p className="font-mono text-[7px] text-muted-foreground/40 text-center">{curveDesc}</p>
    </div>
  );
};

const WAR_PREMIUM_BASELINE = 65; // Pre-conflict fair value $/bbl
const WAR_PREMIUM_THRESHOLDS = [
  { min: 0, max: 20, label: "MINIMAL", labelAr: "أدنى", color: "text-success", bg: "bg-success/10 border-success/30", premiumRange: [0, 3] },
  { min: 20, max: 40, label: "LOW", labelAr: "منخفض", color: "text-success", bg: "bg-success/10 border-success/30", premiumRange: [2, 6] },
  { min: 40, max: 60, label: "ELEVATED", labelAr: "مرتفع", color: "text-warning", bg: "bg-warning/10 border-warning/30", premiumRange: [5, 12] },
  { min: 60, max: 80, label: "HIGH", labelAr: "عالي", color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", premiumRange: [10, 22] },
  { min: 80, max: 101, label: "EXTREME", labelAr: "أقصى", color: "text-destructive", bg: "bg-destructive/20 border-destructive/50", premiumRange: [18, 35] },
];

const WarRiskPremium = ({ oilPrice, riskScore, isArabic }: { oilPrice: number; riskScore: number; isArabic: boolean }) => {
  const threshold = WAR_PREMIUM_THRESHOLDS.find(t => riskScore >= t.min && riskScore < t.max) || WAR_PREMIUM_THRESHOLDS[0];

  // Premium scales within the range based on exact risk score position
  const position = (riskScore - threshold.min) / (threshold.max - threshold.min);
  const premium = parseFloat((threshold.premiumRange[0] + position * (threshold.premiumRange[1] - threshold.premiumRange[0])).toFixed(2));
  const premiumPercent = oilPrice > 0 ? parseFloat(((premium / oilPrice) * 100).toFixed(1)) : 0;
  const fairValue = parseFloat((oilPrice - premium).toFixed(2));
  const annualCostBillions = parseFloat(((premium * 100_000_000 * 365) / 1e9).toFixed(1)); // ~100M bbl/day global

  return (
    <div className="border-t border-border/40 pt-2 mt-1 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ShieldAlert className="h-3 w-3 text-destructive" />
          <span className="font-mono text-[9px] font-semibold text-muted-foreground uppercase">
            {isArabic ? "علاوة مخاطر الحرب" : "War Risk Premium"}
          </span>
        </div>
        <motion.span
          className={`font-mono text-[8px] font-black px-1.5 py-0.5 rounded border ${threshold.bg} ${threshold.color} uppercase`}
          animate={{ opacity: riskScore >= 60 ? [1, 0.5, 1] : 1 }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {isArabic ? threshold.labelAr : threshold.label}
        </motion.span>
      </div>

      {/* Premium amount */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-muted/20 rounded px-2 py-1.5 text-center">
          <span className="font-mono text-[7px] text-muted-foreground/60 uppercase block">
            {isArabic ? "العلاوة" : "Premium"}
          </span>
          <span className={`font-mono text-sm font-black ${threshold.color}`}>
            +${premium.toFixed(2)}
          </span>
          <span className="font-mono text-[7px] text-muted-foreground block">/bbl</span>
        </div>
        <div className="bg-muted/20 rounded px-2 py-1.5 text-center">
          <span className="font-mono text-[7px] text-muted-foreground/60 uppercase block">
            {isArabic ? "القيمة العادلة" : "Fair Value"}
          </span>
          <span className="font-mono text-xs font-bold text-foreground">
            ${fairValue.toFixed(2)}
          </span>
          <span className="font-mono text-[7px] text-muted-foreground block">/bbl</span>
        </div>
        <div className="bg-muted/20 rounded px-2 py-1.5 text-center">
          <span className="font-mono text-[7px] text-muted-foreground/60 uppercase block">
            {isArabic ? "% من السعر" : "% of Price"}
          </span>
          <span className={`font-mono text-xs font-bold ${threshold.color}`}>
            {premiumPercent}%
          </span>
          <span className="font-mono text-[7px] text-muted-foreground block">
            {isArabic ? "علاوة" : "premium"}
          </span>
        </div>
      </div>

      {/* Premium bar */}
      <div className="relative">
        <div className="flex items-center gap-1 mb-0.5">
          <span className="font-mono text-[7px] text-muted-foreground/50">{isArabic ? "مؤشر المخاطر" : "Risk Index"}: {riskScore}/100</span>
        </div>
        <div className="relative h-2 bg-muted/20 rounded-full overflow-hidden">
          {/* Gradient bar segments */}
          <div className="absolute inset-0 flex">
            <div className="h-full bg-success/40" style={{ width: "20%" }} />
            <div className="h-full bg-success/30" style={{ width: "20%" }} />
            <div className="h-full bg-warning/40" style={{ width: "20%" }} />
            <div className="h-full bg-destructive/30" style={{ width: "20%" }} />
            <div className="h-full bg-destructive/50" style={{ width: "20%" }} />
          </div>
          {/* Pointer */}
          <motion.div
            className="absolute top-0 h-full w-1 bg-foreground rounded-full shadow-lg"
            initial={{ left: 0 }}
            animate={{ left: `${Math.min(98, riskScore)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
          />
        </div>
        <div className="flex justify-between font-mono text-[6px] text-muted-foreground/40 mt-0.5">
          <span>0</span>
          <span>20</span>
          <span>40</span>
          <span>60</span>
          <span>80</span>
          <span>100</span>
        </div>
      </div>

      {/* Annual global cost */}
      <div className={`flex items-center justify-between px-2 py-1.5 rounded border ${threshold.bg}`}>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-[8px] text-muted-foreground uppercase">
            {isArabic ? "التكلفة العالمية السنوية" : "Global Annual Cost"}
          </span>
        </div>
        <span className={`font-mono text-[10px] font-black ${threshold.color}`}>
          ~${annualCostBillions}B/yr
        </span>
      </div>
      <p className="font-mono text-[6px] text-muted-foreground/30 text-center">
        {isArabic
          ? "العلاوة = فارق السعر الحالي عن القيمة العادلة بدون توتر جيوسياسي (~$65/برميل)"
          : `Premium = current price above conflict-free fair value (~$${WAR_PREMIUM_BASELINE}/bbl) × risk factor`}
      </p>
    </div>
  );
};

export const CommodityTracker = ({ riskScore = 50 }: { riskScore?: number }) => {
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
      <ScrollArea className="h-[420px] pr-2">
        <div>
          {commodityConfig.map((cfg) => (
            <PriceRow key={cfg.key} config={cfg} data={prices[cfg.key]} history={prices.history[cfg.key] || []} isArabic={isArabic} />
          ))}
          <OilSpreadIndicator brent={prices.brent} wti={prices.oil} isArabic={isArabic} />
          <WarRiskPremium oilPrice={prices.brent.price} riskScore={riskScore} isArabic={isArabic} />
        </div>
      </ScrollArea>
      <p className="font-mono text-[7px] text-muted-foreground/50 mt-1.5 text-right">
        {t("Oil, Gold & commodities simulated • Crypto via CoinGecko • FX & ETF simulated • Updates every 15–30s",
          "النفط والذهب والسلع محاكاة • العملات الرقمية عبر CoinGecko • العملات وصناديق ETF محاكاة • تحديث كل 15-30 ثانية")}
      </p>
    </div>
  );
};
