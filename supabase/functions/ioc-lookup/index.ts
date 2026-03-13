import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

async function fetchJSON(url: string, timeout = 8000): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeout);
  try {
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchThreatFox(ip: string): Promise<any> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);
    const r = await fetch("https://threatfox-api.abuse.ch/api/v1/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "search_ioc", search_term: ip }),
      signal: controller.signal,
    });
    clearTimeout(t);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
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
  } catch {
    return null;
  }
}

function computeThreatScore(shodan: any, threatfox: any, feodo: any): number {
  let score = 10; // baseline

  if (shodan) {
    const ports = shodan.ports?.length || 0;
    const vulns = shodan.vulns?.length || 0;
    score += Math.min(ports * 3, 25);
    score += Math.min(vulns * 10, 40);
  }

  if (threatfox?.query_status === "ok" && threatfox?.data?.length > 0) {
    score += 30;
  }

  if (feodo && feodo.length > 0) {
    score += 35;
  }

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
    const isIP = IP_REGEX.test(indicator);

    if (!isIP) {
      return new Response(JSON.stringify({ error: "Currently only IPv4 addresses are supported for live lookup." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Query all sources in parallel
    const [shodan, geoData, threatfox, feodo] = await Promise.all([
      fetchJSON(`https://internetdb.shodan.io/${indicator}`),
      fetchJSON(`http://ip-api.com/json/${indicator}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting,query`),
      fetchThreatFox(indicator),
      fetchFeodoTracker(indicator),
    ]);

    const threatScore = computeThreatScore(shodan, threatfox, feodo);

    // Build structured result
    const result: any = {
      ioc: indicator,
      type: "IPv4",
      timestamp: new Date().toISOString(),
      threatScore,
      geolocation: geoData && geoData.status === "success" ? {
        country: geoData.country,
        countryCode: geoData.countryCode,
        region: geoData.regionName,
        city: geoData.city,
        lat: geoData.lat,
        lon: geoData.lon,
        isp: geoData.isp,
        org: geoData.org,
        as: geoData.as,
        asName: geoData.asname,
        isProxy: geoData.proxy,
        isHosting: geoData.hosting,
        isMobile: geoData.mobile,
      } : null,
      shodan: shodan && !shodan.detail ? {
        ports: shodan.ports || [],
        hostnames: shodan.hostnames || [],
        cpes: shodan.cpes || [],
        vulns: shodan.vulns || [],
        tags: shodan.tags || [],
      } : null,
      threatfox: threatfox?.query_status === "ok" && threatfox?.data?.length > 0 ? {
        found: true,
        matches: (threatfox.data || []).slice(0, 5).map((m: any) => ({
          malware: m.malware_printable || m.malware,
          threat_type: m.threat_type_desc || m.threat_type,
          confidence: m.confidence_level,
          first_seen: m.first_seen_utc,
          last_seen: m.last_seen_utc,
          tags: m.tags,
        })),
      } : { found: false, matches: [] },
      feodoTracker: feodo ? {
        found: true,
        matches: feodo.slice(0, 5).map((m: any) => ({
          malware: m.malware,
          port: m.dst_port,
          first_seen: m.first_seen,
          last_online: m.last_online,
          status: m.status,
        })),
      } : { found: false, matches: [] },
    };

    // AI enrichment
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (apiKey) {
      try {
        const aiPrompt = `You are a senior cyber threat analyst. Analyze this IOC data for IP ${indicator} and provide a concise threat assessment.

DATA:
- Threat Score: ${threatScore}/100
- Geolocation: ${result.geolocation ? `${result.geolocation.city}, ${result.geolocation.country} (ISP: ${result.geolocation.isp}, Org: ${result.geolocation.org}, AS: ${result.geolocation.as})` : "Unknown"}
- Proxy: ${result.geolocation?.isProxy || "unknown"}, Hosting: ${result.geolocation?.isHosting || "unknown"}
- Open Ports: ${result.shodan?.ports?.join(", ") || "None detected"}
- CVEs: ${result.shodan?.vulns?.join(", ") || "None detected"}
- CPEs: ${result.shodan?.cpes?.join(", ") || "None"}
- ThreatFox: ${result.threatfox.found ? `MATCH - ${result.threatfox.matches.map((m: any) => m.malware).join(", ")}` : "No match"}
- Feodo Tracker: ${result.feodoTracker.found ? `MATCH - ${result.feodoTracker.matches.map((m: any) => m.malware).join(", ")}` : "No match"}

Provide your response in this exact format:
VERDICT: [CLEAN / SUSPICIOUS / MALICIOUS]
RISK: [LOW / MEDIUM / HIGH / CRITICAL]
SUMMARY: [2-3 sentence assessment of the IP, its likely purpose, and threat level]
RECOMMENDATIONS: [1-2 actionable recommendations]`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [{ role: "user", content: aiPrompt }],
          }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (aiResp.ok) {
          const aiData = await aiResp.json();
          const aiContent = aiData.choices?.[0]?.message?.content || "";
          result.aiAnalysis = aiContent.trim();
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
