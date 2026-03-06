import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AV_BASE = "https://www.alphavantage.co/query";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// In-memory cache
let cachedData: { prices: Record<string, PriceResult>; timestamp: string } | null = null;
let cacheTime = 0;

interface PriceResult {
  key: string;
  price: number;
  change: number;
  changePercent: number;
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchGlobalQuote(symbol: string, key: string, apiKey: string): Promise<PriceResult | null> {
  try {
    const url = `${AV_BASE}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data["Note"] || data["Information"]) {
      console.warn(`Rate limited on GLOBAL_QUOTE ${symbol}`);
      return null;
    }
    const q = data["Global Quote"];
    if (!q || !q["05. price"]) return null;
    const price = parseFloat(q["05. price"]);
    const change = parseFloat(q["09. change"]);
    const changePercent = parseFloat(q["10. change percent"]?.replace("%", "") || "0");
    return { key, price, change, changePercent };
  } catch {
    return null;
  }
}

async function fetchForex(from: string, to: string, key: string, apiKey: string): Promise<PriceResult | null> {
  try {
    const url = `${AV_BASE}?function=CURRENCY_EXCHANGE_RATE&from_currency=${from}&to_currency=${to}&apikey=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data["Note"] || data["Information"]) {
      console.warn(`Rate limited on FOREX ${from}/${to}`);
      return null;
    }
    const rate = data["Realtime Currency Exchange Rate"];
    if (!rate) return null;
    const price = parseFloat(rate["5. Exchange Rate"]);
    return { key, price, change: 0, changePercent: 0 };
  } catch {
    return null;
  }
}

async function fetchCommodityDaily(func: string, key: string, apiKey: string): Promise<PriceResult | null> {
  try {
    const url = `${AV_BASE}?function=${func}&interval=daily&apikey=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data["Note"] || data["Information"]) {
      console.warn(`Rate limited on commodity ${func}`);
      return null;
    }
    const seriesData = data["data"];
    if (!seriesData || seriesData.length < 2) return null;
    const latest = parseFloat(seriesData[0]["value"]);
    const prev = parseFloat(seriesData[1]["value"]);
    if (isNaN(latest) || latest === 0) return null;
    const change = parseFloat((latest - prev).toFixed(4));
    const changePercent = parseFloat(((change / prev) * 100).toFixed(2));
    return { key, price: latest, change, changePercent };
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("ALPHA_VANTAGE_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "ALPHA_VANTAGE_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Return cached data if still fresh
  if (cachedData && (Date.now() - cacheTime) < CACHE_TTL_MS) {
    console.log("Returning cached commodity prices");
    return new Response(JSON.stringify({
      ...cachedData,
      cached: true,
      cacheAge: Math.round((Date.now() - cacheTime) / 1000),
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const prices: Record<string, PriceResult> = {};

    // Fetch sequentially with delays to respect Alpha Vantage free tier (5 calls/min)
    const fetchers: Array<() => Promise<PriceResult | null>> = [
      () => fetchCommodityDaily("WTI", "oil", apiKey),
      () => fetchCommodityDaily("BRENT", "brent", apiKey),
      () => fetchCommodityDaily("NATURAL_GAS", "gas", apiKey),
      () => fetchCommodityDaily("COPPER", "copper", apiKey),
      () => fetchCommodityDaily("WHEAT", "wheat", apiKey),
      () => fetchForex("USD", "ILS", "usdils", apiKey),
      () => fetchForex("USD", "SAR", "usdsar", apiKey),
      () => fetchGlobalQuote("ITA", "ita", apiKey),
      () => fetchGlobalQuote("GLD", "gold_etf", apiKey),
      () => fetchGlobalQuote("SLV", "silver_etf", apiKey),
    ];

    for (const fetcher of fetchers) {
      const result = await fetcher();
      if (result) {
        prices[result.key] = result;
      }
      // 13s delay between calls → 10 calls in ~2 min, well within limits
      await delay(13000);
    }

    // Convert GLD ETF to gold $/oz (GLD ≈ 1/10 of gold price)
    if (prices.gold_etf) {
      prices.gold = {
        key: "gold",
        price: parseFloat((prices.gold_etf.price * 10).toFixed(2)),
        change: parseFloat((prices.gold_etf.change * 10).toFixed(2)),
        changePercent: prices.gold_etf.changePercent,
      };
      delete prices.gold_etf;
    }

    // Convert SLV ETF to silver $/oz
    if (prices.silver_etf) {
      prices.silver = {
        key: "silver",
        price: prices.silver_etf.price,
        change: prices.silver_etf.change,
        changePercent: prices.silver_etf.changePercent,
      };
      delete prices.silver_etf;
    }

    const responseData = {
      prices,
      timestamp: new Date().toISOString(),
      source: "alpha_vantage",
      cached: false,
    };

    // Cache the result
    cachedData = { prices, timestamp: responseData.timestamp };
    cacheTime = Date.now();
    console.log(`Cached ${Object.keys(prices).length} commodity prices`);

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Commodity prices error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
