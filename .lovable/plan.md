

# Interactive Map Summary — Full Implementation

## What's Missing
Nothing from the approved plan was actually created. The 4 secrets, 4 edge functions, the hook, the component, and the CyberImmunityModal wiring are all missing.

## Implementation Steps

### 1. Add 4 Secrets
Store these via `add_secret`:
- `FRED_API_KEY` = `5bd0d1e300c0489ecd7e5e93ea57ba78`
- `FIRMS_MAP_KEY` = `2147b86253f09d46d08508d372ea2f6c`
- `EIA_API_KEY` = `DO0PMe8h7zWX7UyD5NbSbOsj6VCH4AflOlUkWl05`
- `AISSTREAM_API_KEY` = `d8d5634ac353c69b8964001971a518ff7124e325`

### 2. Create 4 Edge Functions
- **`supabase/functions/crucix-fred/index.ts`** — Fetch 10+ FRED series (VIX, yield curve, CPI, fed funds, unemployment, M2, gold, USD index). Returns structured indicators.
- **`supabase/functions/crucix-firms/index.ts`** — Fetch NASA FIRMS fire data using real key for 6 conflict hotspots. Parse CSV, return fire detections.
- **`supabase/functions/crucix-eia/index.ts`** — Fetch EIA energy prices (WTI, Brent, NatGas, inventories).
- **`supabase/functions/crucix-ais/index.ts`** — Fetch AISStream vessel positions at strategic chokepoints (Hormuz, Suez, Malacca, Bab el-Mandeb, Taiwan Strait, Bosphorus).

Each function: CORS headers, `verify_jwt = false` in config.toml, secret from `Deno.env.get()`.

### 3. Update `nasa-wildfires` Edge Function
Replace hardcoded `"FIRMS_MAP_KEY"` placeholder with `Deno.env.get("FIRMS_MAP_KEY")` to use the real key.

### 4. Create `src/hooks/useCrucixIntel.ts`
Hook that calls all 4 edge functions in parallel via `supabase.functions.invoke()`, caches results, auto-refreshes every 15 min. Returns `{ fred, firms, eia, ais, loading, error }`.

### 5. Create `src/components/dashboard/InteractiveMapSummary.tsx`
Crucix-style Jarvis HUD:
- D3 SVG world map using `worldMapPaths.ts` with zoom/pan
- Fire markers (FIRMS data) — orange/red dots scaled by FRP
- Vessel markers (AIS data) — blue ship icons at chokepoints
- Economic sidebar — FRED indicators in compact grid, color-coded by trend
- Energy panel — WTI/Brent/NatGas with delta arrows
- Risk gauges — VIX gauge, yield curve
- Maritime chokepoint vessel counts
- Signal summary bar — cross-source correlations
- Sweep status bar showing data freshness per source

### 6. Wire into CyberImmunityModal
- Line 1289: Add `"interactive"` to centerView type union
- Line 1488: Add new "INTERACTIVE MAP" tab button after TIMELINE
- Line 1600-1602: Add render branch for `centerView === "interactive"` showing `<InteractiveMapSummary />`

