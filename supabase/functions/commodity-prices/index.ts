import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedData: { prices: Record<string, PriceResult>; timestamp: string } | null = null;
let cacheTime = 0;

interface PriceResult {
  key: string;
  price: number;
  change: number;
  changePercent: number;
}

const SYMBOLS: Record<string, string> = {
  "CL=F": "oil",
  "BZ=F": "brent",
  "GC=F": "gold",
  "SI=F": "silver",
  "NG=F": "gas",
  "HG=F": "copper",
  "ZW=F": "wheat",
  "USDILS=X": "usdils",
  "USDSAR=X": "usdsar",
  "ITA": "ita",
};

async function fetchCryptoPrices(): Promise<Record<string, PriceResult>> {
  try {
    const res = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true");
    if (!res.ok) return {};
    const data = await res.json();
    const results: Record<string, PriceResult> = {};
    if (data.bitcoin?.usd) {
      const p = data.bitcoin.usd;
      const c = data.bitcoin.usd_24h_change ?? 0;
      results.btc = { key: "btc", price: Math.round(p), change: Math.round(p * c / 100), changePercent: parseFloat(c.toFixed(2)) };
    }
    if (data.ethereum?.usd) {
      const p = data.ethereum.usd;
      const c = data.ethereum.usd_24h_change ?? 0;
      results.eth = { key: "eth", price: parseFloat(p.toFixed(2)), change: parseFloat((p * c / 100).toFixed(2)), changePercent: parseFloat(c.toFixed(2)) };
    }
    return results;
  } catch (e) {
    console.error("CoinGecko error:", e);
    return {};
  }
}

async function fetchYahooQuote(symbol: string, key: string): Promise<PriceResult | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=1d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (!res.ok) {
      console.error(`Yahoo ${symbol} HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = meta?.regularMarketPrice ?? 0;
    const prevClose = meta?.chartPreviousClose ?? meta?.previousClose ?? price;

    if (!price || price === 0) return null;

    const change = parseFloat((price - prevClose).toFixed(4));
    const changePercent = prevClose !== 0
      ? parseFloat(((change / prevClose) * 100).toFixed(2))
      : 0;

    return { key, price: parseFloat(price.toFixed(4)), change, changePercent };
  } catch (err) {
    console.error(`Yahoo ${symbol} error:`, err);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Return cached data if fresh
  if (cachedData && (Date.now() - cacheTime) < CACHE_TTL_MS) {
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
    const [yahooResults, cryptoPrices] = await Promise.all([
      Promise.allSettled(
        Object.entries(SYMBOLS).map(([symbol, key]) => fetchYahooQuote(symbol, key))
      ),
      fetchCryptoPrices(),
    ]);

    const prices: Record<string, PriceResult> = {};

    // Keep previous cache for any symbols that failed
    if (cachedData?.prices) {
      Object.assign(prices, cachedData.prices);
    }

    for (const r of yahooResults) {
      if (r.status === "fulfilled" && r.value) {
        prices[r.value.key] = r.value;
      }
    }

    // Merge crypto prices
    Object.assign(prices, cryptoPrices);

    const responseData = {
      prices,
      timestamp: new Date().toISOString(),
      source: "yahoo_finance+coingecko",
      cached: false,
    };

    cachedData = { prices, timestamp: responseData.timestamp };
    cacheTime = Date.now();
    console.log(`Cached ${Object.keys(prices).length} prices from Yahoo Finance + CoinGecko`);

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Commodity prices error:", msg);
    if (cachedData) {
      return new Response(JSON.stringify({ ...cachedData, cached: true, stale: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
