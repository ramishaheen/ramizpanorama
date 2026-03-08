import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SentimentRequest {
  country: string;
  topic: string;
  date_range?: string;
  language?: string;
  max_posts?: number;
  platforms?: string[];
}

let cachedResult: { key: string; data: any; ts: number } | null = null;
const CACHE_TTL = 86_400_000; // 24 hours

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: SentimentRequest = await req.json();
    const { country, topic, date_range = "last_7_days", language = "auto", max_posts = 500, platforms = ["X", "Reddit", "YouTube", "Telegram"] } = body;

    if (!country || !topic) {
      return new Response(JSON.stringify({ error: "country and topic are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cacheKey = `${country}|${topic}|${date_range}|${platforms.join(",")}`;
    if (cachedResult && cachedResult.key === cacheKey && Date.now() - cachedResult.ts < CACHE_TTL) {
      return new Response(JSON.stringify(cachedResult.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Gemini API not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: Quick Perplexity context (single query, 15s timeout)
    let webContext = "";
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (PERPLEXITY_API_KEY) {
      try {
        const pController = new AbortController();
        const pTimeout = setTimeout(() => pController.abort(), 15000);
        const pResp = await fetch("https://api.perplexity.ai/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "sonar",
            messages: [
              { role: "system", content: "Report social media sentiment data briefly with percentages and key themes." },
              { role: "user", content: `${topic} ${country} social media sentiment public opinion ${new Date().getFullYear()}` },
            ],
            max_tokens: 800,
          }),
          signal: pController.signal,
        });
        clearTimeout(pTimeout);
        if (pResp.ok) {
          const pData = await pResp.json();
          webContext = pData.choices?.[0]?.message?.content || "";
        } else {
          await pResp.text(); // consume body
        }
      } catch (e) {
        console.warn("Perplexity skipped:", e instanceof Error ? e.message : "timeout");
      }
    }

    // Step 2: Gemini analysis (30s timeout)
    const structurePrompt = `Analyze social media sentiment about "${topic}" in "${country}".
DATE RANGE: ${date_range} | PLATFORMS: ${platforms.join(", ")} | LANGUAGE: ${language} | SAMPLE: ${max_posts}
${webContext ? `WEB CONTEXT:\n${webContext}` : "Use current knowledge."}

Return ONLY valid JSON:
{
  "query": { "country": "${country}", "topic": "${topic}", "date_range": "${date_range}", "platforms": ${JSON.stringify(platforms)} },
  "collection_summary": { "posts_collected": <n>, "posts_used": <n>, "country_match_confidence": "high"|"medium"|"low", "sampling_note": "Sampled from public online discussion." },
  "sentiment_summary": { "with_percent": <n>, "against_percent": <n>, "neutral_percent": <n>, "unclear_percent": <n>, "overall_label": "With"|"Against"|"Neutral"|"Mixed", "overall_confidence": "high"|"medium"|"low" },
  "diagram_data": {
    "pie": [{"label":"With","value":<n>},{"label":"Against","value":<n>},{"label":"Neutral","value":<n>},{"label":"Unclear","value":<n>}],
    "bar": [${platforms.map(p => `{"label":"${p}","with":0,"against":0,"neutral":0,"unclear":0}`).join(",")}],
    "trend": [{"date":"day1","with":0,"against":0,"neutral":0},{"date":"day2","with":0,"against":0,"neutral":0},{"date":"day3","with":0,"against":0,"neutral":0},{"date":"day4","with":0,"against":0,"neutral":0},{"date":"day5","with":0,"against":0,"neutral":0},{"date":"day6","with":0,"against":0,"neutral":0},{"date":"day7","with":0,"against":0,"neutral":0}]
  },
  "themes": [{"theme":"<theme>","share":<percent>}],
  "sample_insights": [{"theme":"<theme>","summary":"<sentence>","confidence":"high"|"medium"|"low"}],
  "ui_box": { "title": "Country Sentiment", "country": "${country}", "topic": "${topic}", "headline_result": "<label>", "headline_percent": <n>, "sample_size": <n>, "confidence": "<level>", "warning": "Sampled from public online sources only." }
}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let aiResp;
    try {
      aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: "Return ONLY valid JSON. No markdown, no code fences." },
            { role: "user", content: structurePrompt },
          ],
          temperature: 0.3,
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      console.error("AI fetch error:", fetchErr);
      return new Response(JSON.stringify({ error: "AI request timed out. Please try again." }), {
        status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!aiResp.ok) {
      const status = aiResp.status;
      const errText = await aiResp.text();
      console.error("AI error:", status, errText);
      if (status === 429 || status === 402) {
        return new Response(JSON.stringify({ error: status === 429 ? "Rate limit exceeded, try again shortly." : "AI quota exceeded." }), {
          status, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `AI error: ${status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    let rawContent = aiData.choices?.[0]?.message?.content || "";

    // Clean response
    rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    rawContent = rawContent.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
    const firstBrace = rawContent.indexOf("{");
    if (firstBrace > 0) rawContent = rawContent.slice(firstBrace);
    const lastBrace = rawContent.lastIndexOf("}");
    if (lastBrace >= 0 && lastBrace < rawContent.length - 1) rawContent = rawContent.slice(0, lastBrace + 1);

    let result;
    try {
      result = JSON.parse(rawContent);
    } catch {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try { result = JSON.parse(jsonMatch[0]); } catch {
          console.error("JSON parse failed:", rawContent.slice(0, 300));
          return new Response(JSON.stringify({ error: "AI returned malformed data. Please try again." }), {
            status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: "AI returned non-JSON response." }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    cachedResult = { key: cacheKey, data: result, ts: Date.now() };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Social sentiment error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
