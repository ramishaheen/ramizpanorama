

# Connect All Layer Icons to Active Layer Toggles

## Problem
Several layers in the left panel have toggles but **no icon rendering** in the globe data update effect, and some data renders **without checking its layer toggle**:

1. **`shooterAssets`** — toggle exists, data is fetched, but NO icons rendered on globe
2. **`ontologyEntities`** — toggle exists but NO icons rendered
3. **`googlePOI`** — toggle exists, data fetched, but NO icons rendered on globe
4. **`emulatedEvents`** (OSINT) — renders icons **without any layer guard** (always visible)
5. **`dbIntelEvents` / `dbGeoAlerts`** — used in feed but not rendered as globe icons tied to a specific layer

## File: `src/components/dashboard/FourDMap.tsx`

### 1. Add Shooter Assets icon rendering (~after line 1115)
Guard with `if (layers.shooterAssets)`. Render each shooter asset with appropriate icon based on `asset_type` (e.g., `🚀` for missile battery, `💥` for artillery, `🎯` for strike aircraft). Color: `#f97316`. Include tooltip with weapon system details.

### 2. Add Google POI icon rendering (~after shooter assets)
Guard with `if (layers.googlePOI && googlePOIPoints.length)`. Render each POI with category-specific icon (`🏢` airport, `🎯` military, `🏛` embassy). Color: `#a855f7`.

### 3. Add Ontology Entities icon rendering
Guard with `if (layers.ontologyEntities)`. Since ontology data comes from the OntologyPanel hook, fetch or reference ontology entities that have lat/lng. Render with `🔗` icon, color `#8b5cf6`. If no geo-located ontology data exists, this will just be an empty-guarded section.

### 4. Guard emulated OSINT events with a layer toggle
The emulated events block at line 1050 currently has **no layer guard**. Add `if (layers.conflicts || layers.geoFusion)` guard so they respect layer toggles — these are generic OSINT events that should be tied to conflicts/geo-fusion visibility.

### 5. Add `googlePOIPoints` to the effect dependency array (line 1248)
Currently missing — icons won't update when POI data loads.

### Summary of additions in the main globe update effect:
```
// SHOOTER ASSETS
if (layers.shooterAssets) { shooterAssets.forEach(...) → layerElements.push(...) }

// GOOGLE POIs  
if (layers.googlePOI && googlePOIPoints.length) { googlePOIPoints.forEach(...) → layerElements.push(...) }

// ONTOLOGY (geo-located entities)
if (layers.ontologyEntities) { /* render if data available */ }

// EMULATED OSINT — add layer guard
if (layers.conflicts || layers.geoFusion) { emulatedEvents.forEach(...) }
```

No other files need changes.

