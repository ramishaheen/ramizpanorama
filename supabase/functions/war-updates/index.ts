import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
      signal: controller.signal,
    });

    if (response.status === 429) throw new Error("RATE_LIMIT");
    if (response.status === 402) throw new Error("PAYMENT_REQUIRED");

    if (!response.ok) {
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI_UNAVAILABLE");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI_UNAVAILABLE");
    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}

// Map category to geo_alert type
const categoryToGeoType: Record<string, string> = {
  MILITARY: "MILITARY",
  DIPLOMATIC: "DIPLOMATIC",
  HUMANITARIAN: "HUMANITARIAN",
  ECONOMIC: "ECONOMIC",
  AIRSPACE: "MILITARY",
  MARITIME: "MILITARY",
  MISSILE: "MILITARY",
  CIVILIAN: "HUMANITARIAN",
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { context } = await req.json().catch(() => ({ context: '' }));
    const now = new Date().toISOString();

    const prompt = `You are a military intelligence analyst providing REAL-TIME war situation updates for the Iran-Middle East conflict zone. Current time: ${now}

${context ? `Current dashboard data context:\n${context}\n` : ''}

Generate exactly 8 intelligence updates in JSON format. Each update should be realistic, specific, and based on plausible current events in the region. Include a mix of:
- Active military operations and strikes
- Diplomatic developments 
- Humanitarian situations
- Economic/energy impacts
- Missile/drone activity
- Naval movements
- Airspace status
- Civilian safety warnings

CRITICAL: Each update MUST include precise "lat" and "lng" coordinates (as numbers) for the exact location of the event. Use real geographic coordinates for the specified region. Examples:
- Gaza Strip: lat 31.4, lng 34.4
- Tehran: lat 35.7, lng 51.4
- Strait of Hormuz: lat 26.6, lng 56.2
- Southern Lebanon: lat 33.3, lng 35.5
- Red Sea: lat 15.0, lng 42.0
- Riyadh: lat 24.7, lng 46.7
- Baghdad: lat 33.3, lng 44.4

Respond ONLY with valid JSON in this exact format:
{
  "updates": [
    {
      "id": "unique-id",
      "headline": "Short headline (max 80 chars)",
      "body": "Detailed 2-3 sentence update with specific details, locations, and implications.",
      "category": "MILITARY|DIPLOMATIC|HUMANITARIAN|ECONOMIC|AIRSPACE|MARITIME|MISSILE|CIVILIAN",
      "severity": "low|medium|high|critical",
      "region": "Specific region name",
      "lat": 31.4,
      "lng": 34.4,
      "timestamp": "${now}",
      "source": "Realistic source name (e.g., CENTCOM, Reuters, IRGC Statement, UN OCHA)"
    }
  ],
  "situation_summary": "One paragraph overall situation assessment (3-4 sentences).",
  "threat_level": "ELEVATED|HIGH|SEVERE|CRITICAL",
  "last_updated": "${now}"
}`;

    const content = await callAI([
      { role: 'system', content: 'You are a military intelligence analyst. Output only valid JSON. Be realistic and specific. Always include accurate lat/lng coordinates.' },
      { role: 'user', content: prompt },
    ]);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sanitized = jsonMatch[0].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
    let parsed: any;
    try {
      parsed = JSON.parse(sanitized);
    } catch {
      const fixed = sanitized.replace(/,\s*([\]}])/g, '$1');
      parsed = JSON.parse(fixed);
    }

    // Write AI-analyzed updates as geo_alerts to the database for map visualization
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );

      const updates = parsed.updates || [];
      const geoAlerts = updates
        .filter((u: any) => u.lat != null && u.lng != null)
        .map((u: any) => ({
          id: `ai-news-${u.id || Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          type: categoryToGeoType[u.category] || "MILITARY",
          region: u.region || "Unknown",
          title: u.headline || "AI Intelligence Update",
          summary: u.body || "",
          severity: u.severity || "medium",
          source: `AI-NEWS: ${u.source || "Intelligence Analysis"}`,
          timestamp: u.timestamp || now,
          lat: u.lat,
          lng: u.lng,
        }));

      if (geoAlerts.length > 0) {
        // Insert new AI news alerts
        const { error: insertErr } = await supabase.from("geo_alerts").insert(geoAlerts);
        if (insertErr) console.error("Failed to insert AI news geo_alerts:", insertErr);

        // Prune old AI news alerts (keep last 24)
        const { data: oldAiAlerts } = await supabase
          .from("geo_alerts")
          .select("id")
          .like("id", "ai-news-%")
          .order("timestamp", { ascending: false });

        if (oldAiAlerts && oldAiAlerts.length > 24) {
          const toDelete = oldAiAlerts.slice(24).map((a: any) => a.id);
          await supabase.from("geo_alerts").delete().in("id", toDelete);
        }
      }
    } catch (dbErr) {
      console.error("DB write error (non-fatal):", dbErr);
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "RATE_LIMIT") {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (e instanceof Error && e.message === "PAYMENT_REQUIRED") {
      return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
        status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.error('War updates error:', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
