# MVP Cutover Checklist & QA Plan

## Pre-Cutover Readiness
- [ ] Apply Supabase migration `0001_mvp_schema.sql` to staging; validate schema parity with production.
- [ ] Provision Redis queue (Upstash) and store `RUN_QUEUE_REDIS_URL` in staging/production secret stores.
- [ ] Configure Browserless project; capture `BROWSERLESS_HTTP_URL`, `BROWSERLESS_WS_URL`, `BROWSERLESS_TOKEN`.
- [ ] Create Supabase Storage bucket `runs` (private) and verify signed URL generation.
- [ ] Configure API environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_ANON_KEY`, `SESSION_ENCRYPTION_KEY`, Browserless + Redis).
- [ ] Configure Worker environment variables (reuse API set plus `RUN_TIMEOUT_SECONDS`, `QUEUE_REQUEUE_DELAY` if overridden).
- [ ] Connect Lovable staging UI to API base URL; smoke test health check and usage endpoint.
- [ ] Seed sample run artifacts in Supabase for UI preview states.
- [ ] Prepare incident response contacts and logging/telemetry dashboard links.

## Launch-Day Steps
1. Freeze new migrations; ensure database backups captured.
2. Deploy `services/api` to production environment; confirm `/health` ready status.
3. Deploy `services/worker` and verify it connects to Redis queue (logs show `worker.started`).
4. Rotate `SESSION_ENCRYPTION_KEY` and `BROWSERLESS_TOKEN` via hosting secret manager; redeploy services with new values.
5. Run smoke test: trigger manual run with internal LinkedIn profile; walk through Browserless login, confirm completion.
6. Invite pilot users (≤20) and provide onboarding instructions for Browserless login flow.

## Manual QA Scenarios
- [ ] **Happy Path**: Submit run with valid expert list; complete Browserless login; verify artifacts reachable and Markdown content correct.
- [ ] **Quota Enforcement**: Exhaust free-tier allowance (5 runs) and confirm UI surfaces limit message (`/usage` reflects balance).
- [ ] **Login Retry**: Cancel Browserless window mid-login; ensure worker reissues `needs_login` within queue delay and UI prompt reappears.
- [ ] **Invalid Input**: Submit malformed LinkedIn URL; expect API validation error and logging (`error.code=INVALID_PROFILE_URL`).
- [ ] **Analyzer Failure**: Force Anthropic failure (mock or disable key) to ensure run transitions to `failed` with surfaced reason.
- [ ] **Artifact Expiry**: Attempt download after signed URL expiry; UI should fetch fresh link via `GET /runs/{id}`.
- [ ] **Telemetry Check**: Confirm run events recorded in Supabase (`run_events`) and usage counters incremented correctly.

## Rollback & Contingency Plan
- **API rollback**: Redeploy prior container image or scale service to zero; communicate outage notice to pilots.
- **Worker rollback**: Stop worker service; purge BullMQ waiting jobs if data corrupted; restart with previous build once fixed.
- **Database rollback**: Use `0001_mvp_schema.rollback.sql` if schema changes must be undone (only if no dependent data).
- **Browserless/Routing fallback**: If Browserless outage occurs, pause runs and notify users; evaluate alternate provider.
- Document root cause in shared incident log and capture corrective actions.

## Post-Launch Monitoring
- Track key metrics daily: successful runs, failure rate (<5% goal), median run duration (<15 minutes), token usage per run, queue depth.
- Set alerts for worker failure streaks (>3 failures/10 min) and queue backlog (>10 waiting jobs or >5 min oldest wait).
- Review Browserless session consumption vs. monthly plan every 48 hours.
- Evaluate telemetry dashboards weekly with GTM team; adjust pricing experiments if run allowance consistently hit.
- Capture user feedback in shared tracker; translate into backlog tickets (e.g., improvements to login prompts or analytics views).
