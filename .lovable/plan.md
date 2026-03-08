

## Plan: Robust CCTV Streaming Architecture

### Problem
Cameras show "Unavailable" or "Broken link" because:
1. Many embed URLs are blocked by X-Frame-Options/CORS
2. No stream proxy exists for RTSP sources
3. No HLS.js player for `.m3u8` streams (native `<video>` doesn't support HLS in most browsers)
4. Health checks run only on manual trigger, not automatically
5. No auto-detection of stream type when cameras are added

### Changes

**1. Add HLS.js for proper HLS playback** (`src/components/dashboard/LiveCamerasModal.tsx`)
- Install `hls.js` package
- Update `FeedViewer` to use HLS.js for `.m3u8` streams instead of raw `<video src>`
- Add DASH/WebRTC fallback detection

**2. Create a stream proxy edge function** (`supabase/functions/stream-proxy/index.ts`)
- Proxies snapshot URLs through the backend to avoid CORS/mixed-content issues
- For snapshot cameras: fetches the JPEG and returns it with proper CORS headers
- For embed URLs: validates and returns metadata about stream compatibility
- Auto-detects stream type from URL patterns and content-type headers

**3. Enhance the cameras edge function** (`supabase/functions/cameras/index.ts`)
- Add `auto_detect` action that probes a URL, determines stream type (HLS/MJPEG/snapshot/embed/RTSP), and stores it
- Improve `health_check` to be smarter: check content-type headers, follow redirects, detect YouTube availability via oEmbed
- Add `proxy_snapshot` action that fetches a snapshot image and returns it as base64 or binary

**4. Upgrade FeedViewer component** (`src/components/dashboard/LiveCamerasModal.tsx`)
- **HLS streams**: Use HLS.js with error recovery and level switching
- **Snapshots**: Route through proxy to bypass CORS; auto-refresh every 5s
- **MJPEG**: Use `<img>` tag with proxy URL
- **Embeds**: Keep iframe approach but with better block detection and faster timeout (4s instead of 8s)
- **Fallback cascade**: HLS → snapshot proxy → direct embed → "open externally" button
- Add reconnection logic: on stream error, retry 3 times with exponential backoff before showing "unavailable"

**5. Add database column for proxy URLs** (migration)
- Add `proxy_url` and `stream_type_detected` columns to `cameras` table
- `stream_type_detected`: enum of `hls | mjpeg | snapshot | embed | rtsp | unknown`

**6. Auto health monitoring via cron** (database insert)
- Set up a `pg_cron` job to call the cameras health_check endpoint every 10 minutes
- Failed cameras get marked inactive with error messages

**7. Update config.toml** for new edge function
- Add `[functions.stream-proxy]` with `verify_jwt = false`

### Files Modified
- `src/components/dashboard/LiveCamerasModal.tsx` — HLS.js integration, proxy snapshot loading, reconnection logic
- `supabase/functions/cameras/index.ts` — auto-detect action, proxy-snapshot action, smarter health checks
- `supabase/functions/stream-proxy/index.ts` — new edge function for CORS proxy
- Database migration — add `proxy_url`, `stream_type_detected` columns
- `package.json` — add `hls.js` dependency

### Technical Details

```text
Camera URL Added
       │
       ▼
  Auto-Detect (edge fn)
       │
  ┌────┴────┬─────────┬──────────┬─────────┐
  HLS      MJPEG   Snapshot   Embed     RTSP
  │         │        │          │         │
  HLS.js   <img>   Proxy→     iframe    Mark as
  player   proxy   refresh    w/block   "needs
           URL     every 5s   detect    gateway"
```

Reconnection flow:
```text
Stream Error → Wait 2s → Retry #1 → Wait 4s → Retry #2 → Wait 8s → Retry #3 → Show "Unavailable"
```

