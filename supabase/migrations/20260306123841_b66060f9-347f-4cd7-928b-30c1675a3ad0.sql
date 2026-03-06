
CREATE TABLE public.launch_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL UNIQUE,
  launches integer NOT NULL DEFAULT 0,
  intercepted integer NOT NULL DEFAULT 0,
  impact integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.launch_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read launch_history"
  ON public.launch_history
  FOR SELECT
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.launch_history;
