import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SERIES = [
  { id: "VIXCLS", label: "VIX", unit: "index" },
  { id: "T10Y2Y", label: "Yield Curve (10Y-2Y)", unit: "%" },
  { id: "CPIAUCSL", label: "CPI", unit: "index" },
  { id: "FEDFUNDS", label: "Fed Funds Rate", unit: "%" },
  { id: "UNRATE", label: "Unemployment", unit: "%" },
  { id: "M2SL", label: "M2 Money Supply", unit: "bil $" },
  { id: "GOLDAMGBD228NLBM", label: "Gold (London)", unit: "$/oz" },
  { id: "DTWEXBGS", label: "USD Trade Index", unit: "index" },
  { id: "DCOILWTICO", label: "WTI Crude", unit: "$/bbl" },
  { id: "DCOILBRENTEU", label: "Brent Crude", unit: "$/bbl" },
];

let cache: { data: any; ts: number } | null = null;
const TTL = 30 * 60 * 1000;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (cache && Date.now() - cache.ts < TTL) {
    return new Response(JSON.stringify({ ...cache.data, cached: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = Deno.env.get("FRED_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "FRED_API_KEY not configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const results = await Promise.allSettled(
      SERIES.map(async (s) => {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=2`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) throw new Error(`FRED ${s.id} HTTP ${res.status}`);
        const json = await res.json();
        const obs = json.observations?.filter((o: any) => o.value !== ".");
        const latest = obs?.[0];
        const prev = obs?.[1];
        const value = latest ? parseFloat(latest.value) : null;
        const prevValue = prev ? parseFloat(prev.value) : null;
        const change = value !== null && prevValue !== null ? value - prevValue : null;
        return {
          id: s.id,
          label: s.label,
          unit: s.unit,
          value,
          prevValue,
          change,
          date: latest?.date || null,
        };
      })
    );

    const indicators = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map((r) => r.value);

    const data = { indicators, timestamp: new Date().toISOString(), source: "FRED" };
    cache = { data, ts: Date.now() };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("FRED error:", e);
    if (cache) {
      return new Response(JSON.stringify({ ...cache.data, cached: true, stale: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown", indicators: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
