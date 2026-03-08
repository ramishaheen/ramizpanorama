const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

let cachedEvents: any[] = [];
let eventsCacheTs = 0;
const EVENTS_CACHE_TTL_MS = 180_000;

const fallbackConflictEvents = [
  {
    id: "fallback-001",
    event_date: new Date().toISOString().split("T")[0],
    event_type: "Strategic developments",
    sub_event_type: "military readiness",
    actor1: "Regional Armed Forces",
    actor2: null,
    country: "Jordan",
    admin1: "Amman",
    location: "Amman",
    lat: 31.95,
    lng: 35.93,
    fatalities: 0,
    severity: "medium",
    notes: "Heightened readiness and monitoring across critical nodes.",
    source: "Operational fallback"
  }
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

    const now = new Date().toISOString();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response;
    try {
      response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: `You are a conflict data analyst specializing in the Middle East. Generate realistic armed conflict, protest, and violence event data similar to ACLED format.

Return ONLY valid JSON array of 20-30 events with this structure per event:
{
  "id": "acled-001",
  "event_date": "YYYY-MM-DD",
  "event_type": "Battles|Explosions/Remote violence|Violence against civilians|Protests|Riots|Strategic developments",
  "sub_event_type": "specific sub-type",
  "actor1": "name of primary actor",
  "actor2": "name of secondary actor or null",
  "country": "country name",
  "admin1": "province/state",
  "location": "city or specific location name",
  "lat": number,
  "lng": number,
  "fatalities": number,
  "severity": "low|medium|high|critical",
  "notes": "1-2 sentence description",
  "source": "news source name"
}

RULES:
- Focus on Middle East: Iran, Iraq, Syria, Yemen, Lebanon, Israel/Palestine, Jordan, Saudi Arabia, UAE, Bahrain
- Mix: 40% battles/explosions, 20% protests, 15% violence against civilians, 15% riots, 10% strategic developments
- Use realistic coordinates. Fatalities: 0 for protests, 0-5 riots, 1-50 battles
- Use real actor names: IDF, IRGC, Hezbollah, Hamas, Houthis, SDF, SAA, PMF
- Dates within last 7 days from ${now}`
            },
            {
              role: 'user',
              content: `Generate ACLED-style conflict events for the Middle East. Current date: ${now}.`
            }
          ],
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      if (response.status === 429 || response.status === 402) {
        const cached = cachedEvents.length > 0 && Date.now() - eventsCacheTs < EVENTS_CACHE_TTL_MS ? cachedEvents : fallbackConflictEvents;
        return new Response(JSON.stringify({ success: true, data: cached, count: cached.length, lastUpdated: now, _fallback: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errText = await response.text();
      console.error('AI gateway error:', response.status, errText);
      throw new Error('AI analysis failed');
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '[]';

    let events;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      events = JSON.parse(arrayMatch ? arrayMatch[0] : cleaned);
    } catch {
      console.error('Failed to parse conflict events:', rawContent?.slice(0, 300));
      events = [];
    }

    cachedEvents = Array.isArray(events) ? events : [];
    eventsCacheTs = Date.now();

    return new Response(
      JSON.stringify({ success: true, data: cachedEvents, count: cachedEvents.length, lastUpdated: now }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Conflict events error:', error);
    const cached = cachedEvents.length > 0 && Date.now() - eventsCacheTs < EVENTS_CACHE_TTL_MS ? cachedEvents : fallbackConflictEvents;
    return new Response(
      JSON.stringify({ success: true, data: cached, count: cached.length, lastUpdated: new Date().toISOString(), _fallback: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
