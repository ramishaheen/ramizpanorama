

# Animate Live Attack Flows on Cyber Threat Map

## What the user wants
Show attacks happening in real-time on the map — animated projectiles/particles traveling along the arc paths from attacker to target countries, making it visually obvious *how* and *where* attacks are flowing.

## Current State
`CyberThreatMapLeaflet.tsx` already has:
- Static arc polylines (dashed, low opacity) between attacker→target
- Corridor glow lines aggregating attack pairs
- Reticle markers at country nodes with pulse CSS
- But **no animated projectiles** — arcs are static dashed lines

## Plan

### 1. Add Animated Attack Projectiles (`CyberThreatMapLeaflet.tsx`)
Create a new `AttackProjectiles` inner component using `useMap()` that:
- For each arc (up to 30 threats), creates a small glowing dot (`L.circleMarker`) that travels along the arc path points in a loop
- Uses `requestAnimationFrame` to smoothly interpolate position along the bezier arc points
- Projectile color matches severity (red/orange/yellow/blue)
- Critical attacks get larger, faster projectiles with a trail effect
- Each projectile has a staggered start time so they don't all fire at once
- On reaching the target, briefly flash/pulse the target node

### 2. Add Impact Ripple Effect
When a projectile reaches its destination:
- Spawn a temporary expanding `CircleMarker` at the target that fades out over 1 second
- This creates a visual "impact" effect showing the attack landing

### 3. Add CSS Animations (`src/index.css`)
- `.cyber-projectile-trail` — fading trail behind moving dot
- `.cyber-impact-ripple` — expanding ring at target on impact
- Enhance existing `.cyber-arc-animated` with `stroke-dashoffset` animation so the dashed arcs themselves appear to flow

### 4. Add Live Attack Feed Ticker on Map
A small bottom-left HUD strip showing the latest 3 attacks as they fire:
- `"🔴 Iran → Israel | DDoS | CRITICAL"` scrolling entries
- Auto-updates as new projectiles launch

### Technical Approach
- The `AttackProjectiles` component will use a `useEffect` with `requestAnimationFrame` loop
- Maintain an array of active projectile states: `{ arcIndex, progress: 0-1, speed }`
- On each frame, advance `progress` by `speed * dt`, interpolate position along arc points
- When `progress >= 1`, trigger impact ripple, reset with new random delay
- Clean up all markers and animation frame on unmount

### Files to modify:
- **`src/components/dashboard/cyber/CyberThreatMapLeaflet.tsx`** — Add `AttackProjectiles` component, impact ripples, live ticker
- **`src/index.css`** — Add projectile/impact CSS animations, enhance arc dash animation

