
-- =====================================================
-- SENSOR FUSION & ONTOLOGY LAYER
-- =====================================================

-- Enums for sensor feeds
CREATE TYPE public.feed_type AS ENUM (
  'satellite_eo', 'satellite_sar', 'satellite_ir',
  'drone_fmv', 'drone_lidar',
  'cctv',
  'sigint_rf', 'sigint_comms',
  'osint_social', 'osint_news', 'osint_flight', 'osint_maritime',
  'ground_radar', 'ground_acoustic',
  'iot_scada', 'iot_edge'
);

CREATE TYPE public.feed_protocol AS ENUM (
  'api_rest', 'api_ws', 'hls_stream', 'rtsp', 'mqtt', 'manual', 'webhook'
);

CREATE TYPE public.feed_status AS ENUM (
  'active', 'degraded', 'offline', 'maintenance'
);

CREATE TYPE public.classification_level AS ENUM (
  'unclassified', 'cui', 'secret', 'top_secret'
);

CREATE TYPE public.entity_type AS ENUM (
  'equipment', 'facility', 'unit', 'person', 'vehicle', 'infrastructure', 'weapon_system'
);

CREATE TYPE public.relationship_type AS ENUM (
  'occupies', 'commands', 'observes', 'targets', 'transports', 'supplies', 'defends', 'attacks'
);

-- =====================================================
-- TABLE: sensor_feeds
-- =====================================================
CREATE TABLE public.sensor_feeds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_type public.feed_type NOT NULL,
  source_name text NOT NULL,
  protocol public.feed_protocol NOT NULL DEFAULT 'api_rest',
  lat double precision NOT NULL DEFAULT 0,
  lng double precision NOT NULL DEFAULT 0,
  coverage_radius_km double precision NOT NULL DEFAULT 10,
  status public.feed_status NOT NULL DEFAULT 'active',
  health_score integer NOT NULL DEFAULT 100,
  last_data_at timestamptz DEFAULT now(),
  data_rate_hz double precision NOT NULL DEFAULT 0.1,
  classification_level public.classification_level NOT NULL DEFAULT 'unclassified',
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  linked_camera_id uuid REFERENCES public.cameras(id) ON DELETE SET NULL,
  linked_unit_id uuid REFERENCES public.force_units(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sensor_feeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read sensor_feeds" ON public.sensor_feeds
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage sensor_feeds" ON public.sensor_feeds
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analyst'));

-- =====================================================
-- TABLE: ontology_entities
-- =====================================================
CREATE TABLE public.ontology_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.entity_type NOT NULL DEFAULT 'equipment',
  name text NOT NULL,
  designation text DEFAULT '',
  description text DEFAULT '',
  lat double precision NOT NULL DEFAULT 0,
  lng double precision NOT NULL DEFAULT 0,
  last_known_at timestamptz NOT NULL DEFAULT now(),
  affiliation public.affiliation NOT NULL DEFAULT 'unknown',
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_sensor_id uuid REFERENCES public.sensor_feeds(id) ON DELETE SET NULL,
  confidence double precision NOT NULL DEFAULT 0.5,
  status text NOT NULL DEFAULT 'active',
  event_time timestamptz NOT NULL DEFAULT now(),
  ingestion_time timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ontology_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read ontology_entities" ON public.ontology_entities
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage ontology_entities" ON public.ontology_entities
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analyst'));

-- =====================================================
-- TABLE: ontology_relationships
-- =====================================================
CREATE TABLE public.ontology_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id uuid NOT NULL REFERENCES public.ontology_entities(id) ON DELETE CASCADE,
  target_entity_id uuid NOT NULL REFERENCES public.ontology_entities(id) ON DELETE CASCADE,
  relationship_type public.relationship_type NOT NULL,
  confidence double precision NOT NULL DEFAULT 0.5,
  source_sensor_id uuid REFERENCES public.sensor_feeds(id) ON DELETE SET NULL,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ontology_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read ontology_relationships" ON public.ontology_relationships
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Manage ontology_relationships" ON public.ontology_relationships
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analyst'));

-- =====================================================
-- ALTER existing tables for bi-temporal + sensor link
-- =====================================================
ALTER TABLE public.target_tracks
  ADD COLUMN IF NOT EXISTS source_sensor_id uuid REFERENCES public.sensor_feeds(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS event_time timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ingestion_time timestamptz DEFAULT now();

ALTER TABLE public.force_units
  ADD COLUMN IF NOT EXISTS event_time timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS ingestion_time timestamptz DEFAULT now();

-- =====================================================
-- REALTIME
-- =====================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.sensor_feeds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ontology_entities;

-- =====================================================
-- SEED: Sensor Feeds
-- =====================================================
INSERT INTO public.sensor_feeds (feed_type, source_name, protocol, lat, lng, coverage_radius_km, status, health_score, data_rate_hz, classification_level, config) VALUES
  ('satellite_eo', 'WorldView-3 (Maxar)', 'api_rest', 28.5, 47.2, 450, 'active', 95, 0.001, 'unclassified', '{"provider":"maxar","revisit_hrs":24}'),
  ('satellite_eo', 'Sentinel-2A (ESA)', 'api_rest', 31.0, 35.0, 600, 'active', 98, 0.001, 'unclassified', '{"provider":"esa","revisit_hrs":120}'),
  ('satellite_sar', 'Sentinel-1B (SAR)', 'api_rest', 34.0, 40.0, 500, 'active', 92, 0.001, 'unclassified', '{"provider":"esa","mode":"IW"}'),
  ('satellite_ir', 'SBIRS GEO-5 (IR)', 'manual', 0.1, 42.0, 5000, 'active', 99, 0.01, 'unclassified', '{"type":"early_warning"}'),
  ('drone_fmv', 'MQ-9 Reaper (ISR Iraq)', 'hls_stream', 33.5, 43.0, 80, 'active', 88, 30, 'unclassified', '{"type":"FMV","altitude_ft":18000}'),
  ('drone_fmv', 'RQ-4 Global Hawk (Syria)', 'hls_stream', 34.0, 40.0, 200, 'active', 91, 30, 'unclassified', '{"type":"EO/IR","altitude_ft":55000}'),
  ('drone_lidar', 'Heron TP (LiDAR)', 'api_rest', 32.0, 34.8, 60, 'active', 85, 10, 'unclassified', '{"type":"LiDAR","resolution_cm":15}'),
  ('cctv', 'Baghdad Highway Cam', 'hls_stream', 33.31, 44.37, 0.5, 'active', 75, 25, 'unclassified', '{"source":"traffic_cam"}'),
  ('cctv', 'Beirut Port CCTV', 'hls_stream', 33.90, 35.52, 0.3, 'degraded', 60, 15, 'unclassified', '{"source":"port_security"}'),
  ('cctv', 'Dubai Marina Cam', 'hls_stream', 25.08, 55.14, 0.2, 'active', 82, 25, 'unclassified', '{"source":"tourism"}'),
  ('sigint_rf', 'SIGINT Station Alpha', 'api_ws', 37.0, 35.5, 300, 'active', 90, 1, 'unclassified', '{"type":"RF_intercept"}'),
  ('sigint_comms', 'COMINT Node Bravo', 'api_ws', 25.0, 51.3, 250, 'active', 87, 0.5, 'unclassified', '{"type":"COMINT"}'),
  ('osint_social', 'Telegram OSINT Feed', 'webhook', 33.0, 44.0, 2000, 'active', 70, 0.02, 'unclassified', '{"channels":["telegram"]}'),
  ('osint_news', 'ACLED Conflict Feed', 'api_rest', 30.0, 45.0, 3000, 'active', 95, 0.001, 'unclassified', '{"provider":"acled"}'),
  ('osint_flight', 'ADS-B Exchange', 'api_rest', 30.0, 45.0, 5000, 'active', 93, 1, 'unclassified', '{"provider":"adsb_exchange"}'),
  ('osint_maritime', 'AIS Vessel Tracker', 'api_rest', 26.0, 56.0, 3000, 'active', 91, 0.5, 'unclassified', '{"provider":"ais_hub"}'),
  ('ground_radar', 'Patriot Radar (Al Udeid)', 'api_ws', 25.12, 51.31, 150, 'active', 96, 10, 'unclassified', '{"type":"AN/MPQ-65","mode":"search"}'),
  ('ground_acoustic', 'Acoustic Array (Hormuz)', 'mqtt', 26.57, 56.25, 50, 'active', 78, 5, 'unclassified', '{"type":"SOSUS_variant"}');
