

## Plan: Robust CCTV Streaming Architecture

The database already has `proxy_url` and `stream_type_detected` columns. The cameras edge function and frontend component exist. No `stream-proxy` function exists yet. 169 cameras in the DB, mostly YouTube embeds with `stream_type_detected = 'embed'`.

### Step 1: Install hls.js
Add `hls.js` package dependency.

### Step 2: Create stream-proxy edge function
New file `supabase/functions/stream-proxy/index.ts`:
- `proxy` action: fetches snapshot/MJPEG URLs server-side, returns binary with CORS headers
- `detect` action: probes a URL, returns detected stream type (hls/mjpeg/snapshot/embed/rtsp)
- `rtsp_check` action: attempts RTSP connection check, returns status
- Add `[functions.stream-proxy] verify_jwt = false` to config.toml

### Step 3: Enhance cameras edge function
- Add `auto_detect` action: probes URL, determines type, updates `stream_type_detected` column
- Improve `health_check`: smarter validation with content-type detection, auto-disable cameras after 3 consecutive failures (add `failure_count` column)
- Add `proxy_snapshot` action: fetches snapshot and returns base64

### Step 4: Database migration
- Add `failure_count integer default 0` column to cameras table

### Step 5: Upgrade FeedViewer in LiveCamerasModal.tsx
- Import and use HLS.js for `.m3u8` streams with error recovery
- Route snapshots through stream-proxy to bypass CORS, auto-refresh every 5s
- MJPEG: use `<img>` with proxy URL
- Embeds: reduce block-detection timeout from 8s to 4s
- Fallback cascade: HLS → snapshot proxy → direct embed → "open externally"
- Exponential backoff reconnection: 2s → 4s → 8s → show "Unavailable"
- RTSP: attempt proxy passthrough, fall back to external link

### Step 6: Set up pg_cron health monitoring
- Enable pg_cron and pg_net extensions via migration
- Insert cron job to call cameras health_check every 10 minutes
- Health check auto-disables cameras with `failure_count >= 3`

### Files Changed
- `package.json` — add `hls.js`
- `supabase/functions/stream-proxy/index.ts` — new proxy function
- `supabase/functions/cameras/index.ts` — auto_detect, smarter health_check, proxy_snapshot
- `supabase/config.toml` — add stream-proxy entry
- `src/components/dashboard/LiveCamerasModal.tsx` — HLS.js, proxy routing, reconnection logic
- Database migration — add `failure_count` column
- Cron job insert — scheduled health checks

