

# Crisis Intelligence Overlay — Build Plan

## Overview

A new "CRISIS INTEL" button in the IntelMap toolbar opens a full-screen modal with a 2D Leaflet street map featuring AI-powered anomaly detection. The system fuses existing data sources (WarsLeaks/Telegram intel, war updates, traffic intel, weather) with Lovable AI NLP analysis to detect evacuation patterns, protests, road closures, and abnormal activity across Middle East cities.

## Architecture

```text
┌─────────────────────────────────────────────┐
│  Frontend: CrisisIntelModal.tsx             │
│  ┌─────────┐  ┌──────────┐  ┌────────────┐ │
│  │ Leaflet  │  │ Side     │  │ Timeline   │ │
│  │ 2D Map   │  │ Panel    │  │ Slider     │ │
│  │ +overlays│  │ (alerts) │  │ +replay    │ │
│  └─────────┘  └──────────┘  └────────────┘ │
│        ↑                                     │
│  useCrisisIntel.ts hook                      │
│        ↑                                     │
│  Edge Function: crisis-intel                 │
│  (fuses sources + AI NLP + scoring)          │
└─────────────────────────────────────────────┘
```

## Files to Create

### 1. `supabase/functions/crisis-intel/index.ts` — Backend Edge Function

Responsibilities:
- Accept `{ city: string }` parameter (Middle East city selector)
- Fetch existing data: invoke `telegram-intel` cached markers, `war-updates` data, `traffic-intel` weather/time factors
- Scrape WarsLeaks Telegram posts (reuse existing scraper pattern)
- Send all collected data to Lovable AI (gemini-3-flash-preview) with a structured NLP prompt that:
  - Extracts entities (roads, districts, facilities)
  - Classifies events (protest, evacuation, closure, disruption, incident, rumor)
  - Assigns confidence scores (0-100) using the weighted formula (35% corroboration, 20% reliability, 20% traffic anomaly, 15% geographic agreement, 10% recency)
  - Geocodes locations to lat/lng
  - Returns anomaly zones as polygons (bbox arrays) or point+radius
- Use tool calling to extract structured JSON output
- Return array of `CrisisEvent` objects with: id, type, lat, lng, polygon, confidence, label, sources, affectedRoads, district, trend, timestamp
- Cache results for 3 minutes in-memory
- Handle 429/402 errors

### 2. `src/hooks/useCrisisIntel.ts` — Frontend Hook

- Accepts selected city
- Calls `crisis-intel` edge function via `supabase.functions.invoke`
- Polls every 3 minutes
- Maintains historical snapshots array for timeline replay
- Returns: events, loading, error, history, refresh

### 3. `src/components/dashboard/CrisisIntelModal.tsx` — Main Modal (~800 lines)

Full-screen overlay modal containing:

**Left: 2D Leaflet Map**
- OpenStreetMap tile layer (street map)
- Overlay layers rendered as Leaflet polygons/polylines/circles:
  - **Evacuation**: Animated outward-flow arrows (polylines with arrowheads) on major roads, blue color
  - **Protests**: Semi-transparent red/orange heat-zone polygons over districts
  - **Road closures**: Red dashed polyline segments on blocked roads
  - **Abnormal activity**: Pulsing amber circle zones
  - **Incidents**: Red circle markers with pulse animation
- Confidence controls overlay transparency (low=faint, high=opaque)
- Clickable zones open detail popup

**Top: Layer Toggle Bar**
- Toggle buttons for: Traffic, Incidents, Evacuation, Protests, Abnormal Activity, Road Closures
- City selector dropdown (Middle East cities: Baghdad, Tehran, Beirut, Damascus, Amman, Riyadh, Dubai, Cairo, Sanaa, Gaza)
- Confidence filter slider (0-100 threshold)

**Right: Side Panel**
- Latest alerts list (sorted by confidence desc)
- Each alert card shows: type icon, headline, confidence badge (low/med/high), source count, affected district, timestamp
- Clicking an alert flies map to that location
- Trend sparkline per alert (confidence over time from history)
- Source summary section

**Bottom: Timeline Slider**
- Reuse pattern from existing TimelineSlider component
- Scrub through historical snapshots
- Play/pause replay mode

### 4. Update `src/components/dashboard/IntelMap.tsx`

- Add `showCrisisIntel` state
- Add "CRISIS INTEL" button in the toolbar (after RESPONSE MAP), using `Brain` or `AlertTriangle` icon with amber color
- Render `<CrisisIntelModal>` when open

### 5. Update `supabase/config.toml`

- Add `[functions.crisis-intel]` with `verify_jwt = false`

## AI Prompt Design (Edge Function)

The edge function sends collected intel + traffic data to Lovable AI with tool calling to extract structured output:

```
Tool: analyze_crisis_events
Parameters:
  events: array of {
    type: enum[protest, evacuation, road_closure, disruption, incident, abnormal_activity, rumor]
    lat, lng, radius_km
    polygon: [[lat,lng]...] (optional)
    headline, summary
    confidence: 0-100
    confidence_label: low|medium|high
    sources: [{name, reliability_tier}]
    affected_roads: string[]
    district: string
    trend: rising|stable|declining
    evacuation_direction: string (optional)
    verified: boolean
  }
```

## Data Flow

1. User selects city → hook calls edge function
2. Edge function fetches: cached telegram markers, weather/traffic factors, and scrapes latest WarsLeaks posts
3. AI processes all sources together, classifies anomalies, computes confidence scores
4. Frontend receives structured events, renders on map
5. Every 3 min: re-fetch, append to history array for timeline replay

## Visualization Mapping

| Event Type | Map Rendering | Color |
|---|---|---|
| Evacuation | Outward arrows on roads | Blue (#3b82f6) |
| Protest | District polygon heatzone | Orange (#f97316) |
| Road Closure | Dashed blocked segment | Red (#ef4444) |
| Abnormal Activity | Pulsing circle | Amber (#f59e0b) |
| Incident | Marker with pulse | Red (#dc2626) |
| Disruption | Corridor overlay | Purple (#8b5cf6) |

Confidence → opacity: `0.2 + (confidence/100) * 0.6`

## Safeguards

- Never display single-source claims as fact
- Always show: source count, confidence level, verification status, last updated
- Rumor/unverified events shown with dashed borders and "UNVERIFIED" label
- Low confidence events hidden by default (threshold slider)

