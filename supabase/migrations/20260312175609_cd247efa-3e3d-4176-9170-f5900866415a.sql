
CREATE TABLE public.ai_detections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading double precision DEFAULT 0,
  detections jsonb NOT NULL DEFAULT '[]'::jsonb,
  scene_summary text DEFAULT '',
  object_count integer DEFAULT 0,
  source text DEFAULT 'streetview',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  user_id uuid DEFAULT NULL
);

ALTER TABLE public.ai_detections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read ai_detections" ON public.ai_detections FOR SELECT TO public USING (true);
CREATE POLICY "Public insert ai_detections" ON public.ai_detections FOR INSERT TO public WITH CHECK (true);

CREATE INDEX idx_ai_detections_location ON public.ai_detections (lat, lng);
CREATE INDEX idx_ai_detections_created ON public.ai_detections (created_at DESC);
