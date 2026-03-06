
-- Drop restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Public read airspace_alerts" ON public.airspace_alerts;
CREATE POLICY "Public read airspace_alerts" ON public.airspace_alerts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read geo_alerts" ON public.geo_alerts;
CREATE POLICY "Public read geo_alerts" ON public.geo_alerts FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read risk_scores" ON public.risk_scores;
CREATE POLICY "Public read risk_scores" ON public.risk_scores FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read rockets" ON public.rockets;
CREATE POLICY "Public read rockets" ON public.rockets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read timeline_events" ON public.timeline_events;
CREATE POLICY "Public read timeline_events" ON public.timeline_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read vessels" ON public.vessels;
CREATE POLICY "Public read vessels" ON public.vessels FOR SELECT USING (true);
