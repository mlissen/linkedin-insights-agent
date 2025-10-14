# Telemetry & Logging Guidelines

## Goals
- Provide consistent structured logging across API and worker services for run observability.
- Capture run-level telemetry (limits, token usage, queue depth) to inform pricing and reliability insights.
- Document alerting expectations and instrumentation backlog for post-MVP improvements.

## Logging Conventions
- **Library**: Use `pino` (`services/api/src/logger.ts`, `services/worker/src/logger.ts`) with JSON output for log aggregation compatibility.
- **Context fields**: Always include `scope` (e.g., `api.run`, `worker.scrape`), `runId`, `userId`, `event`, `durationMs` (when available), and `error` objects for failures.
- **Levels**:
  - `info` — state transitions (queued, needs_login, processing, completed) and steady-state operations.
  - `warn` — recoverable issues (retryable Browserless hiccups, rate limiting, requeue notices).
  - `error` — scraping/analysis failures, Supabase/Redis outages, or unrecoverable API validation errors.
- **Correlation**: Accept `X-Request-Id` header on API requests and propagate it as `requestId`; reuse when emitting worker logs spawned by that request context.
- **Redaction**: Never log LinkedIn credentials, raw cookies, or Anthropic payloads. Use stable identifiers or hashed tokens when referencing secrets.

## Telemetry Events & Storage
- **Run lifecycle**: Persist state transitions (`queued`, `needs_login`, `running`, `completed`, `failed`) in Supabase `run_events` with timestamp and `metadata` JSON.
- **Usage counters**: Update `runs` table fields `token_estimate`, `cost_estimate`, and `duration_seconds` per run. Maintain aggregates in `usage_counters` (`runs_used`, `tokens_used`, `last_run_at`).
- **Login prompts**: Record `needs_login` events with Browserless session URL reference (no secrets) for UI prompts and support visibility.
- **Queue depth**: Worker captures BullMQ `waiting` and `active` counts at start/finish of each job and pushes them to a `queue_metrics` table or structured logs tagged `metric.queueDepth`.
- **Error catalog**: Tag errors with `error.code` (e.g., `LINKEDIN_MFA_REQUIRED`, `ANTHROPIC_RATE_LIMIT`) to support reporting.

## Metrics & Dashboards
- **Primary KPIs**: successful runs per day, failure rate (<5% target), median run duration (<15 minutes), Anthropic tokens per run, Browserless session count.
- **Collection**: Metrics sourced from Supabase tables (runs, usage_counters, run_events) and structured logs ingested into preferred observability stack.
- **Dashboards**: Surface daily/weekly summaries for GTM review; highlight free-tier consumption vs allowance, and top error codes.

## Alerts & Monitoring
- Configure hosting alerts for:
  - Consecutive worker failures (`failed` events >3 within 10 minutes).
  - Queue backlog threshold (waiting jobs >10 or oldest waiting >5 minutes).
  - Browserless session usage nearing 80% of monthly quota.
- Establish manual review cadence (at least weekly) for telemetry dashboards until automated paging is in place.

## Instrumentation Backlog
- Future tracing: reserve `requestId` propagation now to ease adoption of OpenTelemetry.
- Add per-expert scrape timing and post counts for performance tuning.
- Implement token cost anomaly detection once enough history exists.
- Evaluate storing Browserless session duration metrics to optimize plan selection.

## Operational Playbook
- On incident, collect correlated `requestId` logs from API and worker, pull relevant Supabase rows (`runs`, `run_events`), and verify queue depth snapshots.
- For recurring `needs_login` churn, review telemetry to adjust requeue interval or surface UI education.
- Document notable telemetry gaps or false positives in shared runbook and feed into backlog grooming.
