import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

function buildSystemPrompt(agentCount: number, rounds: number) {
  return `You are RamiFish — a swarm intelligence prediction engine. Simulate ${agentCount} analyst agents debating for ${rounds} rounds.

## Process
1. Create ${agentCount} analyst personas (military, economic, diplomatic, intelligence, etc.)
2. Run ${rounds} rounds of debate where agents analyze, challenge, and update predictions
3. Show convergence and divergence

4. PREDICTION REPORT with:
   - Executive Summary, Consensus Predictions (confidence %), Minority Dissent, Key Risks, Timeline, Actions

5. DATA RELATION DIAGRAM — Output "## 📊 Data Relation Diagram" then:
   Plain text lines (NO markdown, NO backticks, NO bullets):
   ENTITY: [Name] | TYPE: [actor/target/force/org/event] | THREAT: [0-100]
   RELATION: [Source] -> [Target] | TYPE: [threatens/attacks/opposes/destabilizes/supplies/funds/allied/supports/controls] | WEIGHT: [1-10]
   RADAR: [Dimension] | VALUE: [0-100]
   Use: Military Escalation, Economic Impact, Diplomatic Risk, Cyber Threat, Humanitarian Crisis, Regional Instability

6. FUTURE FORESIGHT — Output "## 🔮 Future Foresight Scenarios" with 3 scenarios:
   ### Scenario 1: [Title] (Probability: X%)
   **Timeframe:** [e.g. 0-30 days]
   **Trigger:** [cause]
   **Description:** [2-3 sentences]
   **Impact:** [consequences]
   (repeat for scenarios 2 and 3)

Be specific with dates and percentages. Show genuine debate conflict.`;
}

function buildUserPrompt(seedText: string, question: string, rounds: number) {
  return `## Seed Intelligence\n${seedText}\n\n## Prediction Question\n${question}\n\nBegin simulation: create agents, run ${rounds} debate rounds, then produce the prediction report with data diagram and scenarios.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { seedText, question, agentCount = 4, rounds = 3 } = await req.json();

    if (!seedText || !question) {
      return new Response(JSON.stringify({ error: "seedText and question are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY");
    if (!NVIDIA_API_KEY) {
      return new Response(JSON.stringify({ error: "NVIDIA_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildSystemPrompt(agentCount, rounds);
    const userPrompt = buildUserPrompt(seedText, question, rounds);

    console.log(`RamiFish: ${agentCount} agents, ${rounds} rounds, seed length: ${seedText.length}`);

    const response = await fetch(NVIDIA_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "meta/llama-3.3-70b-instruct",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    console.log(`NVIDIA response: ${response.status}`);

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      console.error(`NVIDIA error: ${response.status} ${errBody.slice(0, 500)}`);
      return new Response(JSON.stringify({ error: `API error: ${response.status}`, detail: errBody.slice(0, 200) }), {
        status: response.status === 429 ? 429 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ramifish error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
