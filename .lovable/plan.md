

# Move Flight Emulation Panel to Orbital Intelligence Only

## What changes

1. **Remove from IntelMap.tsx** — Delete the `FlightEmulationPanel` import and its render block (lines ~31, 1965-1973).

2. **Add to SatelliteGlobe.tsx** — Import `FlightEmulationPanel` and render it inside the Orbital Intelligence fullscreen portal. The globe component will need to fetch/emulate flight data internally (or receive it as a prop). Since flights are currently fetched in `IntelMap`, the simplest approach is to add flight data as optional props to `SatelliteGlobeProps` and pass them through from `IntelMap`.

### Detailed steps

- **`SatelliteGlobeProps`**: Add optional props `flights`, `trackedFlightId`, `onTrackFlight`, `flightSource`.
- **`SatelliteGlobe` render**: Place `<FlightEmulationPanel>` inside the portal overlay (top-left, same positioning).
- **`IntelMap.tsx`**: Remove standalone `<FlightEmulationPanel>` render. Pass flight data through to `<SatelliteGlobe>` instead.

### Files
- `src/components/dashboard/IntelMap.tsx` — remove panel, pass flight props to SatelliteGlobe
- `src/components/dashboard/SatelliteGlobe.tsx` — accept flight props, render FlightEmulationPanel inside orbital view

