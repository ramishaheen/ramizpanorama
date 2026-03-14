

# Fix: Populate `intel_events` Table + Ensure Feed Data is Current

## Problem
The `intel_events` table has **0 rows**. The `simulate-intel` edge function generates `geo_alerts`, `airspace_alerts`, `rockets`, `timeline_events`, and `vessels` — but **never writes to `intel_events`**. This means:
- The Events Feed page (`/intel/events`) is empty
- The Gotham 4D FEED tab's `intel_events` query returns nothing
- The Intel Global Map's events layer shows 0 markers
- The Kill Chain event picker has no intel events to select from

All other tables have fresh data (geo_alerts: 140, airspace: 36, rockets: 16, vessels: 7, timeline: 98, targets: 40).

## Solution
Add `intel_events` generation to the `simulate-intel` edge function so it produces **2-3 intel events per poll cycle** (matching the pattern used for geo_alerts).

### Changes to `supabase/functions/simulate-intel/index.ts`

After the geo_alerts section (~line 214), add a new block:

- Generate 2-3 intel events per cycle using the same `CITY_COORDS` and `titles` data
- Map `geoType` to `event_type` strings (e.g., `"airstrike"`, `"cyber_attack"`, `"naval_interdiction"`, `"diplomatic_incident"`, `"humanitarian_crisis"`)
- Include varied `event_type` values so the Kill Chain's adaptive classifier (KINETIC/CYBER/MARITIME etc.) activates correctly
- Set `confidence` between 0.4-0.95, `verification_status` randomly from `unverified`/`pending`/`confirmed`
- Populate `city`, `country`, `summary`, `title`, `lat`, `lng`, `severity`
- Add a prune step: keep last 100 intel_events, delete older ones

### Event type variety for Kill Chain integration
The generated events should include types like:
- `"airstrike"`, `"explosion"`, `"missile_launch"` → triggers KINETIC chain
- `"cyber_intrusion"`, `"network_breach"` → triggers CYBER chain
- `"naval_movement"`, `"vessel_interdiction"` → triggers MARITIME chain
- `"nuclear_activity"`, `"centrifuge_anomaly"` → triggers NUCLEAR chain
- `"gps_jamming"`, `"sigint_intercept"` → triggers SIGINT chain
- `"mass_gathering"`, `"protest"` → triggers CIVIL chain

### RLS consideration
The `intel_events` table requires `authenticated` + `admin`/`analyst` role for INSERT. The edge function uses `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS — no changes needed.

### Files modified
- `supabase/functions/simulate-intel/index.ts` — Add intel_events generation + pruning block

