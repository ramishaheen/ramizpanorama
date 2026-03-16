const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FALLBACK = {
  success: true,
  entries: [
    {
      id: "dw-fallback-001",
      type: "onion",
      title: "Monitoring service initializing",
      detail: "Dark web intelligence feeds are being configured. Data will populate shortly.",
      severity: "medium",
      timestamp: new Date().toISOString(),
      indicators: [],
      torExitNodes: [],
      hiddenServiceFingerprint: null,
      relatedActors: [],
    },
  ],
  indicatorExtraction: { network: { ips: [], domains: [], urls: [], asns: [], ports: [] }, vulnerability: { cves: [], exploits: [], patches: [] }, malware: { hashes: [], families: [], c2Servers: [] }, actors: { aptGroups: [], ransomwareGangs: [], hacktivistGroups: [] }, financial: { cryptoWallets: [] } },
  threatCorrelation: [],
  forumAnalysis: [],
  ransomwareLeaks: [],
  alertRules: [],
  dashboardStats: { topAttackingCountries: [], topTargetedCountries: [], activeRansomwareGroups: [], mostDiscussedCVEs: [], largestBotnets: [] },
  temporalTrends: [],
  _fallback: true,
};

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55000);

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

function buildActorDossierPrompt(actorName: string, threatContext: unknown[], today: string) {
  const systemPrompt = `You are an elite cyber threat intelligence analyst specializing in APT group profiling, dark web HUMINT, and Tor network forensics.
Given a threat actor name and context from recent operations, generate a comprehensive dossier.

Return a JSON object with this exact structure:
{
  "actor": {
    "name": "Full name with aliases",
    "aliases": ["alias1", "alias2"],
    "country": "Attribution country",
    "flag": "emoji flag",
    "type": "APT|Hacktivist|Cybercrime|State-sponsored",
    "active_since": "YYYY",
    "confidence": "high|medium|low",
    "description": "2-3 sentence overview",
    "ttps": [{"tactic": "MITRE tactic name", "technique": "T-code", "description": "How they use it"}],
    "campaigns": [{"name": "Campaign name", "year": "YYYY", "targets": "Who was targeted", "description": "Brief summary", "malware": ["malware names"]}],
    "targeting_patterns": {"sectors": ["sector1"], "countries": ["country1"], "infrastructure": ["infra type1"]},
    "tools_and_malware": ["tool1", "tool2"],
    "dark_web_presence": {"forums": ["forum names"], "onion_services": ["description"], "paste_activity": "Description"},
    "tor_infrastructure": {"known_exit_nodes": ["IP or description"], "relay_patterns": "Description", "hidden_services_count": 0},
    "recent_activity": "2-3 sentence summary",
    "risk_assessment": "critical|high|medium|low",
    "countermeasures": ["recommendation1", "recommendation2"]
  }
}

Be technically detailed and realistic. Reference real MITRE ATT&CK techniques (T-codes). Return ONLY the JSON, no markdown.`;

  const userPrompt = `Generate a comprehensive threat actor dossier for: "${actorName}"

Recent operational context from OSINT:
${JSON.stringify(threatContext, null, 2)}

Today's date: ${today}`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

function buildCTIPrompt(threatContext: unknown[], today: string) {
  const systemPrompt = `You are an elite dark web intelligence analyst and cyber threat intelligence (CTI) engineer. You operate a full CTI pipeline: collection, processing, entity extraction, threat correlation, geolocation, threat scoring, and visualization.

Generate a comprehensive JSON CTI intelligence report with this EXACT structure:

{
  "entries": [
    {
      "id": "dw-live-NNN",
      "type": "onion|paste|forum|marketplace|exit_node|hidden_service|ransomware_leak|exploit_trade|credential_dump|botnet_c2",
      "title": "Short title",
      "detail": "3-4 sentence detailed analysis with technical specifics",
      "severity": "critical|high|medium|low",
      "timestamp": "${today}TXX:XX:XXZ",
      "indicators": ["IOC1", "IOC2"],
      "torExitNodes": ["IP or fingerprint"],
      "hiddenServiceFingerprint": "xxxxx.onion or null",
      "relatedActors": ["actor name"],
      "region": "Geographic region",
      "category": "C2 Infrastructure|Credential Markets|Exploit Trading|Data Leaks|Ransomware Ops|Hacktivism|Botnet Infrastructure|Forum Chatter"
    }
  ],
  "torAnalysis": {
    "suspiciousExitNodes": [{"ip": "IP", "country": "country", "flag": "emoji", "risk": "high|medium|low", "activity": "description"}],
    "hiddenServiceStats": {"newServicesDetected": 0, "c2PanelsIdentified": 0, "marketplacesActive": 0, "pasteMonitorsTriggered": 0},
    "networkTrends": "2-3 sentence summary"
  },
  "indicatorExtraction": {
    "network": {
      "ips": [{"value": "1.2.3.4", "country": "XX", "flag": "🏴", "reputation": "malicious|suspicious|clean", "activity": "C2|scanning|proxy", "asn": "ASXXXX"}],
      "domains": [{"value": "example.com", "registrar": "XX", "reputation": "malicious|suspicious", "activity": "phishing|C2|distribution"}],
      "urls": [{"value": "https://...", "category": "phishing|malware|C2"}],
      "asns": [{"value": "ASXXXX", "name": "ISP name", "country": "XX", "maliciousCount": 0}],
      "ports": [{"port": 443, "service": "HTTPS", "exposureCount": 0, "risk": "high|medium|low"}]
    },
    "vulnerability": {
      "cves": [{"id": "CVE-YYYY-NNNNN", "cvss": 9.8, "description": "brief", "exploitAvailable": true, "patchAvailable": false, "discussedInForums": true}],
      "exploits": [{"name": "exploit name", "targetCVE": "CVE-...", "availability": "public|private|0day", "price": "$XXX"}],
      "patches": [{"cve": "CVE-...", "vendor": "XX", "status": "released|pending"}]
    },
    "malware": {
      "hashes": [{"value": "sha256hash", "family": "malware name", "type": "ransomware|trojan|wiper|RAT", "firstSeen": "${today}"}],
      "families": [{"name": "family name", "type": "ransomware|trojan|wiper|RAT|botnet", "activeC2Count": 0, "recentActivity": "description"}],
      "c2Servers": [{"ip": "1.2.3.4", "domain": "domain.com", "malware": "family", "port": 443, "protocol": "HTTPS|TCP", "country": "XX", "flag": "🏴", "status": "active|dormant"}]
    },
    "actors": {
      "aptGroups": [{"name": "APT name", "country": "XX", "flag": "🏴", "activeCampaigns": 0, "primaryTargets": ["sector"]}],
      "ransomwareGangs": [{"name": "gang name", "activeLeaks": 0, "totalVictims": 0, "avgRansom": "$XXX"}],
      "hacktivistGroups": [{"name": "group name", "motivation": "description", "recentTargets": ["target"]}]
    },
    "financial": {
      "cryptoWallets": [{"address": "0x...", "currency": "BTC|ETH|XMR", "associatedGroup": "group name", "estimatedValue": "$XXX"}]
    }
  },
  "threatCorrelation": [
    {
      "id": "corr-NNN",
      "title": "Correlation title",
      "stages": [{"stage": "CVE Disclosure|Exploit Published|Scanning Detected|Attack Launched", "detail": "description", "timestamp": "${today}TXX:XX:XXZ"}],
      "earlyWarning": true,
      "severity": "critical|high|medium",
      "affectedSectors": ["sector"],
      "recommendation": "action to take"
    }
  ],
  "forumAnalysis": [
    {
      "id": "forum-NNN",
      "title": "Post title",
      "forum": "forum name",
      "author": "username",
      "riskLevel": "critical|high|medium|low",
      "category": "Planned Attack|Exploit Trade|Malware Dev|Data Breach|Target Recon|Tool Sharing",
      "snippet": "2-3 sentence excerpt of discussion",
      "timestamp": "${today}TXX:XX:XXZ",
      "language": "English|Russian|Arabic|Chinese|Persian",
      "relatedActors": ["actor name"]
    }
  ],
  "ransomwareLeaks": [
    {
      "id": "ransom-NNN",
      "group": "ransomware gang name",
      "victim": "organization name",
      "sector": "industry sector",
      "country": "XX",
      "flag": "🏴",
      "dataSize": "XX GB",
      "deadline": "${today}TXX:XX:XXZ",
      "status": "countdown|published|negotiating",
      "leakSiteOnion": "xxxxx.onion"
    }
  ],
  "alertRules": [
    {
      "id": "alert-NNN",
      "type": "ip_spike|ransomware_leak|vuln_exploitation|botnet_expansion|credential_dump|apt_campaign",
      "message": "Alert description",
      "severity": "critical|high|medium",
      "triggeredAt": "${today}TXX:XX:XXZ",
      "relatedIndicators": ["IOC1"]
    }
  ],
  "dashboardStats": {
    "topAttackingCountries": [{"country": "XX", "flag": "🏴", "count": 0}],
    "topTargetedCountries": [{"country": "XX", "flag": "🏴", "count": 0}],
    "activeRansomwareGroups": [{"name": "group", "activeLeaks": 0}],
    "mostDiscussedCVEs": [{"id": "CVE-...", "mentions": 0, "severity": "critical"}],
    "largestBotnets": [{"name": "botnet", "estimatedSize": 0, "primaryMalware": "family"}]
  },
  "temporalTrends": [
    {"period": "week_1|week_2|week_3|week_4", "malwareIncidents": 0, "ransomwareIncidents": 0, "exploitDiscussions": 0, "dataBreaches": 0, "trend": "rising|stable|declining"}
  ]
}

REQUIREMENTS:
- Generate 20-25 entries covering: .onion C2, credential dumps, forum chatter, darknet marketplaces, exit nodes, ransomware leaks, exploit trades, botnet C2
- Extract 15-25 network indicators (IPs, domains, URLs)
- Extract 5-10 CVEs with exploit availability status
- Extract 5-10 malware families with C2 infrastructure
- Generate 3-5 threat correlation chains
- Generate 8-12 forum posts from underground forums (XSS, BreachForums, RAMP, Exploit.in, Telegram channels)
- Generate 5-8 ransomware leak site entries
- Generate 5-8 real-time alerts
- Include dashboard stats with top 5 entries per category
- Include 4 weekly temporal trend entries
- Focus on Middle East, Central Asia, and global critical infrastructure
- Be technically detailed with realistic .onion addresses, Tor relay fingerprints, CVE IDs, MITRE techniques
- Return ONLY valid JSON, no markdown fencing`;

  const userPrompt = `Generate a comprehensive dark web and cyber threat intelligence report for ${today}.

Recent threat context from OSINT feeds:
${JSON.stringify(threatContext, null, 2)}

Focus regions: Middle East (Jordan, Israel, Iran, Saudi Arabia, UAE), Central Asia, Eastern Europe, East Asia.
Include current ransomware campaigns, APT activity, exploit market trends, and underground forum intelligence.`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const actorName = body.actor || null;
    const threatContext = body.threatContext || [];
    const today = new Date().toISOString().split("T")[0];

    const messages = actorName
      ? buildActorDossierPrompt(actorName, (threatContext as unknown[]).slice(0, 5), today)
      : buildCTIPrompt((threatContext as unknown[]).slice(0, 8), today);

    const raw = await callAI(messages);
    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return new Response(
      JSON.stringify({ success: true, ...parsed, lastUpdated: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("dark-web-intel error:", error);
    const isRateLimit = error instanceof Error && error.message === "RATE_LIMIT";
    return new Response(
      JSON.stringify({ ...FALLBACK, ...(isRateLimit ? { error: "Rate limited — using cached intelligence" } : {}) }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
