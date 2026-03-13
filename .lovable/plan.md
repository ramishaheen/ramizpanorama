

# Remove ENGINES Tab + Upgrade Dark Web CTI Engine

## Overview

Remove the ENGINES tab from Cyber Immunity and transform the Dark Web tab into a full-fledged Cyber Threat Intelligence (CTI) engine with advanced indicator extraction, threat correlation, forum analysis, geographic mapping, and real-time alerting.

## Changes

### 1. Remove ENGINES tab — `CyberImmunityModal.tsx`
- Remove the ENGINES button from the tab bar (line 1089-1091)
- Remove the `centerView === "engines"` render branch (lines 1205-1206)
- Remove the `IntelEnginesPanel` import (line 21)
- Remove `"engines"` from the `centerView` type union (line 889)

### 2. Upgrade Dark Web Edge Function — `supabase/functions/dark-web-intel/index.ts`
Massively expand the AI prompt for dark web monitoring mode to produce a richer intelligence payload:

**New data structure additions:**
- `indicatorExtraction`: structured IOC categories (network: IPs/domains/URLs/ASNs/ports, vulnerability: CVEs/exploits, malware: hashes/families/C2, actors: APT groups/ransomware gangs, financial: crypto wallets)
- `threatCorrelation`: detected attack chains linking CVE → exploit → scanning → early warning patterns
- `forumAnalysis`: classified hacker forum discussions with risk levels (planned attacks, exploit trading, data breach announcements)
- `ransomwareLeaks`: active ransomware leak site monitoring (group name, victim, sector, country, data volume, deadline)
- `threatHeatmap`: country-level density scores for malware infra, botnet activity, vulnerability scanning, ransomware
- `alertRules`: auto-generated real-time alerts (IP spike, ransomware leak, vuln exploitation, botnet expansion) with severity and timestamps
- `dashboardStats`: top attacking/targeted countries, active ransomware groups, most discussed CVEs, largest botnets
- `temporalTrends`: attack trend lines, campaign evolution, actor activity patterns over 4 weeks

Increase entries to 20-30 and add new entry types: `ransomware_leak`, `exploit_trade`, `credential_dump`, `botnet_c2`.

### 3. Expand Dark Web Types — `src/hooks/useDarkWebIntel.ts`
Add new TypeScript interfaces matching the expanded edge function output:
- `IndicatorExtraction` (network, vulnerability, malware, actor, financial sub-objects)
- `ThreatCorrelation` (chain entries with stages and early warning flag)
- `ForumPost` (title, forum, risk_level, category, snippet, timestamp)
- `RansomwareLeak` (group, victim, sector, country, data_size, deadline, status)
- `ThreatHeatmapEntry` (country, scores per category)
- `AlertRule` (type, message, severity, triggered_at)
- `DashboardStats` and `TemporalTrend`
- Update `DarkWebState` to include all new fields

### 4. Rebuild Dark Web UI — `CyberImmunityModal.tsx` (`EnhancedDarkWebMonitor`)
Replace the current simple list view with a multi-section CTI dashboard:

**Layout** — Full-height with a mini tab bar at top for sub-sections:
- **OVERVIEW**: Dashboard stats grid (top attackers, top targets, active ransomware groups, most discussed CVEs, largest botnets) + real-time alert banner strip
- **INDICATORS**: Extracted IOCs organized by category (Network, Vulnerability, Malware, Actors, Financial) with copy-to-clipboard and scan buttons
- **FORUM INTEL**: Classified forum discussions with risk-level badges, sortable by risk/date
- **RANSOMWARE**: Active ransomware leak monitoring table (group, victim, sector, deadline countdown, status)
- **CORRELATION**: Attack chain visualization showing CVE → exploit → scan → warning flow diagrams
- **ENTRIES**: The existing dark web entries list (onion sites, paste sites, etc.) — kept but refined

**Threat Heatmap mini-bar** at top: horizontal country bars colored by aggregate threat density.

**Alert ticker**: Scrolling alert banner for real-time alerts (IP spikes, new ransomware leaks, etc.)

**Temporal sparklines**: Mini trend charts for each intelligence category.

### 5. Update Dark Web Entry Types
Add new entry type labels and icons for: `ransomware_leak` (Lock icon), `exploit_trade` (Zap), `credential_dump` (Key), `botnet_c2` (Server).

## Files Modified
- `src/components/dashboard/CyberImmunityModal.tsx` — remove ENGINES, rebuild Dark Web UI
- `src/hooks/useDarkWebIntel.ts` — expand interfaces and state
- `supabase/functions/dark-web-intel/index.ts` — expand AI prompt for full CTI output

