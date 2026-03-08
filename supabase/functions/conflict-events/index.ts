const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

    return new Response(
      JSON.stringify({ success: true, data: events, count: events.length, lastUpdated: now }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Conflict events error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error', data: [] }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
