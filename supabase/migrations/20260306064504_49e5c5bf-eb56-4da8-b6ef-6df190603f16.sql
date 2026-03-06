
CREATE TYPE public.rocket_status AS ENUM ('launched', 'in_flight', 'intercepted', 'impact');

CREATE TABLE public.rockets (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'BALLISTIC',
  origin_lat double precision NOT NULL,
  origin_lng double precision NOT NULL,
  current_lat double precision NOT NULL,
  current_lng double precision NOT NULL,
  target_lat double precision NOT NULL,
  target_lng double precision NOT NULL,
  status rocket_status NOT NULL DEFAULT 'launched',
  severity severity_level NOT NULL DEFAULT 'critical',
  speed double precision NOT NULL DEFAULT 0,
  altitude double precision NOT NULL DEFAULT 0,
  timestamp timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.rockets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read rockets" ON public.rockets FOR SELECT USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.rockets;
