

# Mobile Optimization Plan

## Current State
- `RotateDeviceOverlay` exists but only shows on actual mobile devices in portrait mode
- `Index.tsx` has a mobile layout (`isMobile` = `<1024px`) with bottom tab bar (Map, Intel, Alerts, Layers)
- Full-screen modals (CyberImmunity, 4DMap, LiveChannels) use `createPortal` but have no mobile-specific responsive handling
- `DashboardHeader` buttons overflow on small screens (Live Channels, Cyber Immunity, 4D Map, Language, etc.)
- `IntelLayout` has a mobile hamburger menu already
- `StatsBar` has horizontal scrolling on mobile

## Changes

### 1. RotateDeviceOverlay — show on ALL small portrait screens
Currently only fires for UA-detected mobile devices. Change to also trigger for any viewport `<768px` in portrait, removing the strict UA check for the overlay to always appear in portrait on small screens. This ensures the overlay works in mobile browser preview too.

### 2. DashboardHeader — responsive mobile layout
- Hide text labels on buttons below `sm` breakpoint — show only icons for Live Channels, Cyber Immunity, 4D Map, Language, Alert mute
- Remove duplicate online status indicator (there are currently two)
- Wrap buttons in a horizontal scroll container on mobile to prevent overflow
- Reduce padding and gaps for `<sm` screens

### 3. StatsBar — already scrollable, add touch improvements
- Add `scroll-snap-type: x mandatory` and `scroll-snap-align: start` to stat cards for better swipe UX
- Ensure no overflow clipping on small screens

### 4. Full-screen modals — mobile viewport handling
**CyberImmunityModal** (1944 lines):
- Add responsive classes: on mobile (`<md`), make the 3-column layout stack vertically
- Left panel (tabs): convert to horizontal scrollable tab bar at top
- Center panel: full width
- Right panel (map): stack below or hide behind a toggle
- Ensure all text/buttons don't overflow

**FourDMap** (1147 lines):
- Layer sidebar: collapse by default on mobile, show as overlay
- Search bar and controls: reduce size on mobile
- Close button: larger touch target

**LiveChannelsModal**:
- Grid: switch from multi-column to single column on mobile
- Video embeds: use `aspect-video` with full width

### 5. IntelLayout — already has mobile hamburger, minor polish
- Ensure content area has proper padding on mobile (avoid overlap with hamburger button)

### 6. Index.tsx mobile layout — polish
- Ensure bottom tab bar has `safe-area-inset-bottom` padding for notched phones
- Add `pb-safe` or equivalent for iOS safe area
- Map tab should be truly full-height minus header/tabs

### 7. CSS — add safe area and mobile utilities
- Add `env(safe-area-inset-bottom)` to bottom tab bar
- Add viewport meta tag check in `index.html` (should already exist)
- Add touch-action utilities for map interactions

## Files Modified
- `src/components/RotateDeviceOverlay.tsx` — relax UA check
- `src/components/dashboard/DashboardHeader.tsx` — responsive button layout
- `src/components/dashboard/CyberImmunityModal.tsx` — responsive 3-panel layout
- `src/components/dashboard/FourDMap.tsx` — mobile sidebar/controls
- `src/components/dashboard/LiveChannelsModal.tsx` — responsive grid
- `src/pages/Index.tsx` — safe area padding, mobile polish
- `src/index.css` — safe area CSS utilities
- `index.html` — verify viewport meta tag

