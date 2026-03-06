const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { context } = await req.json().catch(() => ({ context: '' }));

    const now = new Date().toISOString();

    const prompt = `You are a military intelligence analyst providing REAL-TIME war situation updates for the Iran-Middle East conflict zone. Current time: ${now}

Based on your knowledge of the ongoing geopolitical situation in the Middle East (Iran, Israel, Gulf states, Yemen, Lebanon, Iraq), provide a concise intelligence briefing.

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
      "timestamp": "${now}",
      "source": "Realistic source name (e.g., CENTCOM, Reuters, IRGC Statement, UN OCHA)"
    }
  ],
  "situation_summary": "One paragraph overall situation assessment (3-4 sentences).",
  "threat_level": "ELEVATED|HIGH|SEVERE|CRITICAL",
  "last_updated": "${now}"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'You are a military intelligence analyst. Output only valid JSON. Be realistic and specific.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('AI gateway error:', errText);
      return new Response(JSON.stringify({ error: 'AI service unavailable' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return new Response(JSON.stringify({ error: 'Failed to parse AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('War updates error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
