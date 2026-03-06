import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const AV_BASE = "https://www.alphavantage.co/query";

interface PriceResult {
  key: string;
  price: number;
  change: number;
  changePercent: number;
}

async function fetchGlobalQuote(symbol: string, key: string, apiKey: string): Promise<PriceResult | null> {
  try {
    const url = `${AV_BASE}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${apiKey}`;
    const res = await fetch(url);
    const data = await res.json();
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
    const rate = data["Realtime Currency Exchange Rate"];
    if (!rate) return null;
    const price = parseFloat(rate["5. Exchange Rate"]);
    // AV forex doesn't give change, we return 0 and let client compute from history
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

  try {
    // Fetch in parallel — these are the key prices we can get from Alpha Vantage
    // Note: Free tier = 25 requests/day, so each refresh uses ~9 calls
    const results = await Promise.allSettled([
      fetchCommodityDaily("WTI", "oil", apiKey),
      fetchCommodityDaily("BRENT", "brent", apiKey),
      fetchCommodityDaily("NATURAL_GAS", "gas", apiKey),
      fetchCommodityDaily("COPPER", "copper", apiKey),
      fetchCommodityDaily("WHEAT", "wheat", apiKey),
      fetchForex("USD", "ILS", "usdils", apiKey),
      fetchForex("USD", "SAR", "usdsar", apiKey),
      fetchGlobalQuote("ITA", "ita", apiKey),
      fetchGlobalQuote("GLD", "gold_etf", apiKey),
      fetchGlobalQuote("SLV", "silver_etf", apiKey),
    ]);

    const prices: Record<string, PriceResult> = {};
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) {
        prices[r.value.key] = r.value;
      }
    }

    // Convert GLD ETF price to approximate gold $/oz (GLD ≈ 1/10 of gold price)
    if (prices.gold_etf) {
      prices.gold = {
        key: "gold",
        price: parseFloat((prices.gold_etf.price * 10).toFixed(2)),
        change: parseFloat((prices.gold_etf.change * 10).toFixed(2)),
        changePercent: prices.gold_etf.changePercent,
      };
      delete prices.gold_etf;
    }

    // Convert SLV ETF price to approximate silver $/oz (SLV ≈ silver price)
    if (prices.silver_etf) {
      prices.silver = {
        key: "silver",
        price: prices.silver_etf.price,
        change: prices.silver_etf.change,
        changePercent: prices.silver_etf.changePercent,
      };
      delete prices.silver_etf;
    }

    return new Response(JSON.stringify({
      prices,
      timestamp: new Date().toISOString(),
      source: "alpha_vantage",
    }), {
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
