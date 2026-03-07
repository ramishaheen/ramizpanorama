const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('MINIMAX_API_KEY');
    if (!apiKey) throw new Error('MINIMAX_API_KEY not configured');

    const now = new Date().toISOString();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch('https://api.minimax.chat/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'MiniMax-M2',
          messages: [
            {
              role: 'system',
              content: `You are a conflict data analyst specializing in the Middle East. Generate realistic armed conflict, protest, and violence event data similar to ACLED (Armed Conflict Location & Event Data Project) format.

Return ONLY valid JSON array of 20-30 events with this exact structure per event:
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
  "notes": "1-2 sentence description of the event",
  "source": "news source name"
}

RULES:
- Focus on Middle East: Iran, Iraq, Syria, Yemen, Lebanon, Israel/Palestine, Jordan, Saudi Arabia, UAE, Bahrain
- Include mix: 40% battles/explosions, 20% protests, 15% violence against civilians, 15% riots, 10% strategic developments
- Use realistic coordinates within each country
- Fatalities should be 0 for protests, 0-5 for riots, 1-50 for battles
- Use real actor names: IDF, IRGC, Hezbollah, Hamas, Houthis, SDF, SAA, PMF, coalition forces, etc.
- Dates should be within last 7 days from ${now}
- Be geographically accurate with coordinates`
            },
            {
              role: 'user',
              content: `Generate ACLED-style conflict and protest events for the Middle East region. Current date: ${now}. Include events from the last 7 days across Iran, Iraq, Syria, Yemen, Lebanon, Israel/Palestine, and Gulf states.`
            }
          ],
          temperature: 0.8,
          max_tokens: 4000,
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
      const errText = await response.text();
      console.error('MiniMax error:', response.status, errText);
      throw new Error('AI analysis failed');
    }

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content || '[]';
    const content = stripThinkTags(rawContent);

    let events;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      // Try to find array in the response
      const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
      events = JSON.parse(arrayMatch ? arrayMatch[0] : cleaned);
    } catch {
      console.error('Failed to parse conflict events:', content?.slice(0, 300));
      events = [];
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: events,
        count: events.length,
        lastUpdated: now,
      }),
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
