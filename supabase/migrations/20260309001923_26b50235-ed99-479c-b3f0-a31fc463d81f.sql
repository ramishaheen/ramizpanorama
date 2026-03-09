ALTER TABLE public.cameras 
  ADD COLUMN IF NOT EXISTS youtube_video_id text,
  ADD COLUMN IF NOT EXISTS original_url text,
  ADD COLUMN IF NOT EXISTS playable_url text,
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS verification_error text,
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false;

UPDATE public.cameras 
SET youtube_video_id = substring(embed_url from 'youtube\.com/embed/([A-Za-z0-9_-]{11})')
WHERE embed_url LIKE '%youtube.com/embed/%' AND youtube_video_id IS NULL;

UPDATE public.cameras 
SET original_url = COALESCE(embed_url, stream_url, snapshot_url)
WHERE original_url IS NULL;

UPDATE public.cameras 
SET verification_status = CASE
  WHEN youtube_video_id IS NOT NULL THEN 'verified_youtube'
  WHEN stream_type_detected = 'hls' THEN 'verified_hls'
  WHEN stream_type_detected = 'snapshot' THEN 'verified_snapshot'
  WHEN stream_type_detected = 'mjpeg' THEN 'verified_mjpeg'
  WHEN stream_type_detected = 'rtsp' THEN 'proxy_required'
  WHEN stream_type_detected = 'embed' THEN 'page_only'
  ELSE 'pending'
END,
is_verified = CASE
  WHEN youtube_video_id IS NOT NULL THEN true
  WHEN stream_type_detected IN ('hls', 'snapshot', 'mjpeg') THEN true
  ELSE false
END;