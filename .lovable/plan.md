

# AI Source Collection for Incidents + Enhanced Map Layers

## Problem
1. **No AI source aggregation**: When viewing an incident/location in the 3D view, the system doesn't automatically collect and display all available intelligence sources for that area (geo_alerts, intel_events, conflict events, earthquakes, wildfires, AIS vessels, sensor feeds, etc.)
2. **Map Layers tab is limited**: Only has 4 base map types and 3 Google overlays (traffic/transit/bicycling). It's missing the rich intelligence layers available in the 4D globe (satellites, conflicts, earthquakes, wildfires, vessels, nuclear, air quality, etc.)

## Plan

### 1. Create `AISourceCollector` component (new file)
A panel/modal triggered from the 3D view that:
- Takes the current lat/lng coordinates
- Calls an AI backend function to aggregate ALL nearby intelligence sources
- Queries in parallel:
  - `geo_alerts` — nearby alerts within radius
  - `intel_events` — nearby intel events
  - `target_tracks` — nearby tracked targets
  - `sensor_feeds` — sensors covering the area
  - `force_units` — nearby military units
  - Conflict events (via edge function)
  - Earthquakes (via USGS edge function)
  - Wildfires (via NASA FIRMS edge function)
  - AIS vessels (via edge function)
  - Weather data (via edge function)
  - Air quality (via edge function)
- Sends all collected data to Lovable AI (Gemini 2.5 Flash) for a unified situational assessment
- Displays results in a scrollable panel with:
  - Source count badges by category (SIGINT, OSINT, GEOINT, HUMINT, etc.)
  - Confidence score per source
  - AI-generated summary of the situation at that location
  - "Plot on Map" button per source to add markers
  - Localization confidence (AI estimates location accuracy based on source convergence)

### 2. Create `ai-source-collect` edge function (new)
- Accepts `{ lat, lng, radius_km }` 
- Queries all DB tables for nearby data (geo_alerts, intel_events, target_tracks, sensor_feeds, force_units)
- Calls external APIs: conflict-events, usgs-earthquakes, nasa-wildfires, ais-vessels, weather-data, air-quality
- Sends aggregated data to Gemini 2.5 Flash for analysis
- Returns: categorized sources array + AI assessment + localization confidence

### 3. Enhance Map Layers tab in `GeoAnalysisToolsPanel`
Add intelligence overlay layers that draw on the Google Maps 3D view:
- **INTELLIGENCE OVERLAYS** section:
  - Geo Alerts (from `geo_alerts` table → markers)
  - Intel Events (from `intel_events` table → markers)
  - Conflict Events (via hook → markers)
  - Earthquakes (via hook → circle markers scaled by magnitude)
  - Wildfires / Thermal (via hook → heat markers)
  - AIS Vessels (via hook → ship markers)
  - Nuclear Facilities (via hook → radiation markers)
  - Air Quality (via hook → colored zones)
  - Sensor Coverage (from `sensor_feeds` → radius circles)
  - Force Units Blue/Red (from `force_units` → tactical markers)
  - Target Tracks (from `target_tracks` → crosshair markers)
- Each layer: toggle on/off, fetches data, renders Google Maps markers/circles
- Active layer count badge

### 4. Integrate into Inline3DView
- Add "AI COLLECT" button in the top controls bar
- When clicked, opens the AISourceCollector panel as a slide-out from the right
- Sources can be plotted directly onto the 3D map

## Files
1. **Create** `src/components/dashboard/AISourceCollector.tsx` — AI source aggregation panel
2. **Create** `supabase/functions/ai-source-collect/index.ts` — backend aggregation + AI analysis
3. **Modify** `src/components/dashboard/GeoAnalysisToolsPanel.tsx` — add intelligence overlay layers to Map Layers tab + render them on map
4. **Modify** `src/components/dashboard/Inline3DView.tsx` — add AI COLLECT button + integrate collector panel

