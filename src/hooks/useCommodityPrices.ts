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
  oil: { price: 82.45, change: 1.23, changePercent: 1.51 },
  brent: { price: 87.20, change: 0.95, changePercent: 1.10 },
  gold: { price: 2685.30, change: 18.40, changePercent: 0.69 },
  silver: { price: 31.50, change: 0.22, changePercent: 0.70 },
  gas: { price: 3.42, change: 0.08, changePercent: 2.39 },
  copper: { price: 4.15, change: -0.03, changePercent: -0.72 },
  wheat: { price: 612.50, change: 5.25, changePercent: 0.86 },
  usdils: { price: 3.72, change: 0.02, changePercent: 0.54 },
  usdsar: { price: 3.75, change: 0.00, changePercent: 0.00 },
  ita: { price: 128.45, change: 1.12, changePercent: 0.88 },
};

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
    const h = historyRef.current[key];
    if (!h) { historyRef.current[key] = [price]; return; }
    h.push(price);
    if (h.length > MAX_HISTORY) h.shift();
  }, []);

  const p = (v: number) => parseFloat(v.toFixed(2));

  // Fetch live commodity prices from Alpha Vantage via edge function
  const fetchLivePrices = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("commodity-prices");
      if (error) throw error;
      if (!data?.prices) return;

      const live = data.prices as Record<string, { price: number; change: number; changePercent: number }>;

      setPrices(prev => {
        const updated = { ...prev };
        for (const [key, val] of Object.entries(live)) {
          if (val && val.price > 0 && key in DEFAULT_PRICES) {
            pushHistory(key, val.price);
            (updated as any)[key] = {
              price: p(val.price),
              change: p(val.change),
              changePercent: p(val.changePercent),
            };
          }
        }
        updated.history = { ...historyRef.current };
        return updated;
      });

      setLastUpdated(data.timestamp || new Date().toISOString());
      console.log("[CommodityTracker] Live prices loaded from Alpha Vantage", Object.keys(live));
    } catch (err) {
      console.warn("[CommodityTracker] Alpha Vantage fetch failed, using simulation:", err);
    }
  }, [pushHistory]);

  useEffect(() => {
    setPrices(prev => ({ ...prev, loading: true }));

    // Seed initial values
    Object.entries(DEFAULT_PRICES).forEach(([k, v]) => pushHistory(k, v.price));
    setPrices(prev => ({
      ...prev,
      ...DEFAULT_PRICES as any,
      history: { ...historyRef.current },
    }));

    // Fetch live prices immediately + every 60s
    fetchLivePrices();
    const liveInterval = setInterval(fetchLivePrices, 60_000);

    // Simulate minor ticks between live updates
    const updateCommodities = () => {
      setPrices(prev => {
        const sim = (val: number, min: number, max: number, vol: number) => {
          const delta = (Math.random() - 0.45) * vol;
          const nv = Math.max(min, Math.min(max, val + delta));
          return { price: p(nv), delta: p(delta) };
        };

        const oil = sim(prev.oil.price, 50, 130, 0.3);
        const brent = sim(prev.brent.price, 53, 135, 0.35);
        const gold = sim(prev.gold.price, 1800, 3500, 2);
        const silver = sim(prev.silver.price, 20, 45, 0.08);
        const gas = sim(prev.gas.price, 1.5, 8.0, 0.02);
        const copper = sim(prev.copper.price, 3.0, 6.0, 0.01);
        const wheat = sim(prev.wheat.price, 400, 900, 1.5);
        const usdils = sim(prev.usdils.price, 3.20, 4.30, 0.003);
        const usdsar = sim(prev.usdsar.price, 3.740, 3.770, 0.0003);
        const ita = sim(prev.ita.price, 80, 180, 0.4);

        const items = { oil, brent, gold, silver, gas, copper, wheat, usdils, usdsar, ita };
        Object.entries(items).forEach(([k, v]) => pushHistory(k, v.price));

        const toPrice = (s: { price: number; delta: number }): PriceData => ({
          price: s.price,
          change: s.delta,
          changePercent: p((s.delta / s.price) * 100),
        });

        return {
          ...prev,
          oil: toPrice(oil), brent: toPrice(brent), gold: toPrice(gold), silver: toPrice(silver),
          gas: toPrice(gas), copper: toPrice(copper), wheat: toPrice(wheat),
          usdils: toPrice(usdils), usdsar: toPrice(usdsar), ita: toPrice(ita),
          history: { ...historyRef.current },
        };
      });
    };

    const commodityInterval = setInterval(updateCommodities, 15_000);

    // Crypto: real CoinGecko data
    const fetchCrypto = async () => {
      try {
        const res = await fetch(COINGECKO_URL);
        if (!res.ok) throw new Error("CoinGecko API error");
        const data = await res.json();

        const btcPrice = data.bitcoin?.usd ?? 0;
        const btcChange = data.bitcoin?.usd_24h_change ?? 0;
        const ethPrice = data.ethereum?.usd ?? 0;
        const ethChange = data.ethereum?.usd_24h_change ?? 0;

        pushHistory("btc", Math.round(btcPrice));
        pushHistory("eth", parseFloat(ethPrice.toFixed(2)));
        setPrices(prev => ({
          ...prev,
          btc: {
            price: Math.round(btcPrice),
            change: Math.round(btcPrice * btcChange / 100),
            changePercent: parseFloat(btcChange.toFixed(2)),
          },
          eth: {
            price: parseFloat(ethPrice.toFixed(2)),
            change: parseFloat((ethPrice * ethChange / 100).toFixed(2)),
            changePercent: parseFloat(ethChange.toFixed(2)),
          },
          loading: false,
          history: { ...historyRef.current },
        }));
      } catch (err) {
        console.error("Failed to fetch crypto prices:", err);
        setPrices(prev => ({
          ...prev,
          btc: prev.btc.price === 0 ? { price: 84250, change: 320, changePercent: 0.38 } : prev.btc,
          eth: prev.eth.price === 0 ? { price: 3180, change: -42, changePercent: -1.31 } : prev.eth,
          loading: false,
        }));
      }
    };

    fetchCrypto();
    const cryptoInterval = setInterval(fetchCrypto, 30_000);

    return () => {
      clearInterval(commodityInterval);
      clearInterval(cryptoInterval);
    };
  }, [refreshKey]);

  const refresh = useCallback(() => {
    refreshKeyRef.current += 1;
    setRefreshKey(refreshKeyRef.current);
  }, []);

  return { ...prices, refresh, lastUpdated };
};
