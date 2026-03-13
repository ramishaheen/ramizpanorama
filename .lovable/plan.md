

# Redesign Social Sentiment Box to Match Gotham Dashboard Aesthetic

## Problem
The `SocialSentimentBox` is a simple centered placeholder with an icon and "double-click" instruction. It looks empty and out of place compared to its siblings (CitizenSecurity and SectorPredictions) which have rich headers, data previews, and the full Gotham/tactical styling.

## Solution
Redesign the box to look like a proper Gotham dashboard widget with:
- **Header bar** matching siblings: icon + title + cyan accent bar, monospace uppercase text
- **Platform status grid** showing X, Reddit, YouTube, Telegram with animated "ready" indicators
- **Quick-action area** with a visible "HARVEST" button (single click) instead of relying on double-click
- **Last scan preview** placeholder showing "No scans yet" or mini stats from previous scan
- **Scan line / grid overlay** for tactical feel

## File Changes

### 1. Edit: `src/components/dashboard/SocialSentimentBox.tsx`
Complete redesign:
- Header with cyan accent bar `▎`, `MessageSquareShare` icon, title "SOCIAL MEDIA HARVESTING", monospace styling
- Grid of 4 platform badges (X, Reddit, YT, TG) with green pulse dots indicating "ready"
- Central "HARVEST" button (single click opens modal) styled like a tactical action button with glow
- Subtle background grid/scanline CSS overlay
- Remove double-click requirement — use single click on the button
- Keep the modal integration unchanged

