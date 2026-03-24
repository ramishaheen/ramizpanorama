import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;
const DOMAIN_REGEX = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
const HASH_REGEX = /^[a-fA-F0-9]{32,128}$/;

function detectIOCType(indicator: string): "IPv4" | "domain" | "hash" | "unknown" {
  if (IP_REGEX.test(indicator)) return "IPv4";
  if (HASH_REGEX.test(indicator)) return "hash";
  if (DOMAIN_REGEX.test(indicator)) return "domain";
  return "unknown";
}

async function fetchJSON(url: string, timeout = 8000): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
  finally { clearTimeout(t); }
}

async function fetchThreatFox(searchTerm: string): Promise<any> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const r = await fetch("https://threatfox-api.abuse.ch/api/v1/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "search_ioc", search_term: searchTerm }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function fetchFeodoTracker(ip: string): Promise<any> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const r = await fetch("https://feodotracker.abuse.ch/downloads/ipblocklist.json", {
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    const list = await r.json();
    if (!Array.isArray(list)) return null;
    const matches = list.filter((e: any) => e.ip_address === ip);
    return matches.length > 0 ? matches : null;
  } catch { return null; }
}

async function fetchMalwareBazaar(hash: string): Promise<any> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const hashType = hash.length <= 32 ? "md5_hash" : hash.length <= 40 ? "sha1_hash" : "sha256_hash";
    const r = await fetch("https://mb-api.abuse.ch/api/v1/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `query=get_info&hash=${hash}`,
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function computeThreatScore(shodan: any, threatfox: any, feodo: any, malwareBazaar: any): number {
  let score = 10;
  if (shodan) {
    score += Math.min((shodan.ports?.length || 0) * 3, 25);
    score += Math.min((shodan.vulns?.length || 0) * 10, 40);
  }
  if (threatfox?.query_status === "ok" && threatfox?.data?.length > 0) score += 30;
  if (feodo && feodo.length > 0) score += 35;
  if (malwareBazaar?.query_status === "ok" && malwareBazaar?.data?.length > 0) score += 40;
  return Math.min(score, 100);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ioc } = await req.json();
    if (!ioc || typeof ioc !== "string" || ioc.trim().length < 3) {
      return new Response(JSON.stringify({ error: "Invalid IOC input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const indicator = ioc.trim();
    const iocType = detectIOCType(indicator);

    if (iocType === "unknown") {
      return new Response(JSON.stringify({ error: "Unsupported IOC format. Enter an IPv4 address, domain name, or file hash (MD5/SHA1/SHA256)." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let shodan: any = null;
    let geoData: any = null;
    let threatfox: any = null;
    let feodo: any = null;
    let malwareBazaar: any = null;

    if (iocType === "IPv4") {
      [shodan, geoData, threatfox, feodo] = await Promise.all([
        fetchJSON(`https://internetdb.shodan.io/${indicator}`),
        fetchJSON(`http://ip-api.com/json/${indicator}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting,query`),
        fetchThreatFox(indicator),
        fetchFeodoTracker(indicator),
      ]);
    } else if (iocType === "domain") {
      [threatfox, shodan] = await Promise.all([
        fetchThreatFox(indicator),
        fetchJSON(`https://internetdb.shodan.io/${indicator}`),
      ]);
    } else if (iocType === "hash") {
      [threatfox, malwareBazaar] = await Promise.all([
        fetchThreatFox(indicator),
        fetchMalwareBazaar(indicator),
      ]);
    }

    const threatScore = computeThreatScore(shodan, threatfox, feodo, malwareBazaar);

    const result: any = {
      ioc: indicator,
      type: iocType,
      timestamp: new Date().toISOString(),
      threatScore,
      geolocation: geoData && geoData.status === "success" ? {
        country: geoData.country, countryCode: geoData.countryCode,
        region: geoData.regionName, city: geoData.city,
        lat: geoData.lat, lon: geoData.lon,
        isp: geoData.isp, org: geoData.org,
        as: geoData.as, asName: geoData.asname,
        isProxy: geoData.proxy, isHosting: geoData.hosting, isMobile: geoData.mobile,
      } : null,
      shodan: shodan && !shodan.detail ? {
        ports: shodan.ports || [], hostnames: shodan.hostnames || [],
        cpes: shodan.cpes || [], vulns: shodan.vulns || [], tags: shodan.tags || [],
      } : null,
      threatfox: threatfox?.query_status === "ok" && threatfox?.data?.length > 0 ? {
        found: true,
        matches: (threatfox.data || []).slice(0, 5).map((m: any) => ({
          malware: m.malware_printable || m.malware,
          threat_type: m.threat_type_desc || m.threat_type,
          confidence: m.confidence_level,
          first_seen: m.first_seen_utc, last_seen: m.last_seen_utc,
          tags: m.tags,
        })),
      } : { found: false, matches: [] },
      feodoTracker: feodo ? {
        found: true,
        matches: feodo.slice(0, 5).map((m: any) => ({
          malware: m.malware, port: m.dst_port,
          first_seen: m.first_seen, last_online: m.last_online, status: m.status,
        })),
      } : { found: false, matches: [] },
      malwareBazaar: malwareBazaar?.query_status === "ok" && malwareBazaar?.data?.length > 0 ? {
        found: true,
        matches: (malwareBazaar.data || []).slice(0, 3).map((m: any) => ({
          fileName: m.file_name, fileType: m.file_type,
          signature: m.signature, tags: m.tags,
          firstSeen: m.first_seen, lastSeen: m.last_seen,
        })),
      } : { found: false, matches: [] },
    };

    // AI enrichment
    const apiKey = Deno.env.get("NVIDIA_API_KEY");
    if (apiKey) {
      try {
        const dataLines = [`Threat Score: ${threatScore}/100`, `IOC Type: ${iocType}`];
        if (result.geolocation) dataLines.push(`Geolocation: ${result.geolocation.city}, ${result.geolocation.country} (ISP: ${result.geolocation.isp}, Org: ${result.geolocation.org})`);
        if (result.shodan) {
          dataLines.push(`Open Ports: ${result.shodan.ports.join(", ") || "None"}`);
          dataLines.push(`CVEs: ${result.shodan.vulns.join(", ") || "None"}`);
        }
        if (result.threatfox.found) dataLines.push(`ThreatFox: MATCH - ${result.threatfox.matches.map((m: any) => m.malware).join(", ")}`);
        if (result.feodoTracker.found) dataLines.push(`Feodo: MATCH - ${result.feodoTracker.matches.map((m: any) => m.malware).join(", ")}`);
        if (result.malwareBazaar?.found) dataLines.push(`MalwareBazaar: MATCH - ${result.malwareBazaar.matches.map((m: any) => m.signature || m.fileName).join(", ")}`);

        const aiPrompt = `You are a senior cyber threat analyst. Analyze this IOC (${iocType}: ${indicator}).

DATA:
${dataLines.join("\n")}

Provide your response in this exact format:
VERDICT: [CLEAN / SUSPICIOUS / MALICIOUS]
RISK: [LOW / MEDIUM / HIGH / CRITICAL]
SUMMARY: [2-3 sentence assessment]
RECOMMENDATIONS: [1-2 actionable recommendations]`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const aiResp = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "moonshotai/kimi-k2-thinking", messages: [{ role: "user", content: aiPrompt }] }),
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (aiResp.ok) {
          const aiData = await aiResp.json();
          result.aiAnalysis = aiData.choices?.[0]?.message?.content?.trim() || null;
        }
      } catch (e) {
        console.error("AI enrichment error:", e);
        result.aiAnalysis = null;
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("IOC lookup error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
