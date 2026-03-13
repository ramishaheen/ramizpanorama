

# Cyber Intelligence Map (CIM) — Feature Enhancement Plan

## Context

The Cyber Immunity modal already has a strong foundation: live OSINT threat map, relationship graph, dark web monitoring, actor dossiers, timeline playback, and AI analysis. The user wants to expand it into a full NATO/Palantir-class cyber intelligence platform.

**Important constraints**: This is a React/Vite/Tailwind frontend with Supabase Edge Functions. No Next.js, no Elasticsearch, no Neo4j, no Python. All "integrations" with GitHub tools (SpiderFoot, OpenCTI, etc.) will be represented as intelligence source modules with links and status indicators — not actual running instances.

## Plan

### 1. New Tabs in the Center View
Currently 3 tabs: MAP, GRAPH, DARK WEB. Add 4 more:

- **LAYERS** — Toggleable intelligence layers on the threat map (DDoS, Ransomware, APT Campaigns, Botnet, Malware Spread, Zero-Day, Darknet Scanners, Vulnerability Scanning). Each layer filters/highlights threats by type with distinct colors.
- **APT INTEL** — APT group intelligence panel showing group name, country attribution, MITRE ATT&CK mapping, target sectors, known campaigns. Data derived from existing threat data + AI enrichment via a new `apt-intel` edge function.
- **TIMELINE** — Full-width incident timeline with cards for major attacks, malware campaigns, nation-state activity (enhances the existing bottom feed into a dedicated visual timeline view).
- **ENGINES** — "Integrated Intelligence Engines" panel listing the 5 GitHub tools (SpiderFoot, OpenCTI, Raven, Global Threat Map, Threat Intel MCP) with descriptions, repo links, docs links, and live/simulated status indicators.

### 2. Enhanced Map Layers System
Add a layer toggle panel overlay on the threat map (similar to the main dashboard's LayerControls):
- Global Attack Activity (default ON)
- Botnet Activity (filter by Feodo C2 data)
- Malware Spread (filter by ThreatFox IOCs)
- APT Campaigns (filter by APT-attributed threats)
- DDoS Activity
- Ransomware Activity (filter by Ransomwatch data)
- Zero-Day Exploits (filter by CVE-tagged threats)

Each layer toggles visibility of relevant corridors/nodes on the existing SVG map with distinct color coding.

### 3. Dashboard Stats Enhancement (Right Panel)
Add to the existing right panel:
- **Global Cyber Threat Level** gauge (already exists, enhance with animated ring)
- **Top Attacking Countries** ranked list with bar chart
- **Most Targeted Countries** ranked list
- **Top Malware Families** from ThreatFox data
- **Most Active Botnets** from Feodo Tracker data
- **Active Ransomware Campaigns** from Ransomwatch

### 4. Search Enhancement (Left Panel)
Extend existing search to explicitly support:
- IP address lookup
- Domain search
- Malware name search
- APT group search
- Country search
Already partially works; add search type chips/hints and highlight matching fields.

### 5. APT Intelligence Edge Function
New edge function `apt-intel` that uses AI to generate structured APT group profiles:
- Group name, aliases, country attribution
- MITRE ATT&CK technique mapping
- Target sectors and countries
- Known campaigns with dates
- Tool arsenal

### 6. Alert System
Add an alert banner system that detects and displays:
- Large attack spikes (>5 critical in current window)
- New ransomware campaigns (from Ransomwatch)
- Mass scanning detected (concentrated source patterns)
- APT activity detected

These show as animated alert banners below the top bar.

### 7. GitHub Intelligence Engines Panel
Dedicated "ENGINES" tab with cards for each tool:
- SpiderFoot — OSINT reconnaissance
- OpenCTI — Threat intelligence platform
- Raven — Cyber threat map
- Global Threat Map — Attack visualization
- Threat Intel MCP — MCP-based threat feeds

Each card: icon, name, description, GitHub link button, docs link, status indicator (simulated as "Connected" with green dot).

## Files Changed

1. **Edit**: `src/components/dashboard/CyberImmunityModal.tsx`
   - Add 4 new center view tabs (LAYERS, APT INTEL, TIMELINE, ENGINES)
   - Add `MapLayersOverlay` component with toggleable intelligence layers
   - Add `APTIntelPanel` component for APT group intelligence cards
   - Add `IncidentTimeline` component for visual timeline view
   - Add `IntelEnginesPanel` component for GitHub tool listings
   - Enhance right panel with malware families, botnets, ransomware stats
   - Add `CyberAlertBanner` component for spike/campaign alerts
   - Enhance search with type chips

2. **Create**: `supabase/functions/apt-intel/index.ts`
   - Edge function using AI to generate APT group profiles from OSINT data
   - Returns structured APT data with MITRE ATT&CK mappings

3. **Edit**: `src/hooks/useCyberThreats.ts`
   - Add helper function to extract malware families, botnet names, ransomware groups from threat data

4. **Edit**: `src/index.css`
   - Add alert banner animation keyframes

