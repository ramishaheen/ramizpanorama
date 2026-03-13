

# Cyber Immunity — Timeline Slider + Enhanced Live Details

## Changes to `src/components/dashboard/CyberImmunityModal.tsx`

### 1. Timeline Slider (above bottom event feed)
- Add a 24-hour timeline slider bar between the center panel and the bottom feed
- Slider range: `now - 24h` → `now`, with play/pause and speed controls (1×, 2×, 5×)
- Threats are filtered by the selected time window — scrubbing backward hides future events
- When playing, the slider auto-advances and events appear sequentially on the map
- Reuses the same play/pause/speed pattern from the existing `TimelineSlider` component
- Visual: thin horizontal bar with time labels (00:00 → current UTC), tick marks every hour, playhead indicator

### 2. Enhanced Center Panel — Threat Details Overlay
- When a threat is selected (clicked on map, graph, or feed), show a **richer detail card** in the center overlay:
  - Full attacker profile: name, country, flag, known group aliases
  - Full target profile: name, country, flag, infrastructure type
  - Attack vector details: type, CVE with link to NVD, MITRE ATT&CK TTP references
  - IOC list with copy-to-clipboard buttons
  - Source link with favicon
  - Timeline position indicator (when in the 24h window this occurred)
- When **no threat is selected**, the center shows a **live statistics HUD** overlaid on the map:
  - Active incidents counter (pulsing)
  - Last event timestamp
  - Attacks-per-hour sparkline (tiny SVG bar chart, last 24 hours)

### 3. Live Indicators
- Add a pulsing red "● LIVE" badge in the top bar when viewing real-time (slider at max)
- When slider is rewound to a past position, badge changes to "◷ REPLAY" in yellow
- Auto-refresh indicator: small rotating icon when data is being fetched
- Event feed auto-scrolls to newest when in LIVE mode

### 4. Fill Missing Data Gaps
- Add "No data" placeholder states for empty sections (IOCs, CVEs, sources)
- When threats array is empty but not loading, show an informative "Awaiting intelligence data — OSINT feeds initializing" message with a list of expected sources
- Add fallback country coordinates for any unrecognized countries (hash-based deterministic placement on map instead of random)

## No new files or dependencies needed. Single file edit to `CyberImmunityModal.tsx`.

