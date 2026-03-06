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
      return new Response(
        JSON.stringify({ success: false, error: 'AI gateway not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch from multiple free OSINT sources
    const osintData = await fetchOSINTData();

    // Use AI to analyze and structure the threat data
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'system',
            content: `You are a cybersecurity intelligence analyst specializing in Middle East cyber warfare. 
Given OSINT data about recent cyber incidents, generate a structured JSON array of the latest cyber operations 
involving Israel, USA, Iran, and Arab countries (UAE, Saudi Arabia, Qatar, Jordan, Bahrain, etc).

Each entry must have these fields:
- id: unique string like "cy-live-001"
- date: ISO date string (YYYY-MM-DD), use today's date (${new Date().toISOString().split('T')[0]}) or recent dates
- attacker: name with unit/group in parentheses
- attackerFlag: emoji flag of attacking country
- target: target description
- targetFlag: emoji flag of target country
- type: one of "SCADA/ICS Attack", "Signal Intelligence", "Electronic Warfare", "Network Disruption", "Financial Disruption", "Information Operations", "Critical Infrastructure", "Espionage", "Wiper Malware", "Offensive Cyber", "Counter-Intelligence", "Defensive/Counter-IO", "Defensive", "Ransomware", "Supply Chain", "Zero-Day Exploit", "DDoS Attack", "Phishing Campaign"
- severity: one of "critical", "high", "medium", "low"
- description: one-line summary (under 120 chars)
- details: 2-3 sentence detailed analysis with technical specifics
- source: URL to a real news source if available, omit if not

Generate 8-12 realistic, plausible cyber incidents based on the OSINT context provided. 
Make them technically detailed and realistic. Focus on the Iran-Israel-US cyber front.
Return ONLY the JSON array, no markdown formatting.`
          },
          {
            role: 'user',
            content: `Here is recent OSINT cyber threat data to analyze and expand upon:\n\n${JSON.stringify(osintData, null, 2)}\n\nGenerate structured cyber incident reports based on this intelligence context.`
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('AI Gateway error:', errText);
      return new Response(
        JSON.stringify({ success: false, error: 'AI analysis failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '[]';
    
    // Parse the AI response - clean up markdown code blocks if present
    let threats;
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      threats = JSON.parse(cleaned);
    } catch {
      console.error('Failed to parse AI response:', content);
      threats = [];
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: threats,
        lastUpdated: new Date().toISOString(),
        sources: osintData.sources || []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in cyber-threats:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchOSINTData() {
  const results: { cisaAlerts: any[]; sources: string[] } = {
    cisaAlerts: [],
    sources: [],
  };

  // Fetch CISA Known Exploited Vulnerabilities (free, no API key)
  try {
    const cisaRes = await fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', {
      signal: AbortSignal.timeout(5000),
    });
    if (cisaRes.ok) {
      const cisaData = await cisaRes.json();
      // Get latest 10 vulnerabilities
      results.cisaAlerts = (cisaData.vulnerabilities || []).slice(0, 10).map((v: any) => ({
        cve: v.cveID,
        vendor: v.vendorProject,
        product: v.product,
        name: v.vulnerabilityName,
        dateAdded: v.dateAdded,
        description: v.shortDescription,
      }));
      results.sources.push('CISA KEV Catalog');
    }
  } catch (e) {
    console.warn('CISA fetch failed:', e);
  }

  // Fetch from AlienVault OTX public pulses (no API key needed for public)
  try {
    const otxRes = await fetch('https://otx.alienvault.com/api/v1/pulses/activity?limit=10&page=1', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (otxRes.ok) {
      const otxData = await otxRes.json();
      const pulses = (otxData.results || []).slice(0, 10).map((p: any) => ({
        name: p.name,
        description: p.description?.substring(0, 200),
        created: p.created,
        tags: p.tags?.slice(0, 5),
        targetedCountries: p.targeted_countries,
      }));
      if (pulses.length > 0) {
        results.cisaAlerts.push(...pulses);
        results.sources.push('AlienVault OTX');
      }
    }
  } catch (e) {
    console.warn('OTX fetch failed:', e);
  }

  // Add current geopolitical context for AI
  results.cisaAlerts.push({
    context: 'Middle East Cyber Warfare - March 2026',
    actors: ['Israel Unit 8200', 'Iran APT33/APT34/MuddyWater/Charming Kitten', 'US Cyber Command', 'UAE DarkMatter', 'Saudi NCA'],
    activeConflicts: ['Iran-Israel tensions', 'Houthi maritime attacks', 'Syria cyber operations'],
    recentTargets: ['SCADA/ICS systems', 'Banking infrastructure', 'Military C2 networks', 'Water treatment', 'Oil/gas facilities'],
  });

  return results;
}
