

# Enhance Cyber Immunity Map — Gotham/Palantir Style

## Current State
The threat map is a simple SVG with polygon-based continent outlines, basic graticule lines, and country nodes with animated arcs. It works but looks flat and simplified — not matching the high-fidelity Gotham aesthetic used elsewhere.

## Changes

### 1. Higher-Fidelity Map Rendering
- Add **coastline glow**: subtle cyan outer stroke on continent polygons for a "radar screen" look
- Add **fill gradients** on continents: dark radial gradient from center → edges, replacing flat fill
- Add a **vignette overlay**: dark edges around the SVG for depth
- Add finer **grid lines** (every 15° instead of 30°) with thinner strokes and subtler opacity

### 2. Enhanced Country Nodes — Gotham Targeting Reticles
Replace simple circles with **tactical targeting reticles**:
- Concentric animated rings (2 rings) with rotation animation
- Cross-hair lines through the center
- Hexagonal or diamond outer shape for active threat countries
- Severity-coded pulsing core dot
- Incident count badge rendered as a small HUD readout below

### 3. Enhanced Attack Corridors
- Add **particle streams** along arc paths: small animated dots moving from source to target
- Add **impact flashes**: brief radial burst animation at the target node when a new corridor is drawn
- Gradient arcs fade from attacker color → target color

### 4. Gotham HUD Overlay Elements
- **Top-left**: "CYBER THREAT OPERATIONS CENTER" label with scanning line animation
- **Top-right**: Real-time stats (total attacks, active corridors, top attacker) in monospace HUD boxes
- **Bottom**: Subtle classification banner "UNCLASSIFIED // OSINT DERIVED"
- **Corner brackets**: Small L-shaped corner marks on the SVG map border (tactical frame)

### 5. Animated Scan Line
- A semi-transparent horizontal line that sweeps vertically across the map every ~4 seconds, simulating a radar scan effect

### 6. Interactive Improvements
- On hover, country nodes expand with a smooth scale transition and show a detailed tooltip with severity breakdown
- Active corridors highlight on hover with increased glow

## Files Changed
1. **Edit**: `src/components/dashboard/CyberImmunityModal.tsx` — `ThreatMap` component rewrite with all Gotham enhancements
2. **Edit**: `src/index.css` — Add keyframes for scan line, reticle rotation, impact flash animations

