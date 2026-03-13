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
  actorDossiers: {},
  _fallback: true,
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
      body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages }),
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const actorName = body.actor || null;
    const threatContext = body.threatContext || [];

    const today = new Date().toISOString().split("T")[0];

    let systemPrompt: string;
    let userPrompt: string;

    if (actorName) {
      // Actor dossier mode
      systemPrompt = `You are an elite cyber threat intelligence analyst specializing in APT group profiling, dark web HUMINT, and Tor network forensics.
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
    "ttps": [
      {"tactic": "MITRE tactic name", "technique": "T-code", "description": "How they use it"}
    ],
    "campaigns": [
      {"name": "Campaign name", "year": "YYYY", "targets": "Who was targeted", "description": "Brief summary", "malware": ["malware names"]}
    ],
    "targeting_patterns": {
      "sectors": ["sector1", "sector2"],
      "countries": ["country1", "country2"],
      "infrastructure": ["infra type1", "infra type2"]
    },
    "tools_and_malware": ["tool1", "tool2"],
    "dark_web_presence": {
      "forums": ["forum names"],
      "onion_services": ["description of hidden services"],
      "paste_activity": "Description of paste site usage"
    },
    "tor_infrastructure": {
      "known_exit_nodes": ["IP or description"],
      "relay_patterns": "Description of Tor relay usage",
      "hidden_services_count": 0
    },
    "recent_activity": "2-3 sentence summary of latest operations",
    "risk_assessment": "critical|high|medium|low",
    "countermeasures": ["recommendation1", "recommendation2"]
  }
}

Be technically detailed and realistic. Reference real MITRE ATT&CK techniques (T-codes). Return ONLY the JSON, no markdown.`;

      userPrompt = `Generate a comprehensive threat actor dossier for: "${actorName}"

Recent operational context from OSINT:
${JSON.stringify(threatContext.slice(0, 5), null, 2)}

Today's date: ${today}`;
    } else {
      // Dark web monitoring mode
      systemPrompt = `You are a dark web intelligence analyst specializing in Tor network forensics, hidden service enumeration, and underground marketplace monitoring.

Generate a JSON object with this structure:
{
  "entries": [
    {
      "id": "dw-live-001",
      "type": "onion|paste|forum|marketplace|exit_node|hidden_service",
      "title": "Short title",
      "detail": "3-4 sentence detailed analysis with technical specifics",
      "severity": "critical|high|medium|low",
      "timestamp": "${today}T00:00:00Z",
      "indicators": ["IOC1", "IOC2"],
      "torExitNodes": ["IP or fingerprint"],
      "hiddenServiceFingerprint": "onion address or null",
      "relatedActors": ["actor name"],
      "region": "Geographic region",
      "category": "C2 Infrastructure|Credential Markets|Exploit Trading|Data Leaks|Ransomware Ops|Hacktivism"
    }
  ],
  "torAnalysis": {
    "suspiciousExitNodes": [
      {"ip": "IP", "country": "country", "flag": "emoji", "risk": "high|medium|low", "activity": "description"}
    ],
    "hiddenServiceStats": {
      "newServicesDetected": 0,
      "c2PanelsIdentified": 0,
      "marketplacesActive": 0,
      "pasteMonitorsTriggered": 0
    },
    "networkTrends": "2-3 sentence summary of Tor network patterns"
  }
}

Generate 15-20 entries covering:
- .onion C2 infrastructure (APT33, APT34, Lazarus, Sandworm)
- Credential dumps on paste sites (targeting Middle East infrastructure)
- Underground forum chatter about new exploits/tooling
- Darknet marketplace listings for initial access
- Suspicious Tor exit node activity near critical infrastructure
- Ransomware-as-a-Service operations
- Hidden service fingerprinting results

Be technically detailed. Include realistic .onion addresses (use xxxxx.onion format), Tor relay fingerprints, and underground forum names. Return ONLY JSON, no markdown.`;

      userPrompt = `Generate comprehensive dark web intelligence report for ${today}.

Recent threat context from OSINT feeds:
${JSON.stringify(threatContext.slice(0, 8), null, 2)}`;
    }

    const raw = await callAI([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);

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
      JSON.stringify(isRateLimit ? { ...FALLBACK, error: "Rate limited — using cached intelligence" } : FALLBACK),
      {
        status: isRateLimit ? 429 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
