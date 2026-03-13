

# Full-Spectrum Sensor Fusion & Ontology Integration into GOTHAM 4D

## Summary
Deep-integrate all sensor categories (CCTV, drones, satellites, SIGINT, OSINT, IoT, ground radar) into the C2 system via a unified ontology layer. This adds a sensor registry database, entity-relationship ontology, automated ingestion pipeline, and a Sensor Fusion HUD to the 4D Map.

## Architecture

```text
┌────────────────────────────────────────────────────────────────────┐
│                         SENSOR SOURCES                             │
│  Satellites  │  Drones/UAV  │  CCTV  │  SIGINT  │  OSINT  │  IoT  │
└──────┬───────┴──────┬───────┴───┬────┴────┬─────┴────┬────┴───┬───┘
       │              │           │         │          │        │
       ▼              ▼           ▼         ▼          ▼        ▼
┌────────────────────────────────────────────────────────────────────┐
│              sensor_feeds (Registry Table)                         │
│  feed_id, feed_type, source_name, protocol, lat/lng, status       │
│  config (jsonb), last_data_at, health, classification_level       │
└───────────────────────────┬────────────────────────────────────────┘
                            │ ingestion
                            ▼
┌────────────────────────────────────────────────────────────────────┐
│           ONTOLOGY LAYER (Semantic Object Graph)                   │
│  ontology_entities: Equipment, Facility, Unit, Person, Vehicle     │
│  ontology_relationships: occupies, observes, targets, commands     │
│  Bi-temporal: event_time + ingestion_time on all records           │
└───────────────────────────┬────────────────────────────────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        force_units   target_tracks   kill_chain_tasks
        (existing)     (existing)      (existing)
```

## Phase 1: Database — Sensor Registry & Ontology Tables

### Migration: 3 new tables

**`sensor_feeds`** — Universal sensor registry
- `id`, `feed_type` (enum: satellite_eo, satellite_sar, satellite_ir, drone_fmv, drone_lidar, cctv, sigint_rf, sigint_comms, osint_social, osint_news, osint_flight, osint_maritime, ground_radar, ground_acoustic, iot_scada, iot_edge)
- `source_name`, `protocol` (enum: api_rest, api_ws, hls_stream, rtsp, mqtt, manual, webhook)
- `lat`, `lng`, `coverage_radius_km`
- `status` (enum: active, degraded, offline, maintenance)
- `health_score` (0-100), `last_data_at`, `data_rate_hz`
- `classification_level` (enum: unclassified, cui, secret, top_secret) — display-only for simulation
- `config` (jsonb — stores endpoint URLs, auth refs, polling intervals)
- `linked_camera_id` (nullable FK to cameras), `linked_unit_id` (nullable FK to force_units)
- RLS: authenticated read, admin/analyst manage

**`ontology_entities`** — Semantic objects (the "nouns")
- `id`, `entity_type` (enum: equipment, facility, unit, person, vehicle, infrastructure, weapon_system)
- `name`, `designation`, `description`
- `lat`, `lng`, `last_known_at`
- `affiliation` (reuse existing enum)
- `attributes` (jsonb — flexible fields per type, e.g. {"model":"T-72","turret_count":1})
- `source_sensor_id` (FK to sensor_feeds)
- `confidence`, `status`
- `event_time` (when it actually happened), `ingestion_time` (when system learned)
- RLS: authenticated read, admin/analyst manage

**`ontology_relationships`** — How entities interact (the "verbs")
- `id`, `source_entity_id` (FK), `target_entity_id` (FK)
- `relationship_type` (enum: occupies, commands, observes, targets, transports, supplies, defends, attacks)
- `confidence`, `source_sensor_id` (FK)
- `valid_from`, `valid_to` (temporal validity)
- `metadata` (jsonb)
- RLS: authenticated read, admin/analyst manage

Also: add `source_sensor_id` column to existing `target_tracks` table (nullable FK to sensor_feeds), and add `event_time` + `ingestion_time` columns to `force_units` and `target_tracks` for bi-temporal tracking.

Seed data: ~15 sensor feeds (existing cameras, satellite TLE, ADS-B, AIS, OSINT feeds, emulated drones/SIGINT), ~20 ontology entities mapped from existing force_units and target_tracks.

### Enable realtime on sensor_feeds and ontology_entities
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_feeds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ontology_entities;
```

## Phase 2: Edge Function — `sensor-ingest`

New edge function that acts as the universal ingestion endpoint:
- `action: "ingest"` — accepts sensor data from any feed type, normalizes it, creates/updates ontology entities and target tracks
- `action: "health"` — returns health dashboard for all registered feeds
- `action: "auto_correlate"` — uses AI (Gemini Flash) to correlate multi-INT data (e.g., CCTV detection + satellite imagery of same location = higher confidence entity)

The function cross-references incoming detections against existing ontology entities by proximity (haversine < 500m) and classification match, merging rather than duplicating.

## Phase 3: Sensor Fusion Panel — `SensorFusionPanel.tsx`

New right-panel tab "SENSORS" added to the 4D Map tab bar (FEED | TARGETS | KILLCHAIN | C2 INTEL | **SENSORS**):

- **Sensor Health Grid**: Each registered sensor shows as a card with status LED (green/yellow/red), feed type icon, data rate, last update timestamp
- **Feed Type Breakdown**: Grouped by category (Space, Aerial, Ground, Cyber/SIGINT, OSINT) with counts
- **Coverage Map Integration**: Toggle to show sensor coverage circles on the globe (colored by feed type)
- **Quick Actions**: "Trigger Scan" button per sensor (invokes c2-targeting for satellite/drone, cctv-ai-analyze for CCTV)
- **Correlation Alerts**: When multi-INT correlation fires, show alert with linked entities

## Phase 4: Ontology Explorer — `OntologyPanel.tsx`

New right-panel tab "ONTOLOGY" (replaces KILLCHAIN position or added as 6th tab):
- **Entity List**: Filterable by type (Equipment, Facility, Unit, etc.)
- **Relationship Graph**: Visual mini-graph showing entity connections (e.g., "Unit Alpha → occupies → Base Foxtrot → observed_by → Satellite WV-3")
- **Entity Detail Card**: Click entity to see all attributes, source sensor, confidence, temporal history
- **Action Buttons**: "Change Status", "Link to Target", "Add Relationship"

## Phase 5: Globe Integration

### New layers in FourDMap.tsx:
- **`sensorCoverage`** layer: Renders translucent coverage circles for each active sensor feed, colored by type (blue=satellite, orange=drone, green=CCTV, purple=SIGINT)
- **`ontologyEntities`** layer: Renders ontology entities as NATO APP-6 style icons on the globe with relationship arcs between linked entities

### Bottom bar additions:
- Sensor health summary chips: `SAT:4 ✓` `UAV:2 ✓` `CCTV:8 ⚠` `SIGINT:3 ✓`
- Quick-toggle for sensor coverage overlay

## Phase 6: Connect Existing Data Sources

Wire existing hooks/data into the sensor registry:
- **Cameras** (`cameras` table) → auto-register as `cctv` sensor feeds
- **Satellites** (TLE data) → register as `satellite_eo` / `satellite_ir`
- **Flights** (ADS-B) → register as `osint_flight`
- **Vessels** (AIS) → register as `osint_maritime`
- **Conflict Events** (ACLED/GDELT) → register as `osint_news`
- **CCTV AI detections** (`camera_events`) → auto-create ontology entities from AI analysis results

This happens via a seed migration and a background sync in the `sensor-ingest` function.

## Files to Create/Modify

| File | Action |
|---|---|
| `supabase migration` | Create `sensor_feeds`, `ontology_entities`, `ontology_relationships` tables; alter `target_tracks` and `force_units` with bi-temporal cols; seed sensor feeds; enable realtime |
| `supabase/functions/sensor-ingest/index.ts` | Create — Universal ingestion, health monitoring, AI correlation |
| `src/components/dashboard/SensorFusionPanel.tsx` | Create — Sensor health grid, coverage toggles, correlation alerts |
| `src/components/dashboard/OntologyPanel.tsx` | Create — Entity explorer, relationship graph, entity actions |
| `src/hooks/useSensorFeeds.ts` | Create — Hook for sensor registry with realtime subscriptions |
| `src/hooks/useOntology.ts` | Create — Hook for ontology entities & relationships |
| `src/components/dashboard/FourDMap.tsx` | Modify — Add SENSORS + ONTOLOGY tabs, sensor coverage layer, ontology entity rendering on globe, bottom bar sensor health chips |
| `supabase/config.toml` | Modify — Add `[functions.sensor-ingest]` with `verify_jwt = false` |

## Security
All new tables use RLS requiring authentication. Sensor classification levels are display-only metadata for simulation purposes. All data remains OSINT/analytical.

