

# Enhance Cyber Immunity — More Sources & Factual Data

## Current State
The `cyber-threats` edge function fetches from **5 OSINT sources** (CISA KEV, AlienVault OTX, abuse.ch URLhaus, NIST NVD, CERT-FR). The AI then synthesizes these into structured reports. The issue is the AI prompt allows it to generate speculative incidents rather than strictly basing reports on the real feed data.

## Changes

### 1. Add 5 New OSINT Sources to `cyber-threats/index.ts`
All free, no API keys required:

| Source | URL | What it provides |
|--------|-----|-----------------|
| **abuse.ch ThreatFox** | `https://threatfox-api.abuse.ch/api/v1/` | Live malware IOCs (IPs, domains, hashes) |
| **abuse.ch Feodo Tracker** | `https://feodotracker.abuse.ch/downloads/ipblocklist_recent.json` | Active botnet C2 server IPs |
| **Ransomwatch** | GitHub raw JSON | Active ransomware group leak sites and victims |
| **Cisco Talos Blog RSS** | `https://blog.talosintelligence.com/rss/` | Latest threat research and advisories |
| **BleepingComputer RSS** | `https://www.bleepingcomputer.com/feed/` | Breaking cybersecurity news |

This brings the total to **10 live OSINT sources**.

### 2. Tighten AI Prompt for Factual Output
Update the system prompt to:
- Instruct the AI to **only report incidents found in the provided OSINT data** — no fabrication
- Cross-reference CVEs from NIST/CISA with threat actor attribution from OTX
- Map IOCs from ThreatFox/Feodo to specific campaigns
- Use news from Talos/BleepingComputer RSS for real incident context
- Add a `verified: true/false` field so the UI can badge which reports are source-verified vs AI-correlated

### 3. Update UI Source Indicators
Update `EXPECTED_SOURCES` in `CyberImmunityModal.tsx` to include the 5 new sources so the source health indicators display correctly.

## Files Changed
1. **Edit**: `supabase/functions/cyber-threats/index.ts` — add 5 new fetch calls + tighten AI prompt
2. **Edit**: `src/components/dashboard/CyberImmunityModal.tsx` — update `EXPECTED_SOURCES` array
3. **Edit**: `src/hooks/useCyberThreats.ts` — add `verified` field to `CyberThreat` interface

