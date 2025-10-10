BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE public.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL UNIQUE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

CREATE TABLE public.linked_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'browserless',
  encrypted_payload text NOT NULL,
  encryption_algorithm text NOT NULL DEFAULT 'aes-256-gcm',
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_linked_sessions_updated_at
BEFORE UPDATE ON public.linked_sessions
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE INDEX idx_linked_sessions_user_active ON public.linked_sessions(user_id, is_active);

CREATE TYPE public.run_status AS ENUM ('queued','needs_login','running','failed','completed');

CREATE TABLE public.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status public.run_status NOT NULL DEFAULT 'queued',
  config jsonb NOT NULL,
  run_nickname text,
  token_estimate bigint DEFAULT 0,
  cost_estimate numeric(10,4),
  needs_login_url text,
  started_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE TRIGGER trg_runs_updated_at
BEFORE UPDATE ON public.runs
FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
CREATE INDEX idx_runs_user_created_at ON public.runs(user_id, created_at DESC);

CREATE TABLE public.run_events (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_run_events_run_time ON public.run_events(run_id, created_at);

CREATE TABLE public.run_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  artifact_type text NOT NULL,
  storage_path text NOT NULL,
  content_sha256 text NOT NULL,
  bytes bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE public.usage_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  runs_used integer NOT NULL DEFAULT 0,
  tokens_used bigint NOT NULL DEFAULT 0,
  UNIQUE (user_id, period_start)
);

CREATE OR REPLACE FUNCTION public.increment_run_usage(p_user_id uuid, p_period_start date)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.usage_counters (user_id, period_start, runs_used, tokens_used)
  VALUES (p_user_id, p_period_start, 1, 0)
  ON CONFLICT (user_id, period_start)
  DO UPDATE SET runs_used = public.usage_counters.runs_used + 1;
END;
$$;

COMMIT;
