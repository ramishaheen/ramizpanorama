

# AI Object Recognition on Zoom — 4D Globe

## Concept
When the user zooms into a specific area on the globe (altitude < ~0.5), an **"AI SCAN"** button appears, allowing them to trigger AI-powered object recognition for that viewport center. The system uses the existing `c2-targeting` edge function (military ATR) and `streetview-detect` (street-level CV) to detect objects at the zoomed coordinates, then renders results as labeled markers on the globe with confidence scores.

## Implementation

### 1. Add Zoom-Level State Tracking
**File**: `src/components/dashboard/FourDMap.tsx`
- Track `currentZoom` (altitude) and `viewCenter` (lat/lng) from globe's point-of-view via a `pointOfView()` poll every 500ms or `onZoom` callback
- When altitude drops below **0.5** (~regional zoom), show an "AI SCAN" floating HUD button
- When altitude drops below **0.15** (~city zoom), show "STREET-LEVEL AI" option too

### 2. AI Scan HUD Overlay
**File**: `src/components/dashboard/FourDMap.tsx`
- Floating HUD panel appears at bottom-center when zoomed in:
  - **"🎯 ATR SCAN"** button — calls `c2-targeting` with current center lat/lng for military object detection
  - **"👁 STREET AI"** button — calls `streetview-detect` with center lat/lng for street-level object detection
  - Shows scanning animation while processing
  - Auto-dismiss after results rendered

### 3. Render AI Detections on Globe
**File**: `src/components/dashboard/FourDMap.tsx`
- ATR results (from `c2-targeting`): Already stored in `target_tracks` table, which the globe already renders via the `targetTracks` layer — so detections auto-appear after scan
- Street-level results: Render as temporary annotated points with detection labels (Person, Car, Military Vehicle, etc.) at scattered positions near the scan center
- Each detection shows: classification, confidence %, colored by type
- Detections persist for the session and pulse with a scan-ring animation

### 4. Scan History Badge
- Track `scanCount` and `lastScanCoords` in state
- Show small "SCANS: N" badge in the HUD
- Toast notification on completion: "ATR: 4 targets detected at 33.51°N, 36.29°E"

## Files Modified
- `src/components/dashboard/FourDMap.tsx` — zoom tracking, AI scan HUD, detection rendering

## No new edge functions or database changes needed
Both `c2-targeting` and `streetview-detect` already exist and work. ATR results auto-persist to `target_tracks`.

