import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const COUNTRIES_REGION = ["Iran", "Israel", "Jordan", "UAE", "Bahrain", "Kuwait", "Qatar", "Oman"];

interface SentimentRequest {
  country: string;
  topic: string;
  date_range?: string;
  language?: string;
  max_posts?: number;
  platforms?: string[];
}

let cachedResult: { key: string; data: any; ts: number } | null = null;
const CACHE_TTL = 180_000; // 3 min

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

    // Step 1: Use Perplexity to search for real social media sentiment data
    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

    let webContext = "";

    if (PERPLEXITY_API_KEY) {
      try {
        const searchQueries = [
          `${topic} ${country} social media sentiment reaction public opinion ${date_range === "last_7_days" ? "this week" : "recent"}`,
          `${topic} ${country} Twitter X Reddit reaction trending ${new Date().getFullYear()}`,
        ];

        for (const query of searchQueries) {
          const pResp = await fetch("https://api.perplexity.ai/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "sonar",
              messages: [
                { role: "system", content: "You are a social media sentiment research assistant. Report public sentiment data with percentages, platform breakdowns, and key themes. Be specific about numbers." },
                { role: "user", content: query },
              ],
              max_tokens: 1500,
            }),
          });

          if (pResp.ok) {
            const pData = await pResp.json();
            webContext += (pData.choices?.[0]?.message?.content || "") + "\n\n";
          }
        }
      } catch (e) {
        console.error("Perplexity error:", e);
      }
    }

    // Step 2: Use AI to structure the sentiment analysis
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "Gemini API not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const structurePrompt = `You are a Social Sentiment Intelligence Engine. Analyze public social media sentiment about "${topic}" in "${country}".

DATE RANGE: ${date_range}
PLATFORMS: ${platforms.join(", ")}
LANGUAGE PREFERENCE: ${language}
MAX POSTS SAMPLE: ${max_posts}

${webContext ? `REAL-TIME WEB INTELLIGENCE:\n${webContext}` : "Use your knowledge of current events and social media trends."}

CLASSIFICATION:
- WITH: clearly supports the topic/side/policy
- AGAINST: clearly opposes
- NEUTRAL: informational without position
- UNCLEAR: sarcastic, ambiguous, mixed

Return ONLY valid JSON matching this exact schema:
{
  "query": { "country": "${country}", "topic": "${topic}", "date_range": "${date_range}", "platforms": ${JSON.stringify(platforms)} },
  "collection_summary": {
    "posts_collected": <number>,
    "posts_used": <number>,
    "country_match_confidence": "high"|"medium"|"low",
    "sampling_note": "This reflects sampled public online discussion, not full national opinion."
  },
  "sentiment_summary": {
    "with_percent": <number>,
    "against_percent": <number>,
    "neutral_percent": <number>,
    "unclear_percent": <number>,
    "overall_label": "With"|"Against"|"Neutral"|"Mixed",
    "overall_confidence": "high"|"medium"|"low"
  },
  "diagram_data": {
    "pie": [{"label":"With","value":<n>},{"label":"Against","value":<n>},{"label":"Neutral","value":<n>},{"label":"Unclear","value":<n>}],
    "bar": [<for each platform: {"label":"<platform>","with":<n>,"against":<n>,"neutral":<n>,"unclear":<n>}>],
    "trend": [<7 entries with "date","with","against","neutral" fields>]
  },
  "themes": [{"theme":"<theme>","share":<percent>}],
  "sample_insights": [{"theme":"<theme>","summary":"<1 sentence>","confidence":"high"|"medium"|"low"}],
  "ui_box": {
    "title": "Country Sentiment",
    "country": "${country}",
    "topic": "${topic}",
    "headline_result": "<overall label>",
    "headline_percent": <dominant percent>,
    "sample_size": <posts_used>,
    "confidence": "<level>",
    "warning": "Sampled from public online sources only."
  }
}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    let aiResp;
    try {
      aiResp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${GEMINI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a social media sentiment analysis engine. Return ONLY valid JSON. No markdown, no code fences, no explanation." },
            { role: "user", content: structurePrompt },
          ],
          temperature: 0.3,
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
        return new Response(JSON.stringify({ error: "AI request timed out. Please try again." }), {
          status: 504, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeout);
    }

    if (!aiResp.ok) {
      const status = aiResp.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required for AI service." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway error: ${status}`);
    }

    const aiData = await aiResp.json();
    let rawContent = aiData.choices?.[0]?.message?.content || "";

    // Strip think tags, code fences, and leading/trailing noise
    rawContent = rawContent.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    rawContent = rawContent.replace(/```(?:json)?\s*/g, "").replace(/```/g, "").trim();
    // Remove any leading text before the first {
    const firstBrace = rawContent.indexOf("{");
    if (firstBrace > 0) rawContent = rawContent.slice(firstBrace);
    // Remove any trailing text after the last }
    const lastBrace = rawContent.lastIndexOf("}");
    if (lastBrace >= 0 && lastBrace < rawContent.length - 1) rawContent = rawContent.slice(0, lastBrace + 1);

    let result;
    try {
      result = JSON.parse(rawContent);
    } catch {
      // Try to find the largest JSON object
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          result = JSON.parse(jsonMatch[0]);
        } catch {
          console.error("JSON parse retry failed. Raw content (first 500 chars):", rawContent.slice(0, 500));
          return new Response(JSON.stringify({ error: "AI returned malformed data. Please try again." }), {
            status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        console.error("No JSON found in response. Raw content (first 500 chars):", rawContent.slice(0, 500));
        return new Response(JSON.stringify({ error: "AI returned non-JSON response. Please try again." }), {
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
