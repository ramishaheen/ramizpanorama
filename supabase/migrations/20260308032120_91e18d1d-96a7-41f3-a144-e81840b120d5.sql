
CREATE INDEX IF NOT EXISTS idx_cameras_country ON public.cameras (country);
CREATE INDEX IF NOT EXISTS idx_cameras_status ON public.cameras (status);
CREATE INDEX IF NOT EXISTS idx_cameras_category ON public.cameras (category);
CREATE INDEX IF NOT EXISTS idx_cameras_coords ON public.cameras (lat, lng);
CREATE INDEX IF NOT EXISTS idx_cameras_source ON public.cameras (source_name);
CREATE INDEX IF NOT EXISTS idx_cameras_active ON public.cameras (is_active) WHERE is_active = true;
