const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const fallbackCyberThreats = {
  success: true,
  data: [
    {
      id: "cy-fallback-001",
      date: new Date().toISOString().split("T")[0],
      attacker: "Unknown Regional Actor",
      attackerCountry: "Unknown",
      attackerFlag: "🏴",
      target: "Critical infrastructure",
      targetCountry: "Multiple",
      targetFlag: "🌐",
      type: "Network Disruption",
      severity: "medium",
      description: "Elevated probing activity detected across public-facing systems.",
      details: "Fallback intelligence mode active. Monitoring continues using recent OSINT patterns.",
      source: "",
      sourceName: "Fallback Intelligence",
      cve: "",
      iocs: [],
    },
  ],
  lastUpdated: new Date().toISOString(),
  sources: ["Fallback Intelligence"],
  _fallback: true,
};

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

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

    if (response.status === 429 || response.status === 402) throw new Error("RATE_LIMIT");
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const osintData = await fetchAllOSINTData();

    let threats;
    try {
      const raw = await callAI([
        {
          role: 'system',
          content: `You are a cybersecurity intelligence analyst specializing in Middle East and global cyber warfare.
Given OSINT data from multiple credible cybersecurity sources, generate a structured JSON array of the latest cyber operations and threats.

Each entry MUST have ALL these fields:
- id: unique string like "cy-live-001"  
- date: ISO date (YYYY-MM-DD), use today (${new Date().toISOString().split('T')[0]}) or very recent dates
- attacker: name with unit/group in parentheses, e.g. "Iran (APT33/Elfin)"
- attackerCountry: full country name, e.g. "Iran"
- attackerFlag: emoji flag
- target: target description
- targetCountry: full country name of target, e.g. "Israel"
- targetFlag: emoji flag
- type: one of "SCADA/ICS Attack", "Signal Intelligence", "Electronic Warfare", "Network Disruption", "Financial Disruption", "Information Operations", "Critical Infrastructure", "Espionage", "Wiper Malware", "Offensive Cyber", "Counter-Intelligence", "Defensive", "Ransomware", "Supply Chain", "Zero-Day Exploit", "DDoS Attack", "Phishing Campaign"
- severity: one of "critical", "high", "medium", "low"
- description: one-line summary (under 150 chars)
- details: 3-4 sentence detailed analysis with technical specifics (CVEs, malware names, TTPs)
- source: URL to a real news source if available, empty string if not
- sourceName: short name like "CISA", "BleepingComputer", "The Record", etc.
- cve: relevant CVE ID if applicable, empty string if not
- iocs: array of up to 3 indicators of compromise (IPs, domains, hashes) - can be empty array

Generate 12-18 realistic, technically detailed cyber incidents. Cover:
- Iran-Israel cyber front (APT33, APT34, Unit 8200, MuddyWater)
- US Cyber Command operations
- Gulf state operations (UAE, Saudi Arabia, Qatar, Bahrain, Oman, Jordan)
- Jordanian NCSC cyber defense operations and threat landscape
- Bahraini and Omani critical infrastructure monitoring (oil/gas, telecom, banking)
- Russian and Chinese cyber espionage in the region
- Ransomware groups targeting Middle East infrastructure
- Hacktivist operations (Anonymous, IT Army, etc.)

Return ONLY the JSON array, no markdown.`
        },
        {
          role: 'user',
          content: `Here is the latest OSINT intelligence from multiple credible cybersecurity sources:\n\n${JSON.stringify(osintData, null, 2)}\n\nGenerate comprehensive structured cyber incident reports.`
        }
      ]);

      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      threats = JSON.parse(cleaned);
    } catch (aiErr) {
      console.error('AI analysis failed:', aiErr);
      // Return enriched fallback with OSINT data directly
      return new Response(JSON.stringify({
        ...fallbackCyberThreats,
        lastUpdated: new Date().toISOString(),
        sources: osintData.sources,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: threats,
        lastUpdated: new Date().toISOString(),
        sources: osintData.sources,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in cyber-threats:', error);
    return new Response(
      JSON.stringify(fallbackCyberThreats),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchAllOSINTData() {
  const results: {
    cisaAlerts: any[];
    otxPulses: any[];
    abuseChThreats: any[];
    nistCves: any[];
    certAlerts: any[];
    sources: string[];
  } = {
    cisaAlerts: [],
    otxPulses: [],
    abuseChThreats: [],
    nistCves: [],
    certAlerts: [],
    sources: [],
  };

  // All fetches run in parallel
  const fetches = await Promise.allSettled([
    // 1. CISA Known Exploited Vulnerabilities
    fetch('https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', {
      signal: AbortSignal.timeout(8000),
    }).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      results.cisaAlerts = (data.vulnerabilities || []).slice(0, 15).map((v: any) => ({
        cve: v.cveID, vendor: v.vendorProject, product: v.product,
        name: v.vulnerabilityName, dateAdded: v.dateAdded,
        description: v.shortDescription, dueDate: v.dueDate,
        knownRansomware: v.knownRansomwareCampaignUse,
      }));
      results.sources.push('CISA KEV');
    }),

    // 2. AlienVault OTX Threat Pulses
    fetch('https://otx.alienvault.com/api/v1/pulses/activity?limit=15&page=1', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    }).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      results.otxPulses = (data.results || []).slice(0, 15).map((p: any) => ({
        name: p.name, description: p.description?.substring(0, 300),
        created: p.created, modified: p.modified,
        tags: p.tags?.slice(0, 8),
        targetedCountries: p.targeted_countries,
        adversary: p.adversary,
        tlp: p.tlp,
        indicatorCount: p.indicator_count,
        malwareFamilies: p.malware_families?.slice(0, 5),
        attackIds: p.attack_ids?.slice(0, 5),
      }));
      results.sources.push('AlienVault OTX');
    }),

    // 3. abuse.ch Recent Threats (URLhaus)
    fetch('https://urlhaus-api.abuse.ch/v1/urls/recent/limit/15/', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
    }).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      results.abuseChThreats = (data.urls || []).slice(0, 15).map((u: any) => ({
        url: u.url, status: u.url_status,
        threat: u.threat, tags: u.tags,
        dateAdded: u.date_added, reporter: u.reporter,
      }));
      results.sources.push('abuse.ch URLhaus');
    }),

    // 4. NIST NVD Recent Critical CVEs
    fetch(`https://services.nvd.nist.gov/rest/json/cves/2.0?resultsPerPage=10&cvssV3Severity=CRITICAL&pubStartDate=${getRecentDate(14)}T00:00:00.000`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    }).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      results.nistCves = (data.vulnerabilities || []).slice(0, 10).map((v: any) => ({
        cve: v.cve?.id,
        description: v.cve?.descriptions?.find((d: any) => d.lang === 'en')?.value?.substring(0, 300),
        published: v.cve?.published,
        cvssScore: v.cve?.metrics?.cvssMetricV31?.[0]?.cvssData?.baseScore,
        cvssVector: v.cve?.metrics?.cvssMetricV31?.[0]?.cvssData?.vectorString,
        weaknesses: v.cve?.weaknesses?.map((w: any) => w.description?.[0]?.value).filter(Boolean),
      }));
      results.sources.push('NIST NVD');
    }),

    // 5. CERT-FR Alerts RSS (via JSON proxy)
    fetch('https://www.cert.ssi.gouv.fr/feed/', {
      signal: AbortSignal.timeout(8000),
    }).then(async (res) => {
      if (!res.ok) return;
      const text = await res.text();
      // Extract titles from RSS
      const titles = [...text.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)].slice(0, 8).map(m => m[1]);
      const dates = [...text.matchAll(/<pubDate>(.*?)<\/pubDate>/g)].slice(0, 8).map(m => m[1]);
      results.certAlerts = titles.map((t, i) => ({ title: t, date: dates[i] || '' }));
      if (titles.length > 0) results.sources.push('CERT-FR');
    }),
  ]);

  // Add contextual intelligence
  results.cisaAlerts.push({
    context: 'Middle East Cyber Warfare Intelligence Context - March 2026',
    actors: [
      'Israel Unit 8200', 'Israel Unit 8100',
      'Iran APT33/Elfin', 'Iran APT34/OilRig', 'Iran MuddyWater', 'Iran Charming Kitten/APT35',
      'US Cyber Command', 'US NSA TAO',
      'UAE DarkMatter/Edge Group',
      'Saudi NCA (National Cybersecurity Authority)',
      'Russia Fancy Bear/APT28', 'Russia Sandworm',
      'China APT41', 'China Volt Typhoon',
    ],
    activeConflicts: [
      'Iran-Israel cyber escalation',
      'Houthi maritime disruption operations',
      'Syria/Lebanon cyber operations',
      'Gulf state cyber espionage campaigns',
    ],
    recentTargets: [
      'SCADA/ICS systems', 'Banking/SWIFT infrastructure', 'Military C2 networks',
      'Water treatment facilities', 'Oil/gas SCADA', 'Telecommunications',
      'Government ministries', 'Healthcare systems', 'Aviation systems',
    ],
    ttps: ['T1190 - Exploit Public-Facing Application', 'T1566 - Phishing', 'T1059 - Command and Scripting Interpreter',
      'T1486 - Data Encrypted for Impact', 'T1498 - Network Denial of Service'],
  });

  return results;
}

function getRecentDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}
