

# Google API Integration Across All Intel Maps

## Overview
Integrate Google Places, Geocoding, Directions, and Traffic APIs into all four map views (2D Intel Map, 3D Urban Scene, 4D Globe, Orbital Intelligence). The `GOOGLE_MAPS_API_KEY` is already configured as a secret.

## Architecture

### 1. New Edge Function: `google-places` 
Proxies Google Places Nearby Search and Place Details APIs. Accepts lat/lng/radius and returns categorized POIs (military bases, airports, hospitals, embassies, government buildings, ports).

### 2. New Edge Function: `google-geocode`
Proxies Google Geocoding API (forward + reverse). Used by all maps to resolve coordinates to readable addresses and vice versa.

### 3. New Edge Function: `google-directions`
Proxies Google Directions API. Accepts origin/destination coordinates, returns polyline route, distance, and duration.

### 4. New Hook: `useGooglePlaces`
React hook calling `google-places` edge function, caches results by region, returns typed POI data with categories.

### 5. New Hook: `useGoogleGeocode`
React hook for reverse geocoding — given lat/lng returns address. Debounced, cached.

---

## Per-Map Integration

### A. 2D Intel Map (Leaflet) — `IntelMap.tsx`
- **Places Layer**: New `placesGroupRef` layer group with clustered POI markers (airports, military bases, embassies, hospitals). Each POI gets a category-colored icon and hover popup with name, address, rating, open status.
- **Geocoding**: Reverse-geocode on map right-click to show address in a popup. Add address labels to existing marker popups.
- **Directions**: Click two points to draw a route polyline with distance/duration overlay.
- **Traffic**: Add Google Traffic tile overlay as a new imagery layer option in `ImageryLayerPanel`.
- **Command Bar**: Add "GOOGLE" section with POI, Route, and Traffic toggles.

### B. 3D Urban Scene (Google Maps) — `UrbanScene3D.tsx`
- **Places**: Use Google Maps Places library directly (already loads `visualization,marker` — add `places`). Show nearby POIs as AdvancedMarkerElements with category icons.
- **Geocoding**: Show address in the HUD when map center changes.
- **Directions**: DirectionsRenderer for route visualization between clicked points.
- **Traffic**: `new google.maps.TrafficLayer()` toggle in the Layer Sidebar.

### C. 4D Globe (Globe.gl) — `FourDMap.tsx`
- **Places**: Fetch POIs for the focused region and render as globe points with category colors.
- **Geocoding**: Show resolved location name in the event feed when clicking globe points.

### D. Orbital Intelligence (Globe.gl) — `SatelliteGlobe.tsx`
- **Places**: Show strategic POI points (military/airports) on the globe surface when zoomed to a region.
- **Geocoding**: Reverse-geocode satellite ground track positions to show country/city names.

---

## New Layer in LayerControls
Add `googlePOI` to `LayerState` interface with a Google Maps pin icon, allowing users to toggle POI visibility globally.

## Files to Create
1. `supabase/functions/google-places/index.ts` — Places API proxy
2. `supabase/functions/google-geocode/index.ts` — Geocoding API proxy  
3. `supabase/functions/google-directions/index.ts` — Directions API proxy
4. `src/hooks/useGooglePlaces.ts` — Places data hook
5. `src/hooks/useGoogleGeocode.ts` — Geocoding hook

## Files to Edit
1. `src/components/dashboard/IntelMap.tsx` — Add Places layer, geocode popups, route drawing, traffic tile
2. `src/components/dashboard/UrbanScene3D.tsx` — Add Places, Traffic, Directions via Google Maps JS API
3. `src/components/dashboard/FourDMap.tsx` — Add POI globe points, geocode labels
4. `src/components/dashboard/SatelliteGlobe.tsx` — Add strategic POIs, geocode for ground tracks
5. `src/components/dashboard/LayerControls.tsx` — Add `googlePOI` layer toggle
6. `src/components/dashboard/MapCommandBar.tsx` — Add Google section with POI/Route/Traffic buttons
7. `src/components/dashboard/ImageryLayerPanel.tsx` — Add Google Traffic tile option
8. `supabase/functions/google-maps-key/index.ts` — Already exists, reused by edge functions

