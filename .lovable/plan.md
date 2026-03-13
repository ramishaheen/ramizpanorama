

# Cyber Immunity — Full-Page Intelligence Command Center

## Overview
Add a "Cyber Immunity" button next to "Live Channels" in the dashboard header that opens a full-screen Palantir-style cyber intelligence operations center.

## Layout
```text
┌──────────────────────────────────────────────────────────────┐
│ TOP: CYBER IMMUNITY · Live Status · Sources · Refresh · X   │
│ THREAT LEVEL BAR: Global level · Severity counts · Map/Graph│
├────────────┬─────────────────────────────┬───────────────────┤
│ LEFT 272px │  CENTER (flex-1)            │ RIGHT 272px       │
│            │                             │                   │
│ • IOC      │  SVG Threat Map             │ • AI Threat Score │
│   Search   │  (animated attack arcs,     │ • Anomaly Alerts  │
│ • Country  │   pulsing country nodes)    │ • Top Actors      │
│   Filters  │  OR                         │ • Attack Timeline │
│ • Severity │  Relationship Graph         │ • Recent IOCs     │
│   Filters  │  (force-layout SVG)         │                   │
│ • Stats    │                             │                   │
│ • Types    │                             │                   │
│ • Sources  │                             │                   │
├────────────┴─────────────────────────────┴───────────────────┤
│ BOTTOM 176px: Real-time scrolling event feed                 │
└──────────────────────────────────────────────────────────────┘
```

## Files

### Create: `src/components/dashboard/CyberImmunityModal.tsx`
Full-screen modal rendered via `createPortal` to `document.body` at z-index 99999 (per project convention).

**Center Panel — Threat Map (SVG)**
- Equirectangular projection with animated dashed arc lines from attacker → target country
- Pulsing nodes sized by incident count, colored by severity
- Toggle to switch to a Relationship Graph (SVG circular force layout connecting actors, targets, and attack types)

**Left Panel — Intelligence Tools**
- IOC search bar (filters threats by IP, CVE, domain, actor name)
- Country filter buttons (same set as existing CyberSecurityAlerts)
- Severity filter (critical/high/medium/low/all)
- Stats: top attacker, top target, attack type breakdown with counts
- Active OSINT sources list with live indicators

**Right Panel — AI Analytics**
- Global threat level gauge (CRITICAL/HIGH/ELEVATED/MODERATE based on incident counts)
- Severity breakdown with counts
- Anomaly detection alerts (elevated critical volume, concentrated offensives, sustained targeting, zero-day exploitation)
- Top threat actors ranked list with bar visualization
- Severity bar chart sparkline
- Recent IOCs list

**Bottom Panel — Event Feed**
- Scrolling real-time feed of all filtered cyber incidents
- Color-coded severity dots, attacker → target with flags, description, severity badge
- Click event to open detail overlay with full description, IOCs, CVEs, source links

**Data Source**: Reuses existing `useCyberThreats` hook + `cyber-threats` edge function. No new backend needed.

### Edit: `src/components/dashboard/DashboardHeader.tsx`
- Import `ShieldAlert` from lucide-react and `CyberImmunityModal`
- Add `showCyberImmunity` state
- Insert button between "Live Channels" and "4D Map" with `ShieldAlert` icon, cyan/green cyber theme styling
- Render `{showCyberImmunity && <CyberImmunityModal onClose={() => setShowCyberImmunity(false)} />}`

