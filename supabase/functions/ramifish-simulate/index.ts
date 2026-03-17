import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

## Output Format
Use clear markdown headers for each phase. For each agent's contribution, prefix with their name and emoji icon. Make the debate feel alive — agents should reference each other by name, disagree, and build on ideas.

## Important
- Be specific with dates, percentages, and actionable intelligence
- Each agent must maintain a consistent personality across rounds
- Show genuine intellectual conflict, not artificial agreement
- Ground predictions in the provided seed data`;
}

function buildUserPrompt(seedText: string, question: string, rounds: number) {
  return `## Seed Intelligence\n${seedText}\n\n## Prediction Question\n${question}\n\nBegin the swarm simulation now. Create the agents, run ${rounds} rounds of debate, then produce the final prediction report.`;
}

async function callLovableAI(systemPrompt: string, userPrompt: string, apiKey: string) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: true,
    }),
  });
  return response;
}

async function callGeminiDirect(systemPrompt: string, userPrompt: string, apiKey: string) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
        ],
        generationConfig: { temperature: 0.9, maxOutputTokens: 8192 },
      }),
    }
  );
  return response;
}

// Transform Gemini SSE stream into OpenAI-compatible SSE stream
function transformGeminiStream(geminiBody: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = geminiBody.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx).trim();
          buffer = buffer.slice(newlineIdx + 1);

          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === "[DONE]") continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const openaiChunk = {
                choices: [{ delta: { content: text }, index: 0, finish_reason: null }],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openaiChunk)}\n\n`));
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
    },
  });
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

    const systemPrompt = buildSystemPrompt(agentCount, rounds);
    const userPrompt = buildUserPrompt(seedText, question, rounds);

    // 1) Try dedicated RamiFish Gemini key first
    const RAMIFISH_KEY = Deno.env.get("RAMIFISH_GEMINI_KEY");
    if (RAMIFISH_KEY) {
      console.log("RamiFish: trying dedicated Gemini key...");
      try {
        const geminiResp = await callGeminiDirect(systemPrompt, userPrompt, RAMIFISH_KEY);
        if (geminiResp.ok) {
          console.log("RamiFish: dedicated Gemini key succeeded, streaming...");
          const transformedStream = transformGeminiStream(geminiResp.body!);
          return new Response(transformedStream, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }
        const errText = await geminiResp.text();
        console.warn(`RamiFish: dedicated Gemini failed (${geminiResp.status}), falling back. ${errText.slice(0, 200)}`);
      } catch (e) {
        console.warn("RamiFish: dedicated Gemini exception, falling back:", e);
      }
    }

    // 2) Fallback: Lovable AI gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      console.log("RamiFish: trying Lovable AI gateway...");
      try {
        const response = await callLovableAI(systemPrompt, userPrompt, LOVABLE_API_KEY);
        if (response.ok) {
          console.log("RamiFish: Lovable AI succeeded, streaming...");
          return new Response(response.body, {
            headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
          });
        }
        const body = await response.text();
        console.warn(`RamiFish: Lovable AI failed (${response.status}), trying shared Gemini. ${body.slice(0, 200)}`);
      } catch (e) {
        console.warn("RamiFish: Lovable AI exception, trying shared Gemini:", e);
      }
    }

    // 3) Last resort: shared Gemini keys
    const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_API_KEY_2");
    if (!GEMINI_KEY) {
      return new Response(JSON.stringify({ error: "AI credits exhausted and no Gemini fallback key configured." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("RamiFish: falling back to direct Gemini API...");
    const geminiResp = await callGeminiDirect(systemPrompt, userPrompt, GEMINI_KEY);

    if (!geminiResp.ok) {
      const errText = await geminiResp.text();
      console.error("RamiFish: Gemini fallback failed:", geminiResp.status, errText.slice(0, 300));
      return new Response(JSON.stringify({ error: `Gemini API error (${geminiResp.status})` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("RamiFish: Gemini fallback succeeded, transforming stream...");
    const transformedStream = transformGeminiStream(geminiResp.body!);
    return new Response(transformedStream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ramifish error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
