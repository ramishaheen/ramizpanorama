

## Realistic Movement Emulation + Country Zoom with Satellite Highlighting

### Current State
- **Aircraft (UrbanScene3D)**: Already has a 200ms interpolation engine that extrapolates positions between 15-second API polls using heading and velocity. This works well.
- **Satellites (SatelliteGlobe)**: Re-propagates TLE positions every 2 seconds using SGP4-lite. Movement is functional but could be smoother.
- **Country clicking**: City presets (not countries) can be clicked to zoom in and show nearby satellites within 2500km. There is no polygon-based country click on the globe itself.

### What Needs to Change

#### 1. Smoother Satellite Movement (SatelliteGlobe.tsx)
- Reduce re-propagation interval from **2000ms to 500ms** for visibly smooth orbital motion
- Add a **requestAnimationFrame-based interpolation** between propagation ticks so satellite icons glide continuously rather than jumping
- LEO satellites at ~7.5 km/s move ~15km per 2 seconds — enough to appear jumpy. At 500ms intervals with frame interpolation, movement will appear continuous

#### 2. Smoother Aircraft Movement (UrbanScene3D.tsx)
- Current 200ms interval is good. Reduce to **100ms** for even smoother visual movement on the 3D map
- Add **altitude interpolation** using vertical_rate so aircraft visually climb/descend
- Add **heading interpolation** — smoothly rotate the aircraft icon between heading snapshots instead of snapping

#### 3. Country Click → Zoom + Highlight Satellites (SatelliteGlobe.tsx)
- Add **`polygonsData`** to the globe using the existing `countryBorders.ts` data (10 Middle East countries already defined)
- On polygon click: 
  - Zoom into the country center with `pointOfView()` animation
  - Filter and highlight all satellites overhead (within bounding box + altitude cone)
  - Show highlighted satellites with a **brighter glow / larger size** and dim non-relevant ones
  - Display a country satellite summary panel (reuse existing `countrySats` breakdown logic)
- The polygon borders will render as semi-transparent colored outlines on the globe surface

#### 4. Visual Clarity Improvements
- **Aircraft trails**: Add a fading gradient to trail lines (bright at aircraft, fading behind) — already partially implemented but can be enhanced
- **Satellite trails**: Add short ground-track tails (last 30 seconds of computed positions) so orbital direction is visible
- **Speed labels**: Show velocity on hover for both aircraft and satellites in human-readable units (km/h for aircraft, km/s for satellites)

### Files to Modify
- `src/components/dashboard/SatelliteGlobe.tsx` — Faster propagation, country polygon layer, click-to-zoom-and-highlight
- `src/components/dashboard/UrbanScene3D.tsx` — Smoother interpolation (100ms), heading/altitude interpolation

### Architecture
```text
SatelliteGlobe:
  TLE Data → propagateSatellite() every 500ms
                ↓
  rAF interpolation between ticks → smooth orbital motion
                ↓
  Country polygons (countryBorders.ts) → click handler
                ↓
  Zoom to country + filter satellites within bounding box
                ↓
  Highlight nearby sats (glow) + dim distant ones

UrbanScene3D:
  API Poll (15s) → snapshot
                ↓
  Interpolation (100ms) with heading rotation + altitude change
                ↓
  Smooth marker updates on Google Maps 3D
```

