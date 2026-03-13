ALTER TABLE public.shooter_assets
  ADD COLUMN IF NOT EXISTS mission_plan jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weapon_nonce text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS weapon_nonce_expires_at timestamptz DEFAULT NULL;