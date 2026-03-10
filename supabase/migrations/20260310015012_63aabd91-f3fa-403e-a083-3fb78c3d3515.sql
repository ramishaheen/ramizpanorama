
-- ═══════════════════════════════════════════════
-- INTEL PLATFORM SCHEMA — Phase 1
-- ═══════════════════════════════════════════════

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'analyst', 'viewer', 'partner');
CREATE TYPE public.source_type AS ENUM ('youtube_live', 'hls_stream', 'mjpeg_stream', 'image_snapshot', 'official_webcam_page', 'external_embed', 'traffic_api', 'incident_feed', 'partner_feed');
CREATE TYPE public.source_category AS ENUM ('traffic', 'tourism', 'city_view', 'weather', 'port', 'airport_public', 'parking', 'event_venue_public', 'border_wait_time_data', 'road_status', 'incident_reporting');
CREATE TYPE public.review_status AS ENUM ('pending', 'approved', 'rejected', 'needs_edits', 'partner_only', 'external_link_only');
CREATE TYPE public.validation_status AS ENUM ('valid', 'invalid', 'pending', 'unreachable', 'duplicate');
CREATE TYPE public.permission_status AS ENUM ('confirmed_public', 'assumed_public', 'partner_approved', 'pending_review', 'denied');
CREATE TYPE public.ownership_type AS ENUM ('government', 'municipality', 'tourism_board', 'private_partner', 'community', 'news_media', 'unknown');
CREATE TYPE public.health_status AS ENUM ('online', 'intermittent', 'offline', 'unknown');
CREATE TYPE public.event_severity AS ENUM ('info', 'low', 'medium', 'high', 'critical');
CREATE TYPE public.event_verification AS ENUM ('unverified', 'verified', 'dismissed', 'auto_detected');
CREATE TYPE public.incident_status AS ENUM ('open', 'investigating', 'confirmed', 'resolved', 'dismissed');
CREATE TYPE public.congestion_level AS ENUM ('free_flow', 'light', 'moderate', 'heavy', 'standstill', 'unknown');
CREATE TYPE public.connector_type AS ENUM ('youtube', 'hls_mjpeg', 'webcam_page', 'traffic_api', 'weather_api', 'news_feed', 'partner_feed');

-- 2. PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT '',
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 4. SECURITY DEFINER: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5. INTEL SOURCES (main registry)
CREATE TABLE public.intel_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  address_text TEXT DEFAULT '',
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  source_type source_type NOT NULL DEFAULT 'official_webcam_page',
  category source_category NOT NULL DEFAULT 'city_view',
  source_url TEXT,
  embed_url TEXT,
  thumbnail_url TEXT,
  provider_name TEXT DEFAULT '',
  ownership_type ownership_type NOT NULL DEFAULT 'unknown',
  public_permission_status permission_status NOT NULL DEFAULT 'pending_review',
  review_status review_status NOT NULL DEFAULT 'pending',
  reliability_score INTEGER NOT NULL DEFAULT 50 CHECK (reliability_score >= 0 AND reliability_score <= 100),
  tags TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  youtube_video_id TEXT,
  playable_url TEXT,
  stream_type_detected TEXT,
  submitted_by UUID REFERENCES auth.users(id),
  reviewed_by UUID REFERENCES auth.users(id),
  last_checked_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.intel_sources ENABLE ROW LEVEL SECURITY;

-- 6. SOURCE REVIEWS
CREATE TABLE public.source_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.intel_sources(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES auth.users(id),
  action review_status NOT NULL,
  notes TEXT DEFAULT '',
  checks JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.source_reviews ENABLE ROW LEVEL SECURITY;

-- 7. SOURCE HEALTH
CREATE TABLE public.source_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.intel_sources(id) ON DELETE CASCADE,
  status health_status NOT NULL DEFAULT 'unknown',
  response_time_ms INTEGER,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  failure_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.source_health ENABLE ROW LEVEL SECURITY;

-- 8. INTEL EVENTS
CREATE TABLE public.intel_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES public.intel_sources(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL DEFAULT 'unknown',
  severity event_severity NOT NULL DEFAULT 'info',
  confidence DOUBLE PRECISION NOT NULL DEFAULT 0.5,
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  city TEXT DEFAULT '',
  country TEXT DEFAULT '',
  title TEXT NOT NULL,
  summary TEXT DEFAULT '',
  thumbnail_url TEXT,
  source_link TEXT,
  verification_status event_verification NOT NULL DEFAULT 'unverified',
  verified_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.intel_events ENABLE ROW LEVEL SECURITY;

-- 9. INTEL INCIDENTS (composite / correlated)
CREATE TABLE public.intel_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT DEFAULT '',
  severity event_severity NOT NULL DEFAULT 'medium',
  status incident_status NOT NULL DEFAULT 'open',
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  city TEXT DEFAULT '',
  country TEXT DEFAULT '',
  related_event_ids UUID[] DEFAULT '{}',
  related_source_ids UUID[] DEFAULT '{}',
  correlation_rule TEXT,
  analyst_notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id),
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.intel_incidents ENABLE ROW LEVEL SECURITY;

-- 10. TRAFFIC SEGMENTS
CREATE TABLE public.traffic_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  road_name TEXT NOT NULL DEFAULT '',
  congestion_level congestion_level NOT NULL DEFAULT 'unknown',
  speed_index DOUBLE PRECISION,
  incident_type TEXT,
  incident_severity event_severity DEFAULT 'info',
  source_provider TEXT DEFAULT '',
  lat DOUBLE PRECISION NOT NULL DEFAULT 0,
  lng DOUBLE PRECISION NOT NULL DEFAULT 0,
  polyline_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.traffic_segments ENABLE ROW LEVEL SECURITY;

-- 11. WATCHLISTS
CREATE TABLE public.watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  filters JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.watchlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  watchlist_id UUID NOT NULL REFERENCES public.watchlists(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.intel_sources(id) ON DELETE CASCADE,
  notes TEXT DEFAULT '',
  pinned BOOLEAN NOT NULL DEFAULT false,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.watchlist_items ENABLE ROW LEVEL SECURITY;

-- 12. INTEL CONNECTORS
CREATE TABLE public.intel_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_name TEXT NOT NULL,
  connector_type connector_type NOT NULL,
  endpoint_url TEXT,
  auth_reference TEXT,
  rate_limit INTEGER DEFAULT 60,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.intel_connectors ENABLE ROW LEVEL SECURITY;

-- 13. SNAPSHOT ANALYSIS
CREATE TABLE public.snapshot_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES public.intel_sources(id) ON DELETE CASCADE,
  change_score DOUBLE PRECISION DEFAULT 0,
  motion_estimate DOUBLE PRECISION DEFAULT 0,
  occupancy_estimate DOUBLE PRECISION DEFAULT 0,
  blockage_estimate DOUBLE PRECISION DEFAULT 0,
  visibility_estimate DOUBLE PRECISION DEFAULT 1,
  previous_hash TEXT,
  current_hash TEXT,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.snapshot_analysis ENABLE ROW LEVEL SECURITY;

-- 14. AUDIT LOGS
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════
-- RLS POLICIES
-- ═══════════════════════════════════════════════

-- Profiles: users read own, admins read all
CREATE POLICY "Users read own profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());
CREATE POLICY "Auto-insert profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- User roles: admins manage, users read own
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Intel sources: approved visible to all authenticated, admins/analysts full access
CREATE POLICY "Read approved sources" ON public.intel_sources FOR SELECT TO authenticated
  USING (review_status = 'approved' OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst') OR submitted_by = auth.uid());
CREATE POLICY "Insert sources" ON public.intel_sources FOR INSERT TO authenticated
  WITH CHECK (true);
CREATE POLICY "Admin/analyst update sources" ON public.intel_sources FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst') OR submitted_by = auth.uid());
CREATE POLICY "Admin delete sources" ON public.intel_sources FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Source reviews: admin/analyst read/write
CREATE POLICY "Read reviews" ON public.source_reviews FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst'));
CREATE POLICY "Create reviews" ON public.source_reviews FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst'));

-- Source health: all authenticated read, system write
CREATE POLICY "Read health" ON public.source_health FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert health" ON public.source_health FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst'));

-- Events: all authenticated read
CREATE POLICY "Read events" ON public.intel_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Create events" ON public.intel_events FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst'));
CREATE POLICY "Update events" ON public.intel_events FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst'));

-- Incidents
CREATE POLICY "Read incidents" ON public.intel_incidents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage incidents" ON public.intel_incidents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst'));

-- Traffic segments: public read
CREATE POLICY "Read traffic" ON public.traffic_segments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage traffic" ON public.traffic_segments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst'));

-- Watchlists: owner read/write
CREATE POLICY "Owner watchlists" ON public.watchlists FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Insert watchlists" ON public.watchlists FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner watchlist items" ON public.watchlist_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.watchlists w WHERE w.id = watchlist_id AND (w.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))));
CREATE POLICY "Insert watchlist items" ON public.watchlist_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.watchlists w WHERE w.id = watchlist_id AND w.owner_id = auth.uid()));

-- Connectors: admin only
CREATE POLICY "Read connectors" ON public.intel_connectors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage connectors" ON public.intel_connectors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Snapshot analysis: read all, write admin/analyst
CREATE POLICY "Read snapshots" ON public.snapshot_analysis FOR SELECT TO authenticated USING (true);
CREATE POLICY "Write snapshots" ON public.snapshot_analysis FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'analyst'));

-- Audit logs: admin read, system write
CREATE POLICY "Read audit" ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Write audit" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

-- ═══════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)), NEW.email);
  -- First user gets admin, others get viewer
  IF (SELECT count(*) FROM public.user_roles) = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'viewer');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
