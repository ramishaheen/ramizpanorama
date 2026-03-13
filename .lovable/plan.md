

# MSS Targeting Workbench — Enhancement Plan

## Current State

The project already has a comprehensive JADC2 system implemented:
- **Database**: `target_tracks` (with `velocity_vector`, `threat_level`), `shooter_assets`, `strike_recommendations`, `action_logs`, `kill_chain_tasks`, `ontology_entities`, `sensor_feeds`, `force_units` — all with RLS and realtime
- **Edge Functions**: `sensor-to-shooter` (F2T2EA matching, dark vessel detection), `c2-targeting` (AI ATR)
- **UI**: `TargetDetailModal` (deep dive), `ConfirmSlider` (HITL), `SensorToShooterPanel` (RECS/ASSETS/BDA/DARK), `C2TargetingPanel`, `KillChainPanel`, `SensorFusionPanel`, `OntologyPanel`, `C2ChatTab`
- **Globe**: Blue/Red force markers, target tracks, shooter assets, sensor coverage circles — all on Globe.gl
- **Realtime**: Supabase postgres_changes on `target_tracks`, `strike_recommendations`, `shooter_assets`

## What the Request Adds (Gap Analysis)

Most of the requested schema and UI already exists. The missing pieces are:

### 1. Targeting Workbench (Bottom Panel) — NEW
A context-sensitive bottom tray that opens when a target is selected on the globe or from the list. Currently, only the `TargetDetailModal` exists as a full-screen portal overlay. The request calls for a **bottom docked panel** with:
- **Side-by-Side View**: AI sensor crop vs. reference library image (classification reference)
- **Decision Matrix**: Top 3 recommended shooters in a sortable table (TTT, Pk, cost-to-kill)
- **Integrated ConfirmSlider** at the bottom

### 2. Enhanced Globe Interaction — Target Selection
Currently globe points show tooltips but don't trigger the targeting workbench. Need to wire `onPointClick` on the globe to open the bottom workbench for `target_tracks` points.

### 3. "Slew Sensor" Quick Action in Feed
The Priority Intelligence Feed (right panel FEED tab) needs a "Slew Sensor to Location" quick-action button on each detection item — this would task the nearest idle drone/sensor to the event coordinates.

### 4. Reference Library Images
Add a `reference_images` mapping that pairs each `target_classification` enum value with a reference silhouette/image URL for the side-by-side comparison view.

### 5. Cost-to-Kill Column in Decision Matrix
Add `cost_estimate_usd` to the weaponeering logic in `sensor-to-shooter` edge function for each weapon type.

## Implementation Plan

### Step 1: Create TargetingWorkbench Component
**File**: `src/components/dashboard/TargetingWorkbench.tsx`

A bottom-docked panel (absolute positioned, ~40% viewport height) that slides up when a target is selected. Three columns:
- **Left**: Sensor image (from `target_tracks.image_url` or classification icon) + reference library image below it
- **Center**: Decision matrix table — top 3 `strike_recommendations` for this target, showing: Asset, Weapon, TTT, Pk, CDR, Cost, ROE
- **Right**: Target metadata summary + ConfirmSlider for the top recommendation

Uses existing `supabase` client to fetch `strike_recommendations` joined with `shooter_assets` for the selected target.

### Step 2: Wire Globe Target Selection
**File**: `src/components/dashboard/FourDMap.tsx`

- Add state: `selectedGlobeTarget` (string | null)
- On the globe's `onPointClick` callback, check if the clicked point is a target track (by matching lat/lng or embedding target ID in point data). If so, set `selectedGlobeTarget`.
- Render `<TargetingWorkbench>` conditionally at the bottom of the globe area when `selectedGlobeTarget` is set.

### Step 3: Add "Slew Sensor" Button to Feed Items
**File**: `src/components/dashboard/FourDMap.tsx` (feed rendering section, lines ~1227-1239)

Add a small "📡 SLEW" button on each feed item that invokes the `sensor-to-shooter` edge function with `action: "slew_sensor"` to task the nearest idle drone to the event coordinates. Also add this action to `sensor-to-shooter/index.ts`.

### Step 4: Update Edge Function with Cost Estimates
**File**: `supabase/functions/sensor-to-shooter/index.ts`

Add a `WEAPON_COST_USD` map:
```
hellfire: 150000, jdam: 25000, gbu39: 40000, tomahawk: 1800000,
harpoon: 1500000, excalibur: 68000, harm: 284000, paveway: 20000, ...
```
Include `cost_estimate_usd` in each match result and store in `strike_recommendations`.

### Step 5: Schema Addition
Migration to add `cost_estimate_usd` column to `strike_recommendations`:
```sql
ALTER TABLE public.strike_recommendations
  ADD COLUMN IF NOT EXISTS cost_estimate_usd numeric DEFAULT 0;
```

And add `slew_sensor` action to the edge function that finds the nearest idle ISR asset and updates its `current_tasking` to `tasked`.

### Technical Notes

- **No new tables needed** — existing schema covers all entities
- **Realtime already wired** — `strike_recommendations` and `target_tracks` channels active
- **ConfirmSlider reused** from existing component
- **Bottom panel** uses `fixed bottom-0` positioning within the globe container, with a close button and slide-up animation via CSS transition
- **Reference images**: Static mapping of classification to placeholder silhouettes (SVG inline or emoji-based, matching existing pattern)

### Files to Create
- `src/components/dashboard/TargetingWorkbench.tsx`

### Files to Modify
- `src/components/dashboard/FourDMap.tsx` — globe click handler + workbench rendering + slew button in feed
- `supabase/functions/sensor-to-shooter/index.ts` — add `slew_sensor` action + cost estimates

### Migration
- Add `cost_estimate_usd` to `strike_recommendations`

