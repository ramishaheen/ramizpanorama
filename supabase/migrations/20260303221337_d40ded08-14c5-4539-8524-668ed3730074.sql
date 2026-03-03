
-- Create severity enum
CREATE TYPE public.severity_level AS ENUM ('low', 'medium', 'high', 'critical');

-- Create airspace alert type enum
CREATE TYPE public.airspace_alert_type AS ENUM ('NOTAM', 'TFR', 'CLOSURE');

-- Create vessel type enum
CREATE TYPE public.vessel_type AS ENUM ('MILITARY', 'CARGO', 'TANKER', 'FISHING', 'UNKNOWN');

-- Create geo alert type enum
CREATE TYPE public.geo_alert_type AS ENUM ('DIPLOMATIC', 'MILITARY', 'ECONOMIC', 'HUMANITARIAN');

-- Create risk trend enum
CREATE TYPE public.risk_trend AS ENUM ('rising', 'falling', 'stable');

-- Create timeline event type enum
CREATE TYPE public.timeline_event_type AS ENUM ('airspace', 'maritime', 'alert', 'diplomatic');

-- Airspace alerts table
CREATE TABLE public.airspace_alerts (
  id TEXT PRIMARY KEY,
  type public.airspace_alert_type NOT NULL,
  region TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius DOUBLE PRECISION NOT NULL,
  severity public.severity_level NOT NULL DEFAULT 'low',
  description TEXT NOT NULL DEFAULT '',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  active BOOLEAN NOT NULL DEFAULT true
);

-- Maritime vessels table
CREATE TABLE public.vessels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type public.vessel_type NOT NULL DEFAULT 'UNKNOWN',
  flag TEXT NOT NULL DEFAULT '',
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading DOUBLE PRECISION NOT NULL DEFAULT 0,
  speed DOUBLE PRECISION NOT NULL DEFAULT 0,
  destination TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Geo alerts table
CREATE TABLE public.geo_alerts (
  id TEXT PRIMARY KEY,
  type public.geo_alert_type NOT NULL,
  region TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  severity public.severity_level NOT NULL DEFAULT 'low',
  source TEXT NOT NULL DEFAULT '',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL
);

-- Risk scores table
CREATE TABLE public.risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overall INTEGER NOT NULL DEFAULT 0,
  airspace INTEGER NOT NULL DEFAULT 0,
  maritime INTEGER NOT NULL DEFAULT 0,
  diplomatic INTEGER NOT NULL DEFAULT 0,
  sentiment INTEGER NOT NULL DEFAULT 0,
  trend public.risk_trend NOT NULL DEFAULT 'stable',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Timeline events table
CREATE TABLE public.timeline_events (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  type public.timeline_event_type NOT NULL,
  title TEXT NOT NULL,
  severity public.severity_level NOT NULL DEFAULT 'low'
);

-- Enable RLS (public read for all, no auth required for this dashboard)
ALTER TABLE public.airspace_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vessels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Public read airspace_alerts" ON public.airspace_alerts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read vessels" ON public.vessels FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read geo_alerts" ON public.geo_alerts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read risk_scores" ON public.risk_scores FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read timeline_events" ON public.timeline_events FOR SELECT TO anon, authenticated USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.airspace_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.vessels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.geo_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.risk_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.timeline_events;
