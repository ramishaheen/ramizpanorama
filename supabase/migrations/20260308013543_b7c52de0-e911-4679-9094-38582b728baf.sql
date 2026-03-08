
CREATE TYPE public.camera_category AS ENUM ('traffic', 'tourism', 'ports', 'weather', 'public');
CREATE TYPE public.camera_source_type AS ENUM ('hls', 'snapshot', 'embed_page');
CREATE TYPE public.camera_status AS ENUM ('active', 'inactive', 'error', 'unknown');

CREATE TABLE public.cameras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  name TEXT NOT NULL,
  category public.camera_category NOT NULL DEFAULT 'public',
  source_type public.camera_source_type NOT NULL DEFAULT 'embed_page',
  source_name TEXT NOT NULL DEFAULT '',
  stream_url TEXT,
  snapshot_url TEXT,
  embed_url TEXT,
  thumbnail_url TEXT,
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status public.camera_status NOT NULL DEFAULT 'unknown',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read cameras" ON public.cameras
  FOR SELECT USING (true);

CREATE POLICY "Service insert cameras" ON public.cameras
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service update cameras" ON public.cameras
  FOR UPDATE USING (true);

CREATE POLICY "Service delete cameras" ON public.cameras
  FOR DELETE USING (true);
