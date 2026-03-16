import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PriceData { price: number; change: number; changePercent: number }

export interface CommodityPrices {
  oil: PriceData;
  brent: PriceData;
  gold: PriceData;
  silver: PriceData;
  gas: PriceData;
  copper: PriceData;
  wheat: PriceData;
  usdils: PriceData;
  usdsar: PriceData;
  ita: PriceData;
  btc: PriceData;
  eth: PriceData;
  loading: boolean;
  history: Record<string, number[]>;
  refresh: () => void;
  lastUpdated: string | null;
}

const KEYS = ["oil", "brent", "gold", "silver", "gas", "copper", "wheat", "usdils", "usdsar", "ita", "btc", "eth"];
const MAX_HISTORY = 20;
const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true";

const initHistory = (): Record<string, number[]> =>
  Object.fromEntries(KEYS.map(k => [k, []]));

const DEFAULT_PRICES: Record<string, PriceData> = {
  oil: { price: 0, change: 0, changePercent: 0 },
  brent: { price: 0, change: 0, changePercent: 0 },
  gold: { price: 0, change: 0, changePercent: 0 },
  silver: { price: 0, change: 0, changePercent: 0 },
  gas: { price: 0, change: 0, changePercent: 0 },
  copper: { price: 0, change: 0, changePercent: 0 },
  wheat: { price: 0, change: 0, changePercent: 0 },
  usdils: { price: 0, change: 0, changePercent: 0 },
  usdsar: { price: 0, change: 0, changePercent: 0 },
  ita: { price: 0, change: 0, changePercent: 0 },
};

const p = (v: number) => parseFloat(v.toFixed(2));

export const useCommodityPrices = (): CommodityPrices => {
  const historyRef = useRef<Record<string, number[]>>(initHistory());
  const refreshKeyRef = useRef(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [prices, setPrices] = useState<CommodityPrices>({
    ...DEFAULT_PRICES as any,
    btc: { price: 0, change: 0, changePercent: 0 },
    eth: { price: 0, change: 0, changePercent: 0 },
    loading: true,
    history: initHistory(),
    refresh: () => {},
    lastUpdated: null,
  });

  const pushHistory = useCallback((key: string, price: number) => {
    if (price <= 0) return;
    const h = historyRef.current[key];
    if (!h) { historyRef.current[key] = [price]; return; }
    h.push(price);
    if (h.length > MAX_HISTORY) h.shift();
  }, []);

  // Fetch live commodity prices from Yahoo Finance via edge function
  const fetchLivePrices = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("commodity-prices");
      if (error) throw error;
      if (!data?.prices) return;

      const live = data.prices as Record<string, { price: number; change: number; changePercent: number }>;

      setPrices(prev => {
        const updated = { ...prev };
        for (const [key, val] of Object.entries(live)) {
          if (val && val.price > 0) {
            pushHistory(key, val.price);
            (updated as any)[key] = {
              price: p(val.price),
              change: p(val.change),
              changePercent: p(val.changePercent),
            };
          }
        }
        updated.history = { ...historyRef.current };
        updated.loading = false;
        return updated;
      });

      setLastUpdated(data.timestamp || new Date().toISOString());
      console.log("[CommodityTracker] Live prices loaded from Yahoo Finance", Object.keys(live));
    } catch (err) {
      console.warn("[CommodityTracker] Yahoo Finance fetch failed:", err);
      setPrices(prev => ({ ...prev, loading: false }));
    }
  }, [pushHistory]);

  // Crypto is now fetched server-side via commodity-prices edge function

  useEffect(() => {
    setPrices(prev => ({ ...prev, loading: true }));

    // Fetch live prices immediately + every 60s
    fetchLivePrices();
    const liveInterval = setInterval(fetchLivePrices, 60_000);

    // Crypto: real CoinGecko data every 30s
    fetchCrypto();
    const cryptoInterval = setInterval(fetchCrypto, 30_000);

    return () => {
      clearInterval(liveInterval);
      clearInterval(cryptoInterval);
    };
  }, [refreshKey, fetchLivePrices, fetchCrypto]);

  const refresh = useCallback(() => {
    refreshKeyRef.current += 1;
    setRefreshKey(refreshKeyRef.current);
  }, []);

  return { ...prices, refresh, lastUpdated };
};
