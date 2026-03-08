import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TLE_GROUPS = [
  "active", "military", "resource", "weather", "gnss", "geo", "sarsat",
  "stations", "science", "amateur", "engineering", "radar", "cubesat",
  "other-comm", "molniya", "iridium", "globalstar", "orbcomm",
  "starlink", "oneweb", "planet", "spire", "last-30-days",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { groups } = await req.json().catch(() => ({ groups: null }));
    const selectedGroups: string[] = groups && Array.isArray(groups) ? groups : TLE_GROUPS;

    const results: Record<string, string> = {};

    // Fetch in batches of 6 to avoid overwhelming
    const batchSize = 6;
    for (let i = 0; i < selectedGroups.length; i += batchSize) {
      const batch = selectedGroups.slice(i, i + batchSize);
      const promises = batch.map(async (group) => {
        try {
          const resp = await fetch(
            `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`,
            { signal: AbortSignal.timeout(12000) }
          );
          if (!resp.ok) return { group, text: "" };
          const text = await resp.text();
          return { group, text };
        } catch {
          return { group, text: "" };
        }
      });
      const batchResults = await Promise.all(promises);
      for (const r of batchResults) {
        if (r.text) results[r.group] = r.text;
      }
    }

    return new Response(JSON.stringify({ data: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
