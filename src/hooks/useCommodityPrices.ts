import { useState, useEffect, useRef, useCallback } from "react";

export interface PriceData { price: number; change: number; changePercent: number }

export interface CommodityPrices {
  oil: PriceData;
  gold: PriceData;
  gas: PriceData;
  btc: PriceData;
  eth: PriceData;
  loading: boolean;
  history: Record<string, number[]>;
}

const MAX_HISTORY = 20;

const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true";

export const useCommodityPrices = (): CommodityPrices => {
  const historyRef = useRef<Record<string, number[]>>({ oil: [], gold: [], gas: [], btc: [], eth: [] });
  const [prices, setPrices] = useState<CommodityPrices>({
    oil: { price: 82.45, change: 1.23, changePercent: 1.51 },
    gold: { price: 2685.30, change: 18.40, changePercent: 0.69 },
    gas: { price: 3.42, change: 0.08, changePercent: 2.39 },
    btc: { price: 0, change: 0, changePercent: 0 },
    eth: { price: 0, change: 0, changePercent: 0 },
    loading: true,
    history: { oil: [], gold: [], gas: [], btc: [], eth: [] },
  });

  const pushHistory = useCallback((key: string, price: number) => {
    const h = historyRef.current[key];
    h.push(price);
    if (h.length > MAX_HISTORY) h.shift();
  }, []);

  useEffect(() => {
    // Oil & gold: simulated (no free public API without key)
    const baseOil = 78 + Math.random() * 12;
    const baseGold = 2600 + Math.random() * 200;
    const baseGas = 2.8 + Math.random() * 1.5;

    const updateCommodities = () => {
      setPrices((prev) => {
        const oilDelta = (Math.random() - 0.45) * 1.2;
        const goldDelta = (Math.random() - 0.4) * 8;
        const gasDelta = (Math.random() - 0.45) * 0.08;
        const newOil = Math.max(70, Math.min(100, prev.oil.price + oilDelta));
        const newGold = Math.max(2500, Math.min(2900, prev.gold.price + goldDelta));
        const newGas = Math.max(2.0, Math.min(5.5, prev.gas.price + gasDelta));
        const p = (v: number) => parseFloat(v.toFixed(2));
        pushHistory("oil", p(newOil));
        pushHistory("gold", p(newGold));
        pushHistory("gas", p(newGas));
        return {
          ...prev,
          oil: { price: p(newOil), change: p(oilDelta), changePercent: p((oilDelta / newOil) * 100) },
          gold: { price: p(newGold), change: p(goldDelta), changePercent: p((goldDelta / newGold) * 100) },
          gas: { price: p(newGas), change: p(gasDelta), changePercent: p((gasDelta / newGas) * 100) },
          history: { ...historyRef.current },
        };
      });
    };

    // Initial oil/gold
    // Seed initial history
    pushHistory("oil", parseFloat(baseOil.toFixed(2)));
    pushHistory("gold", parseFloat(baseGold.toFixed(2)));
    pushHistory("gas", parseFloat(baseGas.toFixed(2)));
    setPrices((prev) => ({
      ...prev,
      oil: { price: parseFloat(baseOil.toFixed(2)), change: 1.23, changePercent: 1.51 },
      gold: { price: parseFloat(baseGold.toFixed(2)), change: 18.40, changePercent: 0.69 },
      gas: { price: parseFloat(baseGas.toFixed(2)), change: 0.08, changePercent: 2.39 },
      history: { ...historyRef.current },
    }));

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
        setPrices((prev) => ({
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
        // Fallback to simulated
        setPrices((prev) => ({
          ...prev,
          btc: prev.btc.price === 0
            ? { price: 84250, change: 320, changePercent: 0.38 }
            : prev.btc,
          eth: prev.eth.price === 0
            ? { price: 3180, change: -42, changePercent: -1.31 }
            : prev.eth,
          loading: false,
        }));
      }
    };

    fetchCrypto();
    const cryptoInterval = setInterval(fetchCrypto, 30_000); // CoinGecko free tier: ~30s

    return () => {
      clearInterval(commodityInterval);
      clearInterval(cryptoInterval);
    };
  }, []);

  return prices;
};
