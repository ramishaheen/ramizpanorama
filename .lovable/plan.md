

# Fix Cyber Immunity Loading — Real Progressive Animation

## Problem
The loading screen uses `sources.length / EXPECTED_SOURCES.length` for progress, but `sources` only populates when the entire fetch completes. So during loading, progress stays at 0% with all sources showing "connecting…" — it looks frozen/stuck on the WAROS logo until data arrives all at once.

## Solution
Replace the source-based progress with a **time-based simulated loading sequence** that progressively checks off sources with staggered delays, giving the feel of real initialization. When actual data arrives, immediately jump to 100% and transition to the map.

### Edit: `src/components/dashboard/CyberImmunityModal.tsx`

1. **Add a `useEffect`-driven simulated progress state** inside the loading block:
   - State: `simulatedStep` (0→10), incremented every ~800ms
   - Each step "connects" the next source in `EXPECTED_SOURCES`
   - Progress bar = `(simulatedStep / EXPECTED_SOURCES.length) * 100`
   - When `loading` becomes false (real data arrived), snap to 100%

2. **Update the source checklist**: Use `simulatedStep` instead of `sources.includes(s)` to determine which sources show as connected — source at index `i` is "connected" when `simulatedStep > i`

3. **Add a cycling status message** that rotates through phrases like "Scanning OSINT feeds…", "Decrypting threat corridors…", "Parsing CVE databases…", "Mapping attack vectors…" every 2 seconds instead of static "Connecting to OSINT feeds…"

This makes the loading feel alive and progressive rather than stuck on the logo.

### Files Changed
- `src/components/dashboard/CyberImmunityModal.tsx` — loading section (lines ~1097-1131)

