

# Interactive Map Summary — Crucix Intelligence Integration

## Overview

Add an "INTERACTIVE MAP" tab to the Cyber Immunity modal (next to MAP, GRAPH, DARK WEB, APT INTEL, TIMELINE) that renders a full Crucix-style intelligence summary dashboard. This dashboard will aggregate 4 live data sources (FRED, NASA FIRMS, EIA, AISStream) into a single interactive D3 world map with economic indicators, fire detections, energy prices, and vessel tracking.

## Architecture

```text
CyberImmunityModal
├── MAP | GRAPH | DARK WEB | APT INTEL | TIMELINE | INTERACTIVE MAP  ← new tab
│
└── InteractiveMapSummary (new component)
    ├── D3 World Map (SVG) with marker layers
    │   ├── 🔥 Fire/thermal detections (FIRMS)
    │   ├── 🚢 Maritime vessel positions (AISStream)
    │   ├── 📰 Geo-tagged news (RSS feeds)
    │   └── ☢ Nuclear sites (static overlay)
    ├── Economic Sidebar
    │   ├── FRED indicators (VIX, yield curve, CPI, fed funds)
    │   ├── EIA energy prices (WTI, Brent, NatGas)
    │   └── Risk gauges
    ├── Live Ticker (news headlines)
    └── Signal Summary (cross-source correlations)
```

## Secrets to Add

Four new secrets need to be stored via `add_secret`:
1. **FRED_API_KEY** — `5bd0d1e300c0489ecd7e5e93ea57ba78`
2. **FIRMS_MAP_KEY** — `2147b86253f09d46d08508d372ea2f6c`
3. **EIA_API_KEY** — `DO0PMe8h7zWX7UyD5NbSbOsj6VCH4AflOlUkWl05`
4. **AISSTREAM_API_KEY** — `d8d5634ac353c69b8964001971a518ff7124e325`

## New Edge Functions (4)

### 1. `supabase/functions/crucix-fred/index.ts`
Proxies FRED API calls to `api.stlouisfed.org/fred`. Fetches 21 key series (VIX, yield curve, CPI, unemployment, M2, fed funds, gold, oil, mortgage, USD index). Returns structured indicators with latest values, labels, and momentum.

### 2. `supabase/functions/crucix-firms/index.ts`
Fetches from NASA FIRMS using the real key: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{KEY}/VIIRS_SNPP_NRT/{bbox}/{days}`. Queries 6 conflict hotspots (Middle East, Ukraine, Iran, Sudan/Horn, Myanmar, South Asia) in parallel, parses CSV, returns fire detections with FRP, lat/lng, confidence, day/night classification.

### 3. `supabase/functions/crucix-eia/index.ts`
Queries EIA v2 API for WTI/Brent crude, Henry Hub natural gas, and US crude inventories. Returns latest prices with recent history for sparklines.

### 4. `supabase/functions/crucix-ais/index.ts`
Connects to AISStream WebSocket-style API or REST snapshot for vessel positions in key maritime chokepoints (Hormuz, Suez, Malacca, Bab el-Mandeb, Taiwan Strait, Bosphorus, Panama). Returns vessel positions with type classification.

## Existing Edge Function Updates

### `supabase/functions/nasa-wildfires/index.ts`
Update to use the real `FIRMS_MAP_KEY` secret instead of the hardcoded placeholder string `"FIRMS_MAP_KEY"`.

## New React Components

### `src/components/dashboard/InteractiveMapSummary.tsx`
Full Crucix-inspired Jarvis HUD containing:
- **D3 SVG world map** using existing `worldMapPaths.ts` data with zoom/pan, 7 marker types (fires, vessels, chokepoints, nuclear, SDR, news, OSINT)
- **Region filter buttons** (World, Americas, Europe, Middle East, Asia Pacific, Africa) with smooth viewport transitions
- **Economic panel** — FRED indicators displayed as a compact grid with sparklines, color-coded by trend direction
- **Energy panel** — WTI/Brent/NatGas prices with delta indicators
- **Risk gauges** — VIX gauge, yield curve indicator, HY spread
- **Maritime chokepoints** — vessel counts at 8 strategic chokepoints
- **Signal summary** — cross-source intelligence correlations (e.g., "Elevated thermal + conflict = procurement signal")
- **Live news ticker** — auto-scrolling geo-tagged headlines from RSS (BBC, NYT, Al Jazeera)
- **Sweep status bar** — shows data freshness per source

### `src/hooks/useCrucixIntel.ts`
Single hook that orchestrates all 4 edge functions in parallel, caches results, and auto-refreshes every 15 minutes. Provides synthesized data structure matching Crucix's `V2` format.

## Integration into CyberImmunityModal

1. Add `"interactive"` to the `centerView` state type (line 1289)
2. Add new tab button after TIMELINE (line 1486-1488)
3. Render `InteractiveMapSummary` when `centerView === "interactive"`

## Data Flow

```text
User clicks "INTERACTIVE MAP" tab
  → useCrucixIntel hook fires
    → 4 parallel edge function calls
      → crucix-fred → FRED API → 21 indicators
      → crucix-firms → NASA FIRMS → fire detections per hotspot
      → crucix-eia → EIA API → energy prices
      → crucix-ais → AISStream → vessel positions
    → Results synthesized into V2 format
    → D3 map renders markers
    → Economic panels populate
    → Signal correlations computed client-side
```

## Implementation Order

1. Add 4 secrets (FRED_API_KEY, FIRMS_MAP_KEY, EIA_API_KEY, AISSTREAM_API_KEY)
2. Create 4 edge functions
3. Fix existing `nasa-wildfires` to use real FIRMS key
4. Create `useCrucixIntel` hook
5. Create `InteractiveMapSummary` component
6. Wire into `CyberImmunityModal`

