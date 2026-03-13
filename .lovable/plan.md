

# Inline 3D Realistic View Within Gotham 4D

## What Changes

When clicking a feed item, instead of just zooming the globe closer, a Google Maps 3D satellite view (with Photorealistic Tiles, tilt 45°) replaces the globe area **inline** — all surrounding panels (left layer sidebar, right feed/targets panel, HUD, stats bar) remain visible. A "BACK TO GLOBE" button returns to the normal globe view.

## Architecture

```text
┌──────────────────────────────────────────────────┐
│  LEFT PANEL  │  GLOBE CONTAINER (flex-1)  │ RIGHT│
│  (layers,    │  ┌────────────────────────┐ │PANEL │
│   stats)     │  │ Globe.gl (default)     │ │(feed,│
│              │  │    ── OR ──            │ │tabs) │
│              │  │ Google Maps 3D (zoom)  │ │      │
│              │  │ + "BACK TO GLOBE" btn  │ │      │
│              │  └────────────────────────┘ │      │
└──────────────────────────────────────────────────┘
```

## Implementation

### New Component: `src/components/dashboard/Inline3DView.tsx`

A lightweight Google Maps 3D component that renders **inside** the globe container div (not as a portal). It:
- Accepts `lat`, `lng`, `onClose` props
- Loads Google Maps API key from the existing `google-maps-key` edge function (same as UrbanScene3D)
- Creates a `google.maps.Map` with `mapTypeId: "satellite"`, `tilt: 45`, `heading: 0`, `zoom: 18`, `mapId: "WAROS_3D_MAP"`
- Shows a floating "BACK TO GLOBE" button (top-left) that calls `onClose`
- Shows coordinate HUD and zoom level
- Includes all existing overlays that work on Google Maps: `LiveIncidentsOverlay`, `WeatherRadarOverlay`, `TrafficParticleOverlay`
- Fills 100% of its parent container

### Modify: `src/components/dashboard/FourDMap.tsx`

1. **Add state**: `const [inline3DTarget, setInline3DTarget] = useState<{lat: number; lng: number} | null>(null);`

2. **Update `handleFeedClick`**: After globe zoom animation, set the inline 3D target:
```tsx
const handleFeedClick = useCallback((lat: number, lng: number) => {
  const globe = globeRef.current;
  if (globe) {
    globe.pointOfView({ lat, lng, altitude: 0.5 }, 1200);
  }
  setTimeout(() => setInline3DTarget({ lat, lng }), 1400);
}, []);
```

3. **Render inline 3D view** inside the globe container div (line ~1094), conditionally overlaying the globe:
```tsx
<div className="flex-1 relative overflow-hidden" style={{ minWidth: 0 }}>
  <div ref={globeContainerRef} className="absolute inset-0" />
  {inline3DTarget && (
    <Inline3DView
      lat={inline3DTarget.lat}
      lng={inline3DTarget.lng}
      onClose={() => setInline3DTarget(null)}
    />
  )}
  {/* ...existing HUD, search, workbench... */}
</div>
```

The `Inline3DView` renders as `absolute inset-0 z-10` inside the same container, covering the globe but keeping all surrounding panels untouched.

### Files
- **Create**: `src/components/dashboard/Inline3DView.tsx`
- **Modify**: `src/components/dashboard/FourDMap.tsx` (state + handler + render)

