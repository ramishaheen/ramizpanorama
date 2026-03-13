
-- Enums for C2 system
CREATE TYPE public.unit_type AS ENUM ('infantry', 'armor', 'artillery', 'air_defense', 'naval', 'drone', 'logistics', 'command', 'special_ops');
CREATE TYPE public.affiliation AS ENUM ('blue', 'red', 'neutral', 'unknown');
CREATE TYPE public.unit_status AS ENUM ('active', 'destroyed', 'retreating', 'unknown');
CREATE TYPE public.echelon AS ENUM ('team', 'squad', 'platoon', 'company', 'battalion', 'brigade', 'division');
CREATE TYPE public.intel_source_type AS ENUM ('humint', 'sigint', 'imint', 'osint');
CREATE TYPE public.target_classification AS ENUM ('tank', 'truck', 'missile_launcher', 'apc', 'radar', 'sam_site', 'artillery', 'command_post', 'supply_depot');
CREATE TYPE public.target_status AS ENUM ('detected', 'confirmed', 'engaged', 'destroyed', 'bda_pending');
CREATE TYPE public.target_priority AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE public.sensor_type AS ENUM ('satellite', 'drone', 'sigint');
CREATE TYPE public.kc_phase AS ENUM ('find', 'fix', 'track', 'target', 'engage', 'assess');
CREATE TYPE public.kc_status AS ENUM ('pending', 'in_progress', 'approved', 'rejected', 'complete');

-- Force Units table
CREATE TABLE public.force_units (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  unit_type public.unit_type NOT NULL DEFAULT 'infantry',
  affiliation public.affiliation NOT NULL DEFAULT 'unknown',
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  heading DOUBLE PRECISION NOT NULL DEFAULT 0,
  speed_kph DOUBLE PRECISION NOT NULL DEFAULT 0,
  status public.unit_status NOT NULL DEFAULT 'active',
  echelon public.echelon NOT NULL DEFAULT 'company',
  parent_unit_id UUID REFERENCES public.force_units(id) ON DELETE SET NULL,
  icon_sidc TEXT DEFAULT '',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  source public.intel_source_type NOT NULL DEFAULT 'osint'
);

-- Target Tracks table
CREATE TABLE public.target_tracks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  track_id TEXT NOT NULL DEFAULT '',
  classification public.target_classification NOT NULL DEFAULT 'truck',
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_sensor public.sensor_type NOT NULL DEFAULT 'satellite',
  image_url TEXT,
  status public.target_status NOT NULL DEFAULT 'detected',
  priority public.target_priority NOT NULL DEFAULT 'medium',
  analyst_verified BOOLEAN NOT NULL DEFAULT false,
  analyst_notes TEXT DEFAULT '',
  ai_assessment TEXT DEFAULT ''
);

-- Kill Chain Tasks table
CREATE TABLE public.kill_chain_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  target_track_id UUID REFERENCES public.target_tracks(id) ON DELETE CASCADE NOT NULL,
  phase public.kc_phase NOT NULL DEFAULT 'find',
  status public.kc_status NOT NULL DEFAULT 'pending',
  assigned_platform TEXT DEFAULT '',
  recommended_weapon TEXT DEFAULT '',
  requested_by UUID,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT DEFAULT '',
  bda_result TEXT DEFAULT ''
);

-- Enable RLS
ALTER TABLE public.force_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.target_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kill_chain_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies: authenticated can read, admin/analyst can write
CREATE POLICY "Read force_units" ON public.force_units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage force_units" ON public.force_units FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analyst'));

CREATE POLICY "Read target_tracks" ON public.target_tracks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage target_tracks" ON public.target_tracks FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analyst'));

CREATE POLICY "Read kill_chain_tasks" ON public.kill_chain_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage kill_chain_tasks" ON public.kill_chain_tasks FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analyst'));

-- Enable realtime for force tracking
ALTER PUBLICATION supabase_realtime ADD TABLE public.force_units;
ALTER PUBLICATION supabase_realtime ADD TABLE public.target_tracks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kill_chain_tasks;
