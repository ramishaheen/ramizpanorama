import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEIZURE_KEYWORDS = [
  "this domain has been seized", "this site has been seized",
  "this website has been seized", "seized by the fbi",
  "seized by the united states", "seized by law enforcement",
  "department of justice", "seized pursuant to",
  "this domain name has been seized by ice",
  "seized by europol", "seized by interpol",
  "national crime agency", "law enforcement operation",
  "seized and shut down", "forfeiture order",
  "this hidden site has been seized",
  "bundeskriminalamt", "australian federal police",
  "joint law enforcement operation",
  "this website is now under the control of",
];

const SEIZURE_DNS_INDICATORS = [
  "fbi.seized", "seized.gov", "usssdomainseizure",
  "europol", "justice.gov", "fbi.gov",
];

const LE_RDNS_PATTERNS = [
  "fbi.gov", "justice.gov", "europol.europa.eu",
  "ice.gov", "dhs.gov", "interpol.int",
  "nationalcrimeagency", "bka.de",
];

interface DomainResult {
  domain: string;
  status: "clean" | "seized" | "suspicious" | "unreachable" | "error";
  checks: {
    dns: { status: string; records?: string[]; seizureSignal?: boolean };
    http: { status: string; statusCode?: number; seizureKeywords?: string[]; redirectTarget?: string; serverHeader?: string };
  };
  lastChecked: string;
  seizureEvidence?: string[];
}

async function checkDNS(domain: string): Promise<DomainResult["checks"]["dns"]> {
  try {
    const resp = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`);
    if (!resp.ok) return { status: "error" };
    const data = await resp.json();
    
    const records = (data.Answer || []).map((a: any) => a.data);
    const allRecords = records.join(" ").toLowerCase();
    const seizureSignal = SEIZURE_DNS_INDICATORS.some(ind => allRecords.includes(ind));
    
    if (records.length === 0) {
      return { status: "no_records", seizureSignal: false };
    }
    return { status: "resolved", records, seizureSignal };
  } catch {
    return { status: "error" };
  }
}

async function checkHTTP(domain: string): Promise<DomainResult["checks"]["http"]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const resp = await fetch(`https://${domain}`, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "FBI-Watchdog-WAROS/1.0" },
    });
    clearTimeout(timeout);
    
    const body = await resp.text();
    const bodyLower = body.toLowerCase();
    const seizureKeywords = SEIZURE_KEYWORDS.filter(kw => bodyLower.includes(kw));
    const serverHeader = resp.headers.get("server") || undefined;
    const finalUrl = resp.url;
    
    // Check redirect to gov domains
    const redirectTarget = finalUrl !== `https://${domain}` && finalUrl !== `https://${domain}/`
      ? finalUrl : undefined;
    
    const govRedirect = redirectTarget && (
      redirectTarget.includes(".gov") ||
      redirectTarget.includes("justice.gov") ||
      redirectTarget.includes("fbi.gov") ||
      redirectTarget.includes("europol")
    );
    
    return {
      status: seizureKeywords.length > 0 ? "seized" : govRedirect ? "suspicious" : "clean",
      statusCode: resp.status,
      seizureKeywords: seizureKeywords.length > 0 ? seizureKeywords : undefined,
      redirectTarget,
      serverHeader,
    };
  } catch (e) {
    // Try HTTP fallback
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const resp = await fetch(`http://${domain}`, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "FBI-Watchdog-WAROS/1.0" },
      });
      clearTimeout(timeout);
      const body = await resp.text();
      const bodyLower = body.toLowerCase();
      const seizureKeywords = SEIZURE_KEYWORDS.filter(kw => bodyLower.includes(kw));
      
      return {
        status: seizureKeywords.length > 0 ? "seized" : "clean",
        statusCode: resp.status,
        seizureKeywords: seizureKeywords.length > 0 ? seizureKeywords : undefined,
        serverHeader: resp.headers.get("server") || undefined,
      };
    } catch {
      return { status: "unreachable" };
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { domains } = await req.json();
    
    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return new Response(JSON.stringify({ error: "domains array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit to 20 domains per request
    const toCheck = domains.slice(0, 20).map((d: string) => d.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""));
    
    const results: DomainResult[] = await Promise.all(
      toCheck.map(async (domain: string): Promise<DomainResult> => {
        const [dns, http] = await Promise.all([checkDNS(domain), checkHTTP(domain)]);
        
        const seizureEvidence: string[] = [];
        if (dns.seizureSignal) seizureEvidence.push("DNS seizure indicator detected");
        if (http.seizureKeywords?.length) seizureEvidence.push(...http.seizureKeywords.map(kw => `HTTP: "${kw}"`));
        if (http.redirectTarget?.includes(".gov")) seizureEvidence.push(`Redirects to government domain: ${http.redirectTarget}`);
        
        let status: DomainResult["status"] = "clean";
        if (http.status === "unreachable" && dns.status === "error") status = "unreachable";
        else if (seizureEvidence.length > 0) status = seizureEvidence.length >= 2 ? "seized" : "suspicious";
        else if (http.status === "unreachable") status = "unreachable";
        
        return {
          domain,
          status,
          checks: { dns, http },
          lastChecked: new Date().toISOString(),
          seizureEvidence: seizureEvidence.length > 0 ? seizureEvidence : undefined,
        };
      })
    );

    return new Response(JSON.stringify({ results, checkedAt: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
