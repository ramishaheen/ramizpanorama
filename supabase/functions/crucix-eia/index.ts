import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SERIES = [
  { id: "PET.RWTC.D", label: "WTI Crude", unit: "$/bbl" },
  { id: "PET.RBRTE.D", label: "Brent Crude", unit: "$/bbl" },
  { id: "NG.RNGWHHD.D", label: "Henry Hub NatGas", unit: "$/MMBtu" },
  { id: "PET.WCESTUS1.W", label: "US Crude Inventory", unit: "k bbl" },
  { id: "PET.WGTSTUS1.W", label: "US Gasoline Inventory", unit: "k bbl" },
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

  const apiKey = Deno.env.get("EIA_API_KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "EIA_API_KEY not configured", series: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const results = await Promise.allSettled(
      SERIES.map(async (s) => {
        const url = `https://api.eia.gov/v2/seriesid/${s.id}?api_key=${apiKey}&num=2`;
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!res.ok) {
          // Try v1 fallback
          const v1 = `https://api.eia.gov/series/?api_key=${apiKey}&series_id=${s.id}&num=2`;
          const r2 = await fetch(v1, { signal: AbortSignal.timeout(10000) });
          if (!r2.ok) throw new Error(`EIA ${s.id} HTTP ${r2.status}`);
          const j2 = await r2.json();
          const d = j2?.series?.[0]?.data;
          if (!d || d.length === 0) throw new Error(`No data for ${s.id}`);
          const value = d[0][1];
          const prev = d.length > 1 ? d[1][1] : null;
          return { id: s.id, label: s.label, unit: s.unit, value, prev, change: prev ? value - prev : null, date: d[0][0] };
        }
        const json = await res.json();
        const d = json?.response?.data;
        if (!d || d.length === 0) throw new Error(`No data for ${s.id}`);
        const value = d[0]?.value;
        const prev = d.length > 1 ? d[1]?.value : null;
        return { id: s.id, label: s.label, unit: s.unit, value, prev, change: prev ? value - prev : null, date: d[0]?.period };
      })
    );

    const series = results
      .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled")
      .map(r => r.value);

    const data = { series, timestamp: new Date().toISOString(), source: "EIA" };
    cache = { data, ts: Date.now() };

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("EIA error:", e);
    if (cache) {
      return new Response(JSON.stringify({ ...cache.data, cached: true, stale: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown", series: [] }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
