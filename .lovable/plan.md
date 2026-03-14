

# Palantir-Style Analysis Tools Panel for Gotham 4D Zoom View

## What the user wants
When zooming into an event on the Gotham 4D globe (which opens the Inline3DView), a **left-side analysis tools panel** should appear — matching the Palantir reference screenshot. This panel provides military geospatial analysis tools organized into collapsible sections with actionable buttons.

## Reference Analysis (from uploaded image)
The panel has a dark sidebar with:
- **Top tabs**: Map layers | Data sources | **Tools**
- **Search bar**: "Find..."
- **Collapsible tool sections**, each with a title, description, and 2-4 tool buttons as icon+label chips:
  1. **Range Ring** — Range ring, Intervisibility, Ballistic
  2. **Alerts** — Geofence, Proximity
  3. **Terrain** — Slope, Land cover, Pathways, Projection, Route + "Guided workflow →"
  4. **Key Terrain** — Peaks, Bridges, Key terrain + "Guided workflow →"
  5. **Heatmap** — Heatmap, Choropleth
  6. **GRG Builder** — Sequential reference points
- **Bottom**: Coordinate display + MGRS + elevation + search nearby

## Plan

### New Component: `src/components/dashboard/GeoAnalysisToolsPanel.tsx`
A left-docked sidebar panel (~240px) that appears inside `Inline3DView` when the 3D map loads. Sections:

1. **Range Ring** — Tools: Range Ring (draws concentric circles at 1/5/10km from target), Intervisibility (line-of-sight check), Ballistic (trajectory arc)
2. **Alerts** — Tools: Geofence (define alert perimeter), Proximity (distance alerts)
3. **Terrain** — Tools: Slope, Land Cover, Pathways, Projection, Route. Each renders a toast/notification indicating the tool is activated. "Guided workflow →" link.
4. **Key Terrain** — Tools: Peaks, Bridges, Key Terrain. "Guided workflow →" link.
5. **Heatmap** — Tools: Heatmap (density overlay), Choropleth
6. **GRG Builder** — Grid Reference Graphic overlay

**Tool activation behavior**: Each tool button toggles an active state. Active tools show visual feedback (highlighted border, filled background). Some tools (Range Ring, Geofence) draw overlays on the Google Map via the existing `mapRef`. Others show a toast confirming activation.

**Range Ring implementation**: When activated, draws 3 concentric `google.maps.Circle` at 1km, 5km, 10km radii from the target lat/lng with semi-transparent red fill — matching the reference image's red circles.

### Modifications to `src/components/dashboard/Inline3DView.tsx`
- Import and render `GeoAnalysisToolsPanel` on the left side
- Pass `mapRef`, `lat`, `lng` to the panel
- Add a toggle button to show/hide the tools panel
- Move the coordinate HUD to include MGRS grid ref + elevation display (bottom-right, matching reference)

### Bottom info bar
Add a bottom bar to `Inline3DView` showing:
- MGRS coordinate (computed from lat/lng)
- Elevation placeholder
- Bearing
- "Search nearby" button

## Files to create/modify
1. **Create** `src/components/dashboard/GeoAnalysisToolsPanel.tsx` — The tools sidebar
2. **Modify** `src/components/dashboard/Inline3DView.tsx` — Integrate the panel + bottom bar

