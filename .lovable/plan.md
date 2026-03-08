

# Fix: Traffic Overlay Position Misaligned from Roads

## Root Cause

The projection method is wrong. The canvas is appended to the **map container div** (fixed position), but `latLngToPixel` uses `fromLatLngToDivPixel()` which returns coordinates relative to the **internal draggable div** that shifts during panning.

Since the canvas doesn't move with pans but the projected coordinates do, the overlay drifts away from the actual roads.

## Fix

**One-line change** in the `latLngToPixel` function (line 267):

Replace `fromLatLngToDivPixel` with `fromLatLngToContainerPixel`.

`fromLatLngToContainerPixel` returns coordinates relative to the map container — exactly where the canvas is positioned — so the overlay will snap precisely onto the roads regardless of pan state.

## File Changed

**`src/components/dashboard/urban3d/TrafficParticleOverlay.tsx`** — line 267: change projection method from `fromLatLngToDivPixel` to `fromLatLngToContainerPixel`.

