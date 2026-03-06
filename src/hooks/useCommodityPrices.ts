import { useState, useEffect, useRef, useCallback } from "react";

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
}

const KEYS = ["oil", "brent", "gold", "silver", "gas", "copper", "wheat", "usdils", "usdsar", "ita", "btc", "eth"];

const MAX_HISTORY = 20;

const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true";

const initHistory = (): Record<string, number[]> =>
  Object.fromEntries(KEYS.map(k => [k, []]));

export const useCommodityPrices = (): CommodityPrices => {
  const historyRef = useRef<Record<string, number[]>>(initHistory());
  const refreshKeyRef = useRef(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [prices, setPrices] = useState<CommodityPrices>({
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
    btc: { price: 0, change: 0, changePercent: 0 },
    eth: { price: 0, change: 0, changePercent: 0 },
    loading: true,
    history: initHistory(),
    refresh: () => {},
  });

  const pushHistory = useCallback((key: string, price: number) => {
    const h = historyRef.current[key];
    if (!h) { historyRef.current[key] = [price]; return; }
    h.push(price);
    if (h.length > MAX_HISTORY) h.shift();
  }, []);

  useEffect(() => {
    setPrices(prev => ({ ...prev, loading: true }));
    const baseOil = 78 + Math.random() * 12;
    const baseBrent = baseOil + 3 + Math.random() * 3;
    const baseGold = 2600 + Math.random() * 200;
    const baseSilver = 28 + Math.random() * 6;
    const baseGas = 2.8 + Math.random() * 1.5;
    const baseCopper = 3.8 + Math.random() * 0.8;
    const baseWheat = 560 + Math.random() * 120;
    const baseILS = 3.60 + Math.random() * 0.25;
    const baseSAR = 3.7499 + Math.random() * 0.005;
    const baseITA = 120 + Math.random() * 20;

    const p = (v: number) => parseFloat(v.toFixed(2));

    // Seed initial
    const seeds: Record<string, number> = {
      oil: p(baseOil), brent: p(baseBrent), gold: p(baseGold), silver: p(baseSilver),
      gas: p(baseGas), copper: p(baseCopper), wheat: p(baseWheat),
      usdils: p(baseILS), usdsar: p(baseSAR), ita: p(baseITA),
    };
    Object.entries(seeds).forEach(([k, v]) => pushHistory(k, v));

    setPrices(prev => ({
      ...prev,
      oil: { price: seeds.oil, change: 1.23, changePercent: 1.51 },
      brent: { price: seeds.brent, change: 0.95, changePercent: 1.10 },
      gold: { price: seeds.gold, change: 18.40, changePercent: 0.69 },
      silver: { price: seeds.silver, change: 0.22, changePercent: 0.70 },
      gas: { price: seeds.gas, change: 0.08, changePercent: 2.39 },
      copper: { price: seeds.copper, change: -0.03, changePercent: -0.72 },
      wheat: { price: seeds.wheat, change: 5.25, changePercent: 0.86 },
      usdils: { price: seeds.usdils, change: 0.02, changePercent: 0.54 },
      usdsar: { price: seeds.usdsar, change: 0.00, changePercent: 0.00 },
      ita: { price: seeds.ita, change: 1.12, changePercent: 0.88 },
      history: { ...historyRef.current },
    }));

    const updateCommodities = () => {
      setPrices(prev => {
        const sim = (val: number, min: number, max: number, vol: number) => {
          const delta = (Math.random() - 0.45) * vol;
          const nv = Math.max(min, Math.min(max, val + delta));
          return { price: p(nv), delta: p(delta) };
        };

        const oil = sim(prev.oil.price, 70, 110, 1.2);
        const brent = sim(prev.brent.price, 73, 115, 1.3);
        const gold = sim(prev.gold.price, 2400, 3000, 8);
        const silver = sim(prev.silver.price, 24, 38, 0.3);
        const gas = sim(prev.gas.price, 2.0, 6.5, 0.08);
        const copper = sim(prev.copper.price, 3.4, 5.0, 0.04);
        const wheat = sim(prev.wheat.price, 480, 800, 6);
        const usdils = sim(prev.usdils.price, 3.40, 4.10, 0.015);
        const usdsar = sim(prev.usdsar.price, 3.745, 3.760, 0.001);
        const ita = sim(prev.ita.price, 100, 160, 1.5);

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

  return { ...prices, refresh };
};
