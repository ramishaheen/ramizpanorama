import { useState, useEffect } from "react";

interface PriceData { price: number; change: number; changePercent: number }

interface CommodityPrices {
  oil: PriceData;
  gold: PriceData;
  btc: PriceData;
  eth: PriceData;
  loading: boolean;
}

export const useCommodityPrices = (): CommodityPrices => {
  const [prices, setPrices] = useState<CommodityPrices>({
    oil: { price: 82.45, change: 1.23, changePercent: 1.51 },
    gold: { price: 2685.30, change: 18.40, changePercent: 0.69 },
    btc: { price: 84250, change: 320, changePercent: 0.38 },
    eth: { price: 3180, change: -42, changePercent: -1.31 },
    loading: true,
  });

  useEffect(() => {
    const baseOil = 78 + Math.random() * 12;
    const baseGold = 2600 + Math.random() * 200;
    const baseBtc = 80000 + Math.random() * 10000;
    const baseEth = 2800 + Math.random() * 800;

    const update = () => {
      setPrices((prev) => {
        const oilDelta = (Math.random() - 0.45) * 1.2;
        const goldDelta = (Math.random() - 0.4) * 8;
        const btcDelta = (Math.random() - 0.5) * 500;
        const ethDelta = (Math.random() - 0.5) * 30;

        const newOil = Math.max(70, Math.min(100, prev.oil.price + oilDelta));
        const newGold = Math.max(2500, Math.min(2900, prev.gold.price + goldDelta));
        const newBtc = Math.max(70000, Math.min(100000, prev.btc.price + btcDelta));
        const newEth = Math.max(2500, Math.min(4000, prev.eth.price + ethDelta));

        const p = (v: number) => parseFloat(v.toFixed(2));
        return {
          oil: { price: p(newOil), change: p(oilDelta), changePercent: p((oilDelta / newOil) * 100) },
          gold: { price: p(newGold), change: p(goldDelta), changePercent: p((goldDelta / newGold) * 100) },
          btc: { price: Math.round(newBtc), change: Math.round(btcDelta), changePercent: p((btcDelta / newBtc) * 100) },
          eth: { price: p(newEth), change: p(ethDelta), changePercent: p((ethDelta / newEth) * 100) },
          loading: false,
        };
      });
    };

    setPrices({
      oil: { price: parseFloat(baseOil.toFixed(2)), change: 1.23, changePercent: 1.51 },
      gold: { price: parseFloat(baseGold.toFixed(2)), change: 18.40, changePercent: 0.69 },
      btc: { price: Math.round(baseBtc), change: 320, changePercent: 0.38 },
      eth: { price: parseFloat(baseEth.toFixed(2)), change: -42, changePercent: -1.31 },
      loading: false,
    });

    const interval = setInterval(update, 15_000);
    return () => clearInterval(interval);
  }, []);

  return prices;
};
