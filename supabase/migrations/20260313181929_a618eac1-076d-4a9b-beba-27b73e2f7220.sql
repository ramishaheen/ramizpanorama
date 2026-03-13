
-- ============================================
-- SENSOR-TO-SHOOTER (S2S) ENGINE SCHEMA
-- ============================================

-- Asset/Platform types
CREATE TYPE public.asset_type AS ENUM (
  'mq9_reaper', 'mq1_predator', 'f35_lightning', 'f16_falcon',
  'ah64_apache', 'artillery_m777', 'mlrs_himars',
  'naval_destroyer', 'naval_frigate', 'missile_battery_patriot'
);

CREATE TYPE public.tasking_status AS ENUM ('idle', 'tasked', 'rtb', 'maintenance', 'combat');

CREATE TYPE public.strike_decision AS ENUM ('pending', 'committed', 'discarded', 'executing', 'complete', 'aborted');

CREATE TYPE public.effect_achieved AS ENUM ('destroyed', 'damaged', 'missed', 'unknown', 'bda_pending');

CREATE TYPE public.roe_zone AS ENUM ('free_fire', 'restricted', 'no_strike', 'weapons_hold');

-- ============================================
-- TABLE: shooter_assets
-- Available shooters/platforms with payload, fuel, tasking
-- ============================================
CREATE TABLE public.shooter_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type public.asset_type NOT NULL,
  callsign text NOT NULL,
  lat double precision NOT NULL DEFAULT 0,
  lng double precision NOT NULL DEFAULT 0,
  altitude_ft double precision NOT NULL DEFAULT 0,
  heading double precision NOT NULL DEFAULT 0,
  speed_kts double precision NOT NULL DEFAULT 0,
  fuel_remaining_pct double precision NOT NULL DEFAULT 100,
  fuel_range_nm double precision NOT NULL DEFAULT 500,
  current_tasking public.tasking_status NOT NULL DEFAULT 'idle',
  payload jsonb NOT NULL DEFAULT '[]',
  command_link_status text NOT NULL DEFAULT 'active',
  roe_zone public.roe_zone NOT NULL DEFAULT 'restricted',
  parent_unit text DEFAULT '',
  last_updated timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.shooter_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read shooter_assets" ON public.shooter_assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage shooter_assets" ON public.shooter_assets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analyst'));

-- ============================================
-- TABLE: strike_recommendations
-- AI-generated weaponeering recommendations
-- ============================================
CREATE TABLE public.strike_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_track_id uuid NOT NULL REFERENCES public.target_tracks(id) ON DELETE CASCADE,
  shooter_asset_id uuid NOT NULL REFERENCES public.shooter_assets(id) ON DELETE CASCADE,
  kill_chain_task_id uuid REFERENCES public.kill_chain_tasks(id) ON DELETE SET NULL,
  recommended_weapon text NOT NULL DEFAULT '',
  time_to_target_min double precision NOT NULL DEFAULT 0,
  probability_of_kill double precision NOT NULL DEFAULT 0,
  collateral_risk text NOT NULL DEFAULT 'low',
  roe_status text NOT NULL DEFAULT 'clear',
  decision public.strike_decision NOT NULL DEFAULT 'pending',
  decided_by uuid,
  decided_at timestamp with time zone,
  ai_reasoning text DEFAULT '',
  proximity_km double precision NOT NULL DEFAULT 0,
  payload_match_score double precision NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.strike_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read strike_recommendations" ON public.strike_recommendations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage strike_recommendations" ON public.strike_recommendations FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analyst'));

-- ============================================
-- TABLE: action_logs (BDA / Decision Logs)
-- ============================================
CREATE TABLE public.action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  strike_recommendation_id uuid REFERENCES public.strike_recommendations(id) ON DELETE SET NULL,
  target_track_id uuid REFERENCES public.target_tracks(id) ON DELETE SET NULL,
  operator_id uuid,
  decision_time_sec double precision NOT NULL DEFAULT 0,
  effect public.effect_achieved NOT NULL DEFAULT 'unknown',
  evidence_link text DEFAULT '',
  bda_image_url text DEFAULT '',
  bda_summary text DEFAULT '',
  lat double precision NOT NULL DEFAULT 0,
  lng double precision NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read action_logs" ON public.action_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Manage action_logs" ON public.action_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'analyst'));

-- Enable realtime for strike recommendations
ALTER PUBLICATION supabase_realtime ADD TABLE public.strike_recommendations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.shooter_assets;
