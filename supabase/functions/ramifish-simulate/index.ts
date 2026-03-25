import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

function buildSystemPrompt(agentCount: number, rounds: number) {
  return `You are RamiFish — a swarm intelligence prediction engine. You simulate a panel of ${agentCount} diverse AI analyst agents who debate and predict outcomes based on seed intelligence.

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

5. PHASE: DATA RELATION DIAGRAM — Output a section titled "## 📊 Data Relation Diagram" containing:
   CRITICAL: Output each line below as PLAIN TEXT — NO markdown formatting, NO backticks, NO bold, NO bullet points, NO code blocks around these lines. Each line must start at column 0.
   a) First, a structured entity list in this EXACT format (one per line, plain text only):
      ENTITY: [Name] | TYPE: [actor/target/force/org/event] | THREAT: [0-100]
   b) Then relation lines in this EXACT format (one per line, plain text only):
      RELATION: [Source] -> [Target] | TYPE: [supplies/threatens/allied/opposes/funds/controls/destabilizes/supports/attacks] | WEIGHT: [1-10]
   c) Then radar dimensions in this EXACT format (one per line, plain text only):
      RADAR: [Dimension Name] | VALUE: [0-100]
      Use these 6 dimensions: Military Escalation, Economic Impact, Diplomatic Risk, Cyber Threat, Humanitarian Crisis, Regional Instability
   d) After the structured data, also include an ASCII text diagram with arrows showing relationships visually.

6. PHASE: FUTURE FORESIGHT SCENARIOS — Output a section titled "## 🔮 Future Foresight Scenarios" with exactly 3 distinct scenarios:
   ### Scenario 1: [Title] (Probability: X%)
   **Timeframe:** [e.g. 0-30 days]
   **Trigger:** [What causes this scenario]
   **Description:** [2-3 sentences]
   **Impact:** [Key consequences]
   
   ### Scenario 2: [Title] (Probability: X%)
   (same structure)
   
   ### Scenario 3: [Title] (Probability: X%)
   (same structure)

## Output Format
Use clear markdown headers for each phase. For each agent's contribution, prefix with their name and emoji icon. Make the debate feel alive — agents should reference each other by name, disagree, and build on ideas.

## Important
- Be specific with dates, percentages, and actionable intelligence
- Each agent must maintain a consistent personality across rounds
- Show genuine intellectual conflict, not artificial agreement
- Ground predictions in the provided seed data
- ALWAYS include the Data Relation Diagram and 3 Future Foresight Scenarios at the end`;
}

function buildUserPrompt(seedText: string, question: string, rounds: number) {
  return `## Seed Intelligence\n${seedText}\n\n## Prediction Question\n${question}\n\nBegin the swarm simulation now. Create the agents, run ${rounds} rounds of debate, then produce the final prediction report.`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { seedText, question, agentCount = 6, rounds = 5 } = await req.json();

    if (!seedText || !question) {
      return new Response(JSON.stringify({ error: "seedText and question are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = buildSystemPrompt(agentCount, rounds);
    const userPrompt = buildUserPrompt(seedText, question, rounds);

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
        reasoning: { effort: "high" },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited — please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errBody = await response.text().catch(() => "");
      console.error(`RamiFish AI gateway error: ${response.status} ${errBody.slice(0, 300)}`);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
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
