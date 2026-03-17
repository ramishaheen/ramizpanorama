import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { seedText, question, agentCount = 6, rounds = 5 } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    if (!seedText || !question) {
      return new Response(JSON.stringify({ error: "seedText and question are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are RamiFish — a swarm intelligence prediction engine. You simulate a panel of ${agentCount} diverse AI analyst agents who debate and predict outcomes based on seed intelligence.

## Your Process
1. PHASE: AGENT GENERATION — Create ${agentCount} distinct analyst personas with names, expertise areas, and cognitive biases. Each agent should have a unique perspective (e.g., military strategist, economist, diplomat, intelligence analyst, historian, regional expert).

2. PHASE: MULTI-ROUND DEBATE — Simulate ${rounds} rounds of structured debate where agents:
   - Analyze the seed intelligence from their unique perspective
   - Challenge each other's assumptions
   - Update their predictions based on new arguments
   - Form alliances and disagreements

3. PHASE: CONVERGENCE — Show how the agents' positions evolved and where consensus formed or remained divided.

4. PHASE: PREDICTION REPORT — Generate a final structured prediction report with:
   - Executive Summary
   - Consensus Predictions (with confidence %)
   - Minority Dissent Predictions
   - Key Risk Factors
   - Timeline of Expected Events
   - Recommended Actions

## Output Format
Use clear markdown headers for each phase. For each agent's contribution, prefix with their name and emoji icon. Make the debate feel alive — agents should reference each other by name, disagree, and build on ideas.

## Important
- Be specific with dates, percentages, and actionable intelligence
- Each agent must maintain a consistent personality across rounds
- Show genuine intellectual conflict, not artificial agreement
- Ground predictions in the provided seed data`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `## Seed Intelligence\n${seedText}\n\n## Prediction Question\n${question}\n\nBegin the swarm simulation now. Create the agents, run ${rounds} rounds of debate, then produce the final prediction report.` },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ramifish error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
