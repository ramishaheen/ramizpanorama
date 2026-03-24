const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface APTGroup {
  id: string;
  name: string;
  aliases: string[];
  country: string;
  flag: string;
  sponsorship: string;
  active_since: string;
  description: string;
  target_sectors: string[];
  target_countries: string[];
  mitre_techniques: { id: string; name: string; tactic: string }[];
  known_campaigns: { name: string; year: string; description: string }[];
  tools: string[];
  risk_level: "critical" | "high" | "medium" | "low";
  last_activity: string;
  iocs_count: number;
}

const fallbackGroups: APTGroup[] = [
  {
    id: "apt-33", name: "APT33 / Elfin", aliases: ["Elfin", "Magnallium", "Refined Kitten"],
    country: "Iran", flag: "🇮🇷", sponsorship: "IRGC-affiliated", active_since: "2013",
    description: "Iranian state-sponsored group targeting aviation, energy, and petrochemical sectors.",
    target_sectors: ["Aviation", "Energy", "Petrochemical", "Defense"],
    target_countries: ["Saudi Arabia", "USA", "South Korea", "Israel"],
    mitre_techniques: [
      { id: "T1566", name: "Phishing", tactic: "Initial Access" },
      { id: "T1059", name: "Command and Scripting Interpreter", tactic: "Execution" },
      { id: "T1486", name: "Data Encrypted for Impact", tactic: "Impact" },
    ],
    known_campaigns: [
      { name: "Shamoon 2.0", year: "2016-2017", description: "Destructive wiper attacks against Saudi Arabian organizations" },
      { name: "Stonedrill", year: "2017", description: "Advanced wiper malware targeting Middle East energy sector" },
    ],
    tools: ["Shamoon", "Stonedrill", "Turnedup", "POWERTON", "RULER"],
    risk_level: "critical", last_activity: "2026-03", iocs_count: 342,
  },
];

async function callAI(messages: Array<{ role: string; content: string }>) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "moonshotai/kimi-k2-thinking", messages }),
      signal: controller.signal,
    });

    if (response.status === 429 || response.status === 402) throw new Error("RATE_LIMIT");
    if (!response.ok) throw new Error("AI_UNAVAILABLE");

    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const raw = await callAI([
      {
        role: 'system',
        content: `You are a cybersecurity intelligence analyst specializing in Advanced Persistent Threat (APT) groups.
Generate a JSON array of 12-16 APT groups that are currently active in cyber operations, focusing on the Middle East theater and global cyber warfare.

Each entry MUST have ALL these fields:
- id: lowercase kebab-case like "apt-33"
- name: full name with common alias, e.g. "APT33 / Elfin"
- aliases: array of known aliases
- country: attribution country
- flag: emoji flag
- sponsorship: "state-sponsored", "IRGC-affiliated", "GRU Unit 74455", etc.
- active_since: year string
- description: 2-3 sentence overview of the group
- target_sectors: array of 3-6 sectors
- target_countries: array of 3-6 countries
- mitre_techniques: array of 4-6 objects with {id, name, tactic} (use real MITRE ATT&CK IDs like T1566, T1059, etc.)
- known_campaigns: array of 2-4 objects with {name, year, description}
- tools: array of 5-8 known malware/tools
- risk_level: "critical", "high", "medium", or "low"
- last_activity: ISO month like "2026-03"
- iocs_count: realistic number of known IOCs

Include groups from: Iran (APT33, APT34, APT35, MuddyWater), Russia (APT28, APT29, Sandworm), China (APT41, Volt Typhoon), North Korea (Lazarus, Kimsuky), Israel (Unit 8200), and others active in the region.

Use REAL, accurate MITRE ATT&CK technique IDs and names. Use real campaign names and malware names.
Return ONLY the JSON array, no markdown.`
      },
      { role: 'user', content: `Generate comprehensive APT group intelligence profiles as of ${new Date().toISOString().split('T')[0]}. Focus on groups active in Middle East cyber operations and global threats.` }
    ]);

    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const groups = JSON.parse(cleaned);

    return new Response(JSON.stringify({ success: true, data: groups, lastUpdated: new Date().toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('APT intel error:', err);
    return new Response(JSON.stringify({ success: true, data: fallbackGroups, lastUpdated: new Date().toISOString(), _fallback: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
