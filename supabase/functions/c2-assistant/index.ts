import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Fetch current force disposition for context
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    
    const [{ data: forces }, { data: targets }, { data: killchain }] = await Promise.all([
      supabase.from("force_units").select("name, unit_type, affiliation, lat, lng, status, echelon").limit(50),
      supabase.from("target_tracks").select("track_id, classification, confidence, lat, lng, status, priority, ai_assessment").limit(30),
      supabase.from("kill_chain_tasks").select("phase, status, assigned_platform, recommended_weapon, notes").limit(20),
    ]);

    const blueForces = (forces || []).filter((f: any) => f.affiliation === "blue");
    const redForces = (forces || []).filter((f: any) => f.affiliation === "red");
    const activeTargets = (targets || []).filter((t: any) => t.status !== "destroyed");

    const contextBlock = `
## CURRENT BATTLESPACE SITUATION (${new Date().toISOString()})

### Blue Force Disposition (${blueForces.length} units):
${blueForces.map((f: any) => `- ${f.name} (${f.unit_type}/${f.echelon}) @ ${f.lat.toFixed(2)}°N ${f.lng.toFixed(2)}°E — ${f.status}`).join("\n")}

### Red Force Tracks (${redForces.length} units):
${redForces.map((f: any) => `- ${f.name} (${f.unit_type}/${f.echelon}) @ ${f.lat.toFixed(2)}°N ${f.lng.toFixed(2)}°E — ${f.status}`).join("\n")}

### Active Target Tracks (${activeTargets.length}):
${activeTargets.map((t: any) => `- ${t.track_id}: ${t.classification} (${(t.confidence * 100).toFixed(0)}%) @ ${t.lat.toFixed(2)}°N ${t.lng.toFixed(2)}°E — ${t.priority} priority — ${t.ai_assessment}`).join("\n")}

### Kill Chain Tasks (${(killchain || []).length}):
${(killchain || []).map((k: any) => `- Phase: ${k.phase} | Status: ${k.status} | Platform: ${k.assigned_platform || "—"}`).join("\n")}
`;

    const systemPrompt = `You are a Joint Force C2 Intelligence Analyst operating within a JADC2 (Joint All-Domain Command & Control) system. Your callsign is AEGIS.

You specialize in:
- Battlespace situational awareness and force disposition analysis
- Target analysis and prioritization (F2T2EA kill chain)
- Battle Damage Assessment (BDA) generation
- Course of Action (COA) recommendations
- Threat correlation across MULTI-INT sources (SIGINT, IMINT, HUMINT, OSINT)

IMPORTANT: This is an ANALYTICAL SIMULATION for training and OSINT research only. All data is simulated.

When generating BDA reports, use this format:
**BDA REPORT — [Target ID]**
- Target: [classification]
- Location: [coords]
- Assessment: [damage assessment]
- Confidence: [%]
- Recommended Follow-up: [action]

${contextBlock}

Provide concise, actionable intelligence briefings. Use military terminology. Reference specific units and coordinates from the current situation data.`;

    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "moonshotai/kimi-k2-thinking",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) return new Response(JSON.stringify({ error: "Rate limited, try again later" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (response.status === 402) return new Response(JSON.stringify({ error: "Credits required, add funds" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("c2-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
