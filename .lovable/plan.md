

# Aircraft Route Emulation on Main Map

## Current State
The main Leaflet map (`IntelMap.tsx`) already has:
- Live flight data fetched every 15s from the `live-flights` edge function
- Real-time interpolation engine (200ms tick) that moves aircraft between polls based on heading + velocity
- Trail polylines (last 10 min of positions, up to 20 points)
- Forward prediction lines (2-5 min ahead, dotted)
- Click-to-track with auto-pan

**What's missing**: When you zoom into a tracked aircraft, the movement still feels static — the interpolation interval is 200ms (choppy), the map doesn't smoothly follow, and there's no enhanced route visualization or realistic banking/turning behavior.

## Changes

### 1. Smoother Interpolation When Tracking
- Reduce interpolation tick from 200ms to **60ms** when an aircraft is actively tracked (keeps 200ms otherwise for performance)
- Add heading smoothing: lerp heading changes over multiple ticks instead of snapping, so the aircraft icon rotates gradually
- Add altitude-based vertical rate interpolation for the popup HUD

### 2. Auto-Zoom on Track
- When user clicks to track an aircraft, auto-zoom the map to **zoom level 10** (close enough to see movement) with smooth animation
- Keep the smooth `panTo` following but increase frequency — pan every interpolation tick instead of only on >0.01° changes
- When un-tracking, restore previous zoom level

### 3. Enhanced Route Trail When Tracked
- When an aircraft is tracked, render a thicker, glowing trail polyline with gradient opacity (older = more transparent)
- Extend trail retention from 20 to 40 points for tracked aircraft
- Add animated "moving dot" along the trail using CSS animation on a small circle marker at the aircraft position

### 4. Realistic Aircraft Icon Animation
- Add CSS transitions on the aircraft icon's `transform:rotate()` so heading changes animate smoothly instead of snapping
- Add a subtle scale pulse when the aircraft is tracked and moving
- Add wing-tilt visual: slight `skewY` transform based on heading change rate (banking in turns)

## Files Changed
1. **Edit**: `src/components/dashboard/IntelMap.tsx`
   - Interpolation engine: conditional 60ms vs 200ms tick based on `trackedFlightId`
   - Heading smoothing with angular lerp in interpolation loop
   - Auto-zoom to level 10 on track, restore on un-track
   - Enhanced trail (40 points, thicker glow) for tracked aircraft
   - Smoother pan-to (every tick, smaller threshold)
2. **Edit**: `src/index.css`
   - Add CSS transitions for `.flight-icon-svg` rotation smoothing
   - Add banking animation keyframes
   - Add moving-dot trail animation

