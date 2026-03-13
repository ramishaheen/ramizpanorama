

# Feed Click → 3D Realistic View in Gotham 4D

## What Changes

When clicking any feed item in Gotham 4D (EVENT FEED, SENSORS, LINKS, TARGETS, etc.), the globe first zooms to the location, then after a brief delay opens `UrbanScene3D` overlaid within the Gotham 4D view at that exact coordinate — showing Google Maps Photorealistic 3D Tiles for a realistic ground-level view.

## Implementation

### File: `src/components/dashboard/FourDMap.tsx`

1. **Add state** for the 3D scene target:
```tsx
const [urban3DTarget, setUrban3DTarget] = useState<{lat: number; lng: number} | null>(null);
```

2. **Update `handleFeedClick`** — after the globe zoom animation completes (~1200ms), open UrbanScene3D:
```tsx
const handleFeedClick = useCallback((lat: number, lng: number) => {
  const globe = globeRef.current;
  if (globe) globe.pointOfView({ lat, lng, altitude: 1.0 }, 1200);
  // After zoom completes, open 3D realistic view
  setTimeout(() => setUrban3DTarget({ lat, lng }), 1300);
}, []);
```

3. **Import and render `UrbanScene3D`** inside the globe area (alongside TargetingWorkbench), as an overlay that fills the globe container:
```tsx
import { UrbanScene3D } from "./UrbanScene3D";

// In the render, after the TargetingWorkbench block:
{urban3DTarget && (
  <UrbanScene3D
    key={`${urban3DTarget.lat}-${urban3DTarget.lng}`}
    onClose={() => setUrban3DTarget(null)}
    initialCoords={{ lat: urban3DTarget.lat, lng: urban3DTarget.lng }}
    initialEvent={{
      title: `FEED TARGET`,
      lat: urban3DTarget.lat,
      lng: urban3DTarget.lng,
      severity: "high",
      source: "GOTHAM 4D",
    }}
  />
)}
```

The `UrbanScene3D` component already handles everything — Google Photorealistic Tiles, search, style presets (NVG/Thermal/CRT), layer overlays, flight tracking, and has its own close button. It renders as a full-screen portal overlay, so it will stack on top of the globe naturally.

### Single file change
Only `src/components/dashboard/FourDMap.tsx` needs modification — 3 small edits (import, state, handler update, render block).

