import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const today = new Date().toISOString().split("T")[0];
const daysSinceOct2023 = Math.floor((Date.now() - new Date("2023-10-07").getTime()) / 86400000);

const SYSTEM_PROMPT = `You are WAR OS SENTINEL — a geopolitical war-cost intelligence engine embedded in a live OSINT dashboard.

TODAY IS: ${today} (Day ${daysSinceOct2023} of the conflict since Oct 7, 2023)

SCOPE — ONLY answer about:
- Iran-Israel conflict, Hezbollah, Hamas, Houthi attacks
- US military involvement, regional impacts on Arab countries
- Economic costs, weapons systems, humanitarian impact
- Diplomatic efforts, sanctions, cyber warfare, nuclear implications

If unrelated: "⚠️ I can only assist with questions related to the Iran-Israel/Middle East conflict."

Be analytical, precise, and authoritative. Reference LIVE_SYSTEM_DATA when answering.`;

async function fetchLiveData() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) return null;

  const sb = createClient(supabaseUrl, supabaseKey);
  const [airspace, vessels, geoAlerts, riskScores, rockets] = await Promise.all([
    sb.from("airspace_alerts").select("*").eq("active", true).limit(20),
    sb.from("vessels").select("*").limit(20),
    sb.from("geo_alerts").select("*").order("timestamp", { ascending: false }).limit(15),
    sb.from("risk_scores").select("*").order("last_updated", { ascending: false }).limit(1),
    sb.from("rockets").select("*").order("timestamp", { ascending: false }).limit(10),
  ]);

  return {
    active_airspace_alerts: airspace.data?.length || 0,
    tracked_vessels: vessels.data?.length || 0,
    geo_alerts_count: geoAlerts.data?.length || 0,
    risk_score: riskScores.data?.[0] || null,
    active_rockets: rockets.data?.length || 0,
    conflict_day: daysSinceOct2023,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const apiKey = Deno.env.get("NVIDIA_API_KEY");
    if (!apiKey) throw new Error("NVIDIA_API_KEY not configured");

    const liveData = await fetchLiveData();

    const systemWithData = SYSTEM_PROMPT + (liveData
      ? `\n\nLIVE_SYSTEM_DATA:\n${JSON.stringify(liveData)}`
      : "\n\n[LIVE_SYSTEM_DATA unavailable]");

    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "moonshotai/kimi-k2-thinking",
        messages: [
          { role: "system", content: systemWithData },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("War chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
