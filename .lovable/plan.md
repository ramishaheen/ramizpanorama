

# Fix Kill Chain, Sensor Fusion, Ontology, S2S & Data Links

## Issues Found

1. **S2S Edge Function** (`sensor-to-shooter/index.ts`) uses deprecated `import { serve }` — will cause BOOT_ERROR like the live-flights function did. Must migrate to `Deno.serve()`.

2. **Kill Chain "recommend" action missing** — `KillChainPanel.tsx` calls `sensor-to-shooter` with `{ action: "recommend", target_id }` but no such action exists in the edge function. It silently fails with 400, so weapon/platform always stays "TBD".

3. **Ontology Panel** — fetches entities via edge function but has no way to seed/populate entities if the DB is empty. Needs a "seed" or "ingest sample" button and should show a prompt when empty.

4. **Sensor Fusion** — works but sensors may show stale data. Need a "pulse" action to refresh `last_data_at` and health scores on existing feeds so they appear alive.

5. **Data Links Panel** — registration form only has basic fields (name, protocol, lat, lng). User asked to "add any link" — needs expanded form with endpoint URL, feed type selector covering all enum values, coverage radius, data rate, and classification level.

## Plan

### 1. Fix S2S Edge Function Boot Error
**File**: `supabase/functions/sensor-to-shooter/index.ts`
- Remove `import { serve }` line
- Replace `serve(async (req) => {` with `Deno.serve(async (req) => {`

### 2. Add "recommend" Action to S2S
**File**: `supabase/functions/sensor-to-shooter/index.ts`
- Add new `action === "recommend"` handler that:
  - Takes `target_id`, looks up the target track
  - Finds best single shooter match (closest idle with matching weapon)
  - Returns `{ recommendation: { recommended_weapon, callsign, asset_type, distance_km } }`
- This makes the Kill Chain INITIATE button properly auto-assign weapon/platform

### 3. Activate Kill Chain — Fix initiateKillChain
**File**: `src/components/dashboard/KillChainPanel.tsx`
- Fix confidence display (currently shows raw 0-1, should multiply by 100)
- Add error handling toast when S2S recommend fails vs silently catching

### 4. Activate Ontology — Add Seed + Ingest Button
**File**: `src/components/dashboard/OntologyPanel.tsx`
- Add "SEED ENTITIES" button when entity list is empty — calls `sensor-ingest` with `action: "ingest"` using sample detection data for the region
- Add "INGEST FROM SENSORS" button that triggers ingestion from active sensor feeds
- Show entity count in header

### 5. Refresh Sensor Feeds — Add Pulse Action
**File**: `supabase/functions/sensor-ingest/index.ts`
- Add `action === "pulse"` that updates `last_data_at` and randomizes `health_score` slightly for all active feeds to simulate live data flow

**File**: `src/components/dashboard/SensorFusionPanel.tsx`
- Add "PULSE" button next to refresh that calls the pulse action

### 6. Expand Data Links — Full Registration Form
**File**: `src/components/dashboard/DataLinksPanel.tsx`
- Expand registration form with:
  - Endpoint URL input field
  - Feed type dropdown with all enum values (satellite_eo, satellite_sar, satellite_ir, drone_fmv, drone_lidar, cctv, sigint_rf, sigint_comint, sigint_elint, osint_social, osint_news, osint_adsb, osint_ais, ground_radar, ground_acoustic, iot_scada, iot_edge)
  - Coverage radius (km) input
  - Data rate (Hz) input
  - Classification level selector (unclassified, restricted, confidential, secret, top_secret)
- Add "ADD CUSTOM LINK" section with URL + name for quick arbitrary data source registration
- Show endpoint URL in feed details when present

## Files Modified
- `supabase/functions/sensor-to-shooter/index.ts` — Deno.serve fix + recommend action
- `supabase/functions/sensor-ingest/index.ts` — pulse action
- `src/components/dashboard/KillChainPanel.tsx` — confidence fix, error handling
- `src/components/dashboard/OntologyPanel.tsx` — seed/ingest buttons
- `src/components/dashboard/SensorFusionPanel.tsx` — pulse button
- `src/components/dashboard/DataLinksPanel.tsx` — expanded form with all fields

## No database changes needed

