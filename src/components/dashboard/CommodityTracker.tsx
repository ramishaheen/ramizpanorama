import { TrendingUp, TrendingDown, Minus, RefreshCw, Fuel, Gem, Flame, Bitcoin } from "lucide-react";
import { useCommodityPrices, type PriceData } from "@/hooks/useCommodityPrices";
import { motion, AnimatePresence } from "framer-motion";

const commodityConfig = [
  { key: "oil", label: "Crude Oil", unit: "$/bbl", icon: Fuel, color: "hsl(25 90% 50%)" },
  { key: "gold", label: "Gold", unit: "$/oz", icon: Gem, color: "hsl(45 100% 55%)" },
  { key: "gas", label: "Nat Gas", unit: "$/MMBtu", icon: Flame, color: "hsl(200 80% 55%)" },
  { key: "btc", label: "Bitcoin", unit: "USD", icon: Bitcoin, color: "hsl(35 100% 55%)" },
  { key: "eth", label: "Ethereum", unit: "USD", icon: Gem, color: "hsl(230 60% 60%)" },
] as const;

const formatPrice = (price: number, key: string) => {
  if (key === "btc") return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (key === "gold") return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return price.toFixed(2);
};

const Sparkline = ({ data, color, width = 60, height = 20 }: { data: number[]; color: string; width?: number; height?: number }) => {
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

  const isUp = data[data.length - 1] >= data[0];
  const strokeColor = color;
  const fillId = `spark-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg width={width} height={height} className="flex-shrink-0">
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
      {/* Latest point dot */}
      <circle
        cx={parseFloat(points[points.length - 1].split(",")[0])}
        cy={parseFloat(points[points.length - 1].split(",")[1])}
        r={1.8}
        fill={strokeColor}
      />
    </svg>
  );
};

const PriceRow = ({ config, data, history }: { config: typeof commodityConfig[number]; data: PriceData; history: number[] }) => {
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
          <span className="font-mono text-[10px] font-semibold text-foreground">{config.label}</span>
          <span className="font-mono text-[8px] text-muted-foreground ml-1">{config.unit}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Sparkline data={history} color={config.color} />
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

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          Commodity & Crypto Prices
        </h4>
        {prices.loading && (
          <RefreshCw className="h-3 w-3 animate-spin text-primary" />
        )}
      </div>
      <div>
        {commodityConfig.map((cfg) => (
          <PriceRow key={cfg.key} config={cfg} data={prices[cfg.key]} history={prices.history[cfg.key] || []} />
        ))}
      </div>
      <p className="font-mono text-[7px] text-muted-foreground/50 mt-1.5 text-right">
        Oil & Gold simulated • Crypto via CoinGecko • Updates every 15–30s
      </p>
    </div>
  );
};
