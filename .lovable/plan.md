

# Simplify Social Harvesting Box — Icon & Text Only

## What changed too much
The previous redesign added platform grids, status lines, and a harvest button — the user only wanted the icon and description to look properly sized and aligned within the box. The click-to-open-modal functionality should stay as-is.

## Plan

### Edit: `src/components/dashboard/SocialSentimentBox.tsx`
Strip back to a clean, centered layout:
- **Center vertically & horizontally** a `MessageSquareShare` icon (sized ~h-8 w-8) and the title "Social Media Harvesting" below it
- Small subtitle hint: "Click to analyze sentiment"
- The entire box is clickable (opens the modal on single click)
- Keep the subtle scanline overlay and `bg-card/80` for consistency with other widgets
- Remove the platform grid, status line, harvest button, and footer — just icon + text, properly centered
- Cursor pointer on the whole box

This keeps the existing modal integration (`SocialSentimentModal`) completely unchanged.

