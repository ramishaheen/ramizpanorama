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

    // Return cache if fresh
    if (cachedResult && cachedResult.key === cacheKey && Date.now() - cachedResult.ts < CACHE_TTL) {
      return new Response(JSON.stringify({ ...cachedResult.data, _cached: true, _cached_at: new Date(cachedResult.ts).toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      // Fallback to cache even if stale
      if (cachedResult) {
        return new Response(JSON.stringify({ ...cachedResult.data, _cached: true, _stale: true, _cached_at: new Date(cachedResult.ts).toISOString() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Perplexity API not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const structurePrompt = `Analyze social media sentiment about "${topic}" in "${country}".
DATE RANGE: ${date_range} | PLATFORMS: ${platforms.join(", ")} | LANGUAGE: ${language} | SAMPLE TARGET: ${max_posts}

Search for recent social media posts, news articles, and public discussions about this topic in this country. Analyze the sentiment breakdown.

Return ONLY valid JSON with this exact structure:
{
  "query": { "country": "${country}", "topic": "${topic}", "date_range": "${date_range}", "platforms": ${JSON.stringify(platforms)} },
  "collection_summary": { "posts_collected": <number>, "posts_used": <number>, "country_match_confidence": "high"|"medium"|"low", "sampling_note": "Sampled from public online discussion via web search." },
  "sentiment_summary": { "with_percent": <number>, "against_percent": <number>, "neutral_percent": <number>, "unclear_percent": <number>, "overall_label": "With"|"Against"|"Neutral"|"Mixed", "overall_confidence": "high"|"medium"|"low" },
  "diagram_data": {
    "pie": [{"label":"With","value":<n>},{"label":"Against","value":<n>},{"label":"Neutral","value":<n>},{"label":"Unclear","value":<n>}],
    "bar": [${platforms.map(p => `{"label":"${p}","with":0,"against":0,"neutral":0,"unclear":0}`).join(",")}],
    "trend": [{"date":"day1","with":0,"against":0,"neutral":0},{"date":"day2","with":0,"against":0,"neutral":0},{"date":"day3","with":0,"against":0,"neutral":0},{"date":"day4","with":0,"against":0,"neutral":0},{"date":"day5","with":0,"against":0,"neutral":0},{"date":"day6","with":0,"against":0,"neutral":0},{"date":"day7","with":0,"against":0,"neutral":0}]
  },
  "themes": [{"theme":"<theme>","share":<percent>}],
  "sample_insights": [{"theme":"<theme>","summary":"<sentence>","confidence":"high"|"medium"|"low"}],
  "ui_box": { "title": "Country Sentiment", "country": "${country}", "topic": "${topic}", "headline_result": "<label>", "headline_percent": <n>, "sample_size": <n>, "confidence": "<level>", "warning": "Sampled from public online sources only." }
}

Fill in realistic numbers based on actual web search results. All percentages must sum to 100. Populate bar chart per-platform and trend data with plausible daily values.`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);

    let resp;
    try {
      resp = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${PERPLEXITY_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            { role: "system", content: "You are a social media sentiment analyst. Return ONLY valid JSON. No markdown, no code fences, no explanatory text." },
            { role: "user", content: structurePrompt },
          ],
          temperature: 0.2,
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      console.error("Perplexity fetch error:", fetchErr);
      // Fallback to stale cache
      if (cachedResult) {
        return new Response(JSON.stringify({ ...cachedResult.data, _cached: true, _stale: true, _cached_at: new Date(cachedResult.ts).toISOString() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({
        error: "Request timed out",
        sentiment_summary: { with_percent: 40, against_percent: 35, neutral_percent: 20, unclear_percent: 5, overall_label: "Mixed", overall_confidence: "low" },
        query: { country: body.country || "Unknown", topic: body.topic || "Unknown", date_range: date_range, platforms },
        collection_summary: { posts_collected: 0, posts_used: 0, country_match_confidence: "low", sampling_note: "Fallback data — API timed out" },
        diagram_data: { pie: [{ label: "With", value: 40 }, { label: "Against", value: 35 }, { label: "Neutral", value: 20 }, { label: "Unclear", value: 5 }], bar: platforms.map(p => ({ label: p, with: 10, against: 9, neutral: 5, unclear: 1 })), trend: [{ date: "day1", with: 40, against: 35, neutral: 20 }] },
        themes: [{ theme: "Timeout fallback", share: 100 }],
        sample_insights: [{ theme: "Notice", summary: "Data unavailable — showing placeholder. Please retry.", confidence: "low" }],
        ui_box: { title: "Fallback", country: body.country || "Unknown", topic: body.topic || "Unknown", headline_result: "Mixed", headline_percent: 40, sample_size: 0, confidence: "low", warning: "Timeout fallback data" },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!resp.ok) {
      const status = resp.status;
      const errText = await resp.text();
      console.error("Perplexity error:", status, errText);
      // Fallback to stale cache on any error
      if (cachedResult) {
        return new Response(JSON.stringify({ ...cachedResult.data, _cached: true, _stale: true, _cached_at: new Date(cachedResult.ts).toISOString() }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const fallback = {
        query: { country, topic, date_range, platforms },
        collection_summary: { posts_collected: 0, posts_used: 0, country_match_confidence: "low", sampling_note: "Fallback — API quota exceeded" },
        sentiment_summary: { with_percent: 40, against_percent: 35, neutral_percent: 20, unclear_percent: 5, overall_label: "Mixed", overall_confidence: "low" },
        diagram_data: {
          pie: [{ label: "With", value: 40 }, { label: "Against", value: 35 }, { label: "Neutral", value: 20 }, { label: "Unclear", value: 5 }],
          bar: platforms.map((p: string) => ({ label: p, with: 10, against: 9, neutral: 5, unclear: 1 })),
          trend: Array.from({ length: 7 }, (_, i) => ({ date: `day${i + 1}`, with: 38 + Math.round(Math.random() * 4), against: 33 + Math.round(Math.random() * 4), neutral: 18 + Math.round(Math.random() * 4) })),
        },
        themes: [{ theme: "General discussion", share: 60 }, { theme: "Policy debate", share: 40 }],
        sample_insights: [{ theme: "Notice", summary: "Showing estimated data — live analysis temporarily unavailable.", confidence: "low" }],
        ui_box: { title: "Sentiment Overview", country, topic, headline_result: "Mixed", headline_percent: 40, sample_size: 0, confidence: "low", warning: "Estimated data — API quota reached" },
        _fallback: true,
      };
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await resp.json();
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
          if (cachedResult) {
            return new Response(JSON.stringify({ ...cachedResult.data, _cached: true, _stale: true, _cached_at: new Date(cachedResult.ts).toISOString() }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          return new Response(JSON.stringify({ error: "AI returned malformed data. Please try again." }), {
            status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        if (cachedResult) {
          return new Response(JSON.stringify({ ...cachedResult.data, _cached: true, _stale: true, _cached_at: new Date(cachedResult.ts).toISOString() }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
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
    // Final fallback
    if (cachedResult) {
      return new Response(JSON.stringify({ ...cachedResult.data, _cached: true, _stale: true, _cached_at: new Date(cachedResult.ts).toISOString() }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
