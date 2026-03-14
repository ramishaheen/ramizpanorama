

# Fix: Map Tooltip/Popup Z-Index Priority

## Problem
Leaflet popups and tooltips on the main map render behind dashboard overlays (header bar, toolbar, layer panel, etc.) which all use `z-[1000]`. Leaflet's default popup z-index is ~700, so they get buried.

## Fix

### File: `src/index.css`
Add global CSS overrides for Leaflet popup and tooltip z-index to ensure they render above all dashboard UI elements:

```css
/* Leaflet popups & tooltips above all overlays */
.leaflet-popup {
  z-index: 10001 !important;
}
.leaflet-tooltip {
  z-index: 10001 !important;
}
.leaflet-popup-pane {
  z-index: 10001 !important;
}
.leaflet-tooltip-pane {
  z-index: 10001 !important;
}
```

This is a single CSS addition — no component changes needed. The value `10001` places popups above all dashboard overlays (which max at `z-[1000]` on the main map view).

