ALTER TABLE public.target_tracks 
  ADD COLUMN IF NOT EXISTS velocity_vector jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS threat_level integer DEFAULT 3;