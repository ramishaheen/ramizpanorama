

## Plan: Holographic Map Overlays for Object Detection

### What
Add holographic visual effects (rotating rings, scanning grid, hexagonal shapes, animated borders) around object detection areas on the map. When "Object Detection" is selected, immediately show a glowing scan circle on the map at the current position, then enhance it with holographic overlays once results arrive.

### Changes

**File: `src/components/dashboard/GeoAIPanel.tsx`**

1. **Show scan circle immediately when Object Detection is selected and analysis starts** — before waiting for results, draw a holographic scanning circle on the map with animated dashed stroke and rotating scanner effect to give instant visual feedback.

2. **Replace plain Circle overlay with holographic overlays** using multiple layered Google Maps elements:
   - **Outer holographic ring**: A `Circle` with dashed/glowing cyan stroke, pulsing opacity animation
   - **Inner scan grid**: SVG-based `GroundOverlay` or additional `Circle` rings at 33% and 66% radius with thin holographic strokes
   - **Hexagonal detection zone markers**: For each detected object, render a hexagon-shaped marker (SVG) instead of plain circles, with rotating border animation and glow effect
   - **Scan sweep line**: An animated `Polyline` that rotates around the center point (updated via `setInterval`) simulating a radar sweep

3. **Holographic marker styling** for detected objects:
   - Replace round dot markers with diamond/hexagon SVG shapes
   - Add rotating dashed border ring around each detection
   - Holographic label with semi-transparent background and cyan/green tint
   - Connecting lines from each detection back to center point using `Polyline`

4. **CSS animations** — extend the injected `geoai-pulse-style` with:
   - `geoai-rotate`: 360deg rotation for scanner sweep (8s linear infinite)
   - `geoai-holo-flicker`: opacity flicker effect (0.6 → 1.0 → 0.8)
   - `geoai-hex-pulse`: scale pulse for hexagonal markers
   - `geoai-dash-march`: stroke-dashoffset animation for marching ants effect

5. **Immediate scan circle on analysis start**: In `runAnalysis`, when `analysisType === "objects"`, immediately call a new `showScanArea()` function that places the holographic circle on the map before the API returns, giving the user instant feedback that the area is being scanned.

6. **Clear on type change**: When user switches away from Object Detection, auto-clear the holographic overlays.

### Files to modify
- `src/components/dashboard/GeoAIPanel.tsx` — All changes above

