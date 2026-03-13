

# Maven Smart System (MSS) — Targeting Dashboard Upgrade

## Current State Assessment

The project already has a substantial JADC2 foundation:
- **Database**: `target_tracks`, `shooter_assets`, `strike_recommendations`, `action_logs`, `kill_chain_tasks`, `ontology_entities`, `force_units`, `sensor_feeds` tables all exist with proper RLS
- **Backend**: `sensor-to-shooter` edge function (F2T2EA matching, dark vessel detection), `c2-targeting` (AI ATR)
- **UI**: `SensorToShooterPanel` (RECS/ASSETS/BDA/DARK), `C2TargetingPanel`, `KillChainPanel`, `OntologyPanel`, `SensorFusionPanel` — all in the right sidebar tabs

What is **missing** to match the MSS specification:

## Plan

### 1. Target Detail Modal (Deep Dive Panel)
Create `src/components/dashboard/TargetDetailModal.tsx` — a full-screen modal triggered when clicking any target in the TARGETS tab or globe:
- Left: sensor image placeholder (drone/SAR crop) with classification overlay
- Center: AI confidence gauge, metadata (coordinates, velocity vector, source sensor, threat level 1-5, detection timestamp)
- Right: "Recommended Action" panel showing matched shooter, weapon, Pk, TTT
- Bottom: **HITL Strike/Engage button** with a drag-to-confirm safety slider (not a simple click) — this fulfills the Human-in-the-Loop requirement
- Wire the modal to open from `C2TargetingPanel` target rows and from `StrikeRecCard` locate buttons

### 2. Shooter Assets on Globe (Asset Management Tray)
Update `FourDMap.tsx` globe rendering to plot `shooter_assets` as labeled markers when the S2S tab or a new "Assets" layer toggle is active:
- Add a `shooterAssets` layer to the existing layer config system
- Fetch shooter_assets data alongside existing force_units
- Render with platform-specific icons (drone, fighter, ship) and status coloring (idle=green, tasked=yellow, combat=red)

### 3. HITL Confirm Slider Component
Create `src/components/dashboard/ConfirmSlider.tsx`:
- A horizontal track with a draggable handle reading "SLIDE TO ENGAGE"
- Only triggers the `commitStrike` action when the handle reaches 100%
- Red gradient background, haptic-style visual feedback
- Replaces the simple COMMIT button in `StrikeRecCard` for pending recommendations

### 4. Push Notification Logic (Real-time Alert Toast)
Update `useSensorToShooter.ts` to subscribe to `target_tracks` realtime changes:
- On new `INSERT` event with confidence > 0.9, fire a toast notification with target classification, coordinates, and a "VIEW" button that opens the Target Detail Modal
- Add audio cue class (CSS animation pulse on the S2S tab badge)
- Update the right sidebar tab badge to show unread count

### 5. Schema Enhancement (Minor)
Add two columns to `target_tracks` via migration:
- `velocity_vector jsonb DEFAULT '{}'` — stores speed/heading as `{speed_kts, heading_deg, climb_rate}`
- `threat_level integer DEFAULT 3` — 1-5 scale as specified

No new tables needed — existing schema covers all required entities.

### 6. Edge Function Update
Update `sensor-to-shooter/index.ts` `match_shooters` action to include `threat_level` in its AI reasoning prompt and return an `estimated_time_to_intercept` field.

## Technical Details

**Target Detail Modal layout:**
```text
┌──────────────────────────────────────────────────┐
│  ✕  TARGET DEEP DIVE — ATR-1741...               │
├──────────┬──────────────┬────────────────────────┤
│ SENSOR   │  METADATA    │  RECOMMENDED ACTION    │
│ IMAGE    │  Class: T-90 │  Assign: VIPER-02      │
│ [crop]   │  Conf: 94%   │  Weapon: HELLFIRE      │
│          │  Threat: 4/5 │  Pk: 87%  TTT: 4.2min  │
│          │  Vel: 35kts  │  ROE: CLEAR            │
│          │  Src: SAR    │  CDR: LOW              │
├──────────┴──────────────┴────────────────────────┤
│  ◀═══════════════▶  SLIDE TO ENGAGE              │
└──────────────────────────────────────────────────┘
```

**Confirm Slider**: Uses `onPointerDown/Move/Up` events, tracks drag percentage, commits only at 100%. Resets on release if not complete.

**Realtime push**: Leverages existing Supabase realtime channel pattern already used in `useSensorToShooter.ts`, adding a `target_tracks` channel with toast via `sonner`.

**Files to create:**
- `src/components/dashboard/TargetDetailModal.tsx`
- `src/components/dashboard/ConfirmSlider.tsx`

**Files to modify:**
- `src/components/dashboard/FourDMap.tsx` — add shooter asset markers on globe, wire target click to modal
- `src/components/dashboard/C2TargetingPanel.tsx` — wire target row click to open modal
- `src/components/dashboard/SensorToShooterPanel.tsx` — replace COMMIT button with ConfirmSlider, wire to modal
- `src/hooks/useSensorToShooter.ts` — add `target_tracks` realtime subscription + toast alerts
- `supabase/functions/sensor-to-shooter/index.ts` — include threat_level in reasoning
- Migration: add `velocity_vector` and `threat_level` to `target_tracks`

