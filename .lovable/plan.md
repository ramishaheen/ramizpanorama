

## Plan: Fix CCTV Camera Feed Issues

### Root Causes Identified

1. **Duplicate YouTube URLs**: Multiple cameras point to the same YouTube video. For example, video `DcyV79s0oWU` is assigned to Tehran, Moscow, AND Aqaba. 6 cameras share `MfIpyflPbHQ`, 5 share `GKuz7vjLIJo`, etc. This means the AI discovery inserted fake/wrong data.

2. **Health check false negatives**: The `validateCameraUrl` function uses YouTube's oembed API (`/oembed?url=...`) which returns 404 for many valid live streams, incorrectly marking 24 cameras as "error" when they actually work on YouTube.

3. **YouTube embed "Video unavailable"**: YouTube blocks iframe embedding for some videos. The current code detects this after 4 seconds and shows "FEED UNAVAILABLE" with no clear way to watch the feed. Per your preference, these should stay online with a prominent "Watch on YouTube" button.

4. **Embed timeout too short**: 4s is aggressive for YouTube embeds, especially on slower connections.

### Changes

#### 1. Fix health check logic (`supabase/functions/cameras/index.ts`)
- Replace oembed-based validation for YouTube URLs with a `noembed.com/embed` check OR just assume YouTube URLs with valid video IDs are "active" (YouTube's oembed is unreliable for live streams)
- Only mark as error if the video ID format is invalid or the page returns a definitive "removed" signal

#### 2. Deduplicate cameras (database cleanup via migration or edge function call)
- Remove duplicate cameras that share the same `embed_url`, keeping only the first entry per unique URL
- This will fix the inflated counts (169 → ~140 unique)

#### 3. Improve FeedViewer embed handling (`LiveCamerasModal.tsx`)
- Increase embed detection timeout from 4s to 8s for YouTube specifically
- When embed is "blocked", show a clear "RESTRICTED EMBED" label (not "offline") with a large, prominent "Watch on YouTube" button
- Add YouTube thumbnail as background while loading / when restricted: `https://img.youtube.com/vi/{ID}/mqdefault.jpg`
- Remove the `onError` detection on `<iframe>` that marks as blocked (YouTube iframes don't fire onerror for embedding restrictions)

#### 4. Fix YouTube error message detection
- The `window.addEventListener("message")` handler checking for `"onError"` catches legitimate buffering events. Make it more specific: only trigger on `errorCode` values 150 (blocked) and 101 (removed/private)

#### 5. Update status display
- Cameras whose YouTube URL is valid but embedding is restricted show "RESTRICTED" badge (amber) instead of red "OFFLINE"
- Stats should count these as "online" not "error"

### Files Changed
- `supabase/functions/cameras/index.ts` -- fix YouTube validation, add dedup action
- `src/components/dashboard/LiveCamerasModal.tsx` -- embed timeout, restricted state, YouTube thumbnail fallback, better error detection
- Database: delete duplicate camera rows (via edge function call or migration)

### Technical Detail
The YouTube oembed check (`youtube.com/oembed?url=...&format=json`) returns 404 for:
- Live streams that are currently broadcasting
- Unlisted videos
- Some region-restricted videos

Replacing with a simple video ID format validation + `noembed.com` as backup, or just checking that the embed iframe loads without error code 150/101, is far more reliable.

