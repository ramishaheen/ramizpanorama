

# Enhance Event Feed with Live DB Data + Situation-Adaptive Kill Chain

## Problem
1. **FEED tab** in Gotham 4D relies mostly on hardcoded `emulatedEvents` — no real database data from `intel_events` or `geo_alerts` tables
2. **Kill Chain F2T2EA modal** shows identical generic actions regardless of event type — should adapt phases to the situation (airstrike vs cyber vs maritime vs nuclear etc.)

## Changes

### 1. Feed: Pull real `intel_events` + `geo_alerts` into `unifiedFeed` (`FourDMap.tsx`)

- Import and fetch from `intel_events` and `geo_alerts` tables (with 30s polling) alongside existing conflict/earthquake/geo-fusion sources
- Map DB rows into the unified feed format (id, ts, type, label, lat, lng, severity, color, source, icon)
- Keep `emulatedEvents` as fallback/seed data but prioritize DB events
- De-duplicate by checking for overlapping coordinates + timestamps

### 2. Kill Chain: Situation-adaptive F2T2EA actions (`KillChainPanel.tsx`)

Replace the static `F2T2EA_ACTIONS` with a function that generates phase-specific actions based on the event's `event_type` and `severity`. Categories:

- **KINETIC** (airstrike, strike, explosion, rocket, missile): Emphasize BDA, collateral damage, re-strike assessment
- **MARITIME** (naval, vessel, maritime, interdiction): Boarding party, coast guard coordination, vessel tracking
- **CYBER** (cyber, hack, breach): Isolate network, forensic analysis, attribution
- **NUCLEAR/WMD** (centrifuge, nuclear, chemical): IAEA notification, contamination radius, CBRN protocols
- **SIGINT/EW** (GPS jamming, SIGINT, EW): Direction-finding, spectrum analysis, counter-EW
- **CIVIL UNREST** (protest, gathering): Force protection, de-escalation, crowd monitoring
- **DEFAULT**: Current generic actions as fallback

Each category customizes all 6 phases with relevant terminology, platforms, and procedures.

### 3. Feed event → Kill Chain integration

Add a small "⚡ CHAIN" button on each feed event card in the FEED tab that opens the kill chain modal directly from the event feed (passes event data to `KillChainPanel` or opens the F2T2EA modal inline).

## Files Modified
- `src/components/dashboard/FourDMap.tsx` — Add DB fetch for intel_events/geo_alerts into unifiedFeed, add "CHAIN" button on feed items
- `src/components/dashboard/KillChainPanel.tsx` — Replace static F2T2EA_ACTIONS with situation-adaptive action generator

