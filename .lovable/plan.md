

# Add Live IOC/IP Lookup to Cyber Immunity

## Problem
The "IOC / Threat Search" input in the left panel is only a text filter for existing threats. It doesn't actually query real threat intelligence databases when you type an IP like `185.234.218.91`.

## Solution
Build a real **IOC Lookup** feature with a dedicated edge function that queries multiple free OSINT APIs for live intelligence on any IP, domain, or hash.

## Architecture

### New Edge Function: `supabase/functions/ioc-lookup/index.ts`
Queries these free, no-API-key-needed sources in parallel:
- **AbuseIPDB via abuse.ch ThreatFox** — checks if IP is a known malware IOC
- **abuse.ch Feodo Tracker** — checks if IP is a known botnet C2
- **VirusTotal** (via existing feeds) — cross-references with known threat data
- **Shodan InternetDB** (`https://internetdb.shodan.io/{ip}`) — free, no key needed, returns open ports, vulns, hostnames
- **IPinfo/ip-api.com** (`http://ip-api.com/json/{ip}`) — free geolocation + ASN data
- **AI enrichment** — uses Lovable AI to synthesize a threat assessment from all gathered data

Returns structured result: geolocation, open ports, CVEs, malware associations, threat score, and AI analysis.

### UI Changes: `CyberImmunityModal.tsx`
Replace the simple search input area with an enhanced IOC Lookup section:
- Input field with a **SCAN** button (not just filter-on-type)
- When submitted, calls the edge function and shows a results card below
- Results card shows: threat score gauge, geolocation, open ports, associated malware, CVEs, ASN info, and AI assessment
- The existing text-filter functionality stays (typing without clicking SCAN still filters)
- Loading state with scanning animation

### Hook: `src/hooks/useIOCLookup.ts`
Simple hook wrapping the edge function call with loading/error/data state.

## File Changes

1. **New**: `supabase/functions/ioc-lookup/index.ts` — Edge function querying Shodan InternetDB + ip-api + ThreatFox + Feodo + AI enrichment
2. **New**: `src/hooks/useIOCLookup.ts` — Hook for IOC lookup state
3. **Edit**: `src/components/dashboard/CyberImmunityModal.tsx` — Add SCAN button next to search input, add IOC results card in left panel below search
4. **Edit**: `supabase/config.toml` — Add `[functions.ioc-lookup]` with `verify_jwt = false`

