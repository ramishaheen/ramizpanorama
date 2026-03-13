

# Tactical Data Link & Sensor Fusion Integration

## What This Adds

Three new edge functions implementing the sensor integration API layer, plus a new "DATALINKS" tab in the Gotham 4D right panel to monitor and control all sensor connections.

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│                    EDGE FUNCTIONS                        │
├───────────────┬──────────────────┬───────────────────────┤
│ sensor-adapt  │ stac-connector   │ gimbal-control        │
│ (Adapter      │ (STAC Catalog    │ (Slew/Mission/        │
│  Pattern)     │  Search)         │  Weapon Release)      │
├───────────────┴──────────────────┴───────────────────────┤
│              sensor-ingest (existing)                    │
│         ontology_entities ← normalized output            │
└─────────────────────────────────────────────────────────┘
```

## Plan

### 1. Edge Function: `sensor-adapt` (The Adapter/Translator)

New file: `supabase/functions/sensor-adapt/index.ts`

Actions:
- **`normalize`**: Accepts vendor-specific payloads (DJI, MAVLink, generic RTSP metadata, ADS-B) and translates them into the Universal Ontology schema. Each vendor format maps to the `ontology_entities` insert shape via an adapter map. Returns normalized detections ready for `sensor-ingest` ingestion.
- **`register_feed`**: Creates a new `sensor_feeds` row with protocol, data rate, and coverage radius. Supports protocols: `mavlink`, `stanag_4586`, `rtsp`, `srt`, `stac_api`, `ais_nmea`, `api_rest`.
- **`telemetry`**: Accepts MAVLink-style telemetry (lat/lng/alt/heading/speed/battery) and updates the corresponding `sensor_feeds` row's config JSONB with latest platform state + updates `last_data_at`.

The adapter pattern uses a `VENDOR_ADAPTERS` map keyed by vendor string (e.g., `"dji"`, `"mavlink"`, `"adsb"`, `"generic_cv"`) where each adapter extracts `entity_type`, `name`, `lat`, `lng`, `confidence`, `affiliation`, and `attributes` from the vendor-specific payload shape.

### 2. Edge Function: `stac-connector` (Satellite Imagery Catalog)

New file: `supabase/functions/stac-connector/index.ts`

Actions:
- **`search`**: Queries a STAC API endpoint (configurable, defaults to Earth Search by Element84 — free, no API key). Accepts `bbox`, `datetime`, `collections` (sentinel-2, landsat, cop-dem), `limit`. Returns GeoJSON FeatureCollection with asset download URLs.
- **`item`**: Fetches a single STAC item by collection + item ID. Returns full metadata + asset links (COG tiles, thumbnails).
- **`ingest_detections`**: Given a STAC item, runs AI (Gemini Flash) on the thumbnail to detect military objects, then feeds results into `sensor-ingest` as normalized detections. Creates `target_tracks` entries for high-confidence finds.

Uses the free Element84 Earth Search API (`https://earth-search.aws.element84.com/v1`) — no API key required. The existing UP42 connector handles commercial imagery.

### 3. Edge Function: `gimbal-control` (Tactical Command APIs)

New file: `supabase/functions/gimbal-control/index.ts`

Actions:
- **`slew_to_cue`**: Accepts `{asset_id, lat, lng, alt?}`, validates the asset exists in `shooter_assets`, logs the command to `action_logs`, updates asset tasking to `"tasked"`, returns ETA. This extends the existing `slew_sensor` in `sensor-to-shooter` with audit logging and richer response.
- **`mission_task`**: Accepts `{asset_id, waypoints: [{lat,lng,alt,loiter_sec}], zone_of_interest?: {center, radius_km}}`. Stores the mission plan in the asset's `payload` JSONB field and logs to `action_logs`. Returns mission hash.
- **`weapon_release`**: The mTLS-simulated strike command. Requires a **double-handshake**: first call with `phase: "arm"` returns a one-time `nonce` (stored in DB), second call with `phase: "fire"` + matching `nonce` + `recommendation_id` executes the `commit_strike` flow. Nonce expires after 30 seconds. Both phases logged to `action_logs`.

### 4. Database Migration

```sql
-- Add mission_plan JSONB and weapon_nonce to shooter_assets
ALTER TABLE public.shooter_assets
  ADD COLUMN IF NOT EXISTS mission_plan jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weapon_nonce text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weapon_nonce_expires_at timestamptz DEFAULT NULL;
```

### 5. UI: DataLinks Tab in Gotham 4D

New file: `src/components/dashboard/DataLinksPanel.tsx`

A new tab "LINKS" added to the right panel tab bar in `FourDMap.tsx`. Shows:
- **Protocol Monitor**: Each registered `sensor_feed` grouped by protocol (MAVLink, RTSP, STAC, AIS, REST) with latency indicator and last-data timestamp
- **Adapter Status**: Shows which vendor adapters are active and their normalization throughput
- **Quick Actions**: "Register Feed" button (opens inline form), "Run STAC Search" button, "Flush Telemetry" button
- **Latency Gauge**: Visual bar showing last round-trip time per feed (target: <200ms indicator)

### 6. Wire into FourDMap

Modify `FourDMap.tsx`:
- Add `"LINKS"` to the tab bar array (line ~1249)
- Render `<DataLinksPanel />` when active
- Add `useSensorFeeds` data to display protocol-level status chips in the bottom bar

## Files to Create
- `supabase/functions/sensor-adapt/index.ts`
- `supabase/functions/stac-connector/index.ts`
- `supabase/functions/gimbal-control/index.ts`
- `src/components/dashboard/DataLinksPanel.tsx`

## Files to Modify
- `src/components/dashboard/FourDMap.tsx` — add LINKS tab
- `supabase/config.toml` — register 3 new functions with `verify_jwt = false`

## Migration
- Add `mission_plan`, `weapon_nonce`, `weapon_nonce_expires_at` columns to `shooter_assets`

