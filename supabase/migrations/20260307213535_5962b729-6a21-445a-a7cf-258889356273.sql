
CREATE TABLE public.telegram_intel_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  markers jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamp with time zone NOT NULL DEFAULT now(),
  region_focus text NOT NULL DEFAULT 'middle_east'
);

ALTER TABLE public.telegram_intel_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read telegram_intel_cache" ON public.telegram_intel_cache
  FOR SELECT USING (true);

CREATE POLICY "Service insert telegram_intel_cache" ON public.telegram_intel_cache
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Service update telegram_intel_cache" ON public.telegram_intel_cache
  FOR UPDATE USING (true);

CREATE POLICY "Service delete telegram_intel_cache" ON public.telegram_intel_cache
  FOR DELETE USING (true);
