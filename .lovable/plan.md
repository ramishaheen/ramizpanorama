

# Fix: Traffic Overlay Full Road Coverage

## Root Causes Identified

After analyzing the code and network requests, I found several issues preventing full road coverage:

### 1. Canvas Pane Wrong Layer
The canvas is appended to `overlayLayer`, which in Google Maps 3D (Photorealistic Tiles) renders **behind** the 3D buildings and tiles. It should use `overlayMouseTarget` or a custom div appended directly to the map container.

### 2. Stale Closures in Event Listeners
The `idle` listener and `fetchRoads` callback have stale references:
- `useEffect` depends on `zoom >= MIN_ZOOM` (a boolean), not the actual `zoom` value, so re-fetching doesn't trigger on zoom changes
- `fetchRoads` is memoized on `[zoom]` but the `idle` listener captures the old `fetchRoads`

### 3. Bbox Padding Insufficient + Cache Key Blocks Re-fetch
- 50% padding is applied but the viewport at zoom 17+ is tiny (~0.01°), so panning slightly leaves roads behind
- `lastFetchRef` caching prevents re-fetch on pan since the `idle` listener resets it, but the bbox string comparison is exact — a 1-pixel pan produces a different string yet the old data is already cleared

### 4. Overpass Query Too Broad
Sending 14 separate `way["highway"="X"]` clauses makes the query large. A single regex filter would be faster and more reliable.

---

## Plan

### A. Fix Canvas Rendering Layer
- Append canvas to the **map container div directly** instead of using `overlayLayer` pane
- Position it absolutely over the map with `pointer-events: none` and high z-index
- Use `MapCanvasProjection` from the overlay for coordinate projection only

### B. Fix Stale Closure Issues
- Change `useEffect` dependency from `zoom >= MIN_ZOOM` to actual `zoom` value
- Add `fetchRoads` to the `idle` listener's dependency array
- Use refs for the latest `fetchRoads` to avoid stale closures in the `idle` callback

### C. Increase Coverage & Improve Re-fetch Logic
- Increase bbox padding to **100%** of viewport (was 50%)
- Debounce re-fetch on pan/zoom with a 300ms delay instead of relying on exact bbox string matching
- Always re-fetch on `idle` events (remove the `lastFetchRef` exact-match guard, replace with a time-based throttle of ~2 seconds)

### D. Optimize Overpass Query
- Use a single `way["highway"~"motorway|trunk|primary|secondary|tertiary|residential|service|unclassified|living_street"]` regex filter instead of 14 separate clauses — faster response, same data

### E. Ensure Overlay Stays in Sync with Camera
- On the `draw()` callback of the OverlayView, trigger a canvas resize AND re-render (not just resize)
- Store the current projection transform so the animation loop uses the latest camera position, not a cached one

---

## Files Changed

**`src/components/dashboard/urban3d/TrafficParticleOverlay.tsx`** — all fixes above in a single file rewrite

## Technical Details

```text
Before:  overlayLayer pane → canvas hidden behind 3D tiles
After:   map container div → canvas on top with z-index

Before:  14 × way["highway"="X"] clauses
After:   1 × way["highway"~"regex"] clause

Before:  50% bbox padding, exact-string cache
After:   100% bbox padding, time-throttled re-fetch (2s)

Before:  useEffect dep: zoom >= MIN_ZOOM (boolean)
After:   useEffect dep: zoom (number)
```

