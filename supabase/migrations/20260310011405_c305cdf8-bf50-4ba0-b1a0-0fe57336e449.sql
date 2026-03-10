
-- Create camera_events table for AI detection events
CREATE TABLE public.camera_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  camera_id UUID REFERENCES public.cameras(id) ON DELETE CASCADE NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'unknown',
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0,
  detections JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'low',
  thumbnail_url TEXT,
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.camera_events ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "Public read camera_events" ON public.camera_events FOR SELECT TO public USING (true);

-- Service write
CREATE POLICY "Service insert camera_events" ON public.camera_events FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Service delete camera_events" ON public.camera_events FOR DELETE TO public USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.camera_events;

-- Add ai_detection_enabled to cameras
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS ai_detection_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS last_ai_analysis_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.cameras ADD COLUMN IF NOT EXISTS ai_event_count INTEGER NOT NULL DEFAULT 0;
