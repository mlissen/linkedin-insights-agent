# Frontend Integration Contract

## Overview
- Lovable UI authenticates users via Supabase, orchestrates run submission, presents Browserless login prompts, and surfaces run artifacts.
- Backend stack comprises the Express API (`services/api`) and BullMQ worker (`services/worker`) backed by Supabase Postgres, Supabase Storage, and Upstash Redis.
- All requests must include Supabase JWT bearer tokens; API enforces run quotas and surfaces telemetry for dashboards.

## Authentication & Session Handling
- Obtain Supabase access token through Lovable’s Supabase integration; refresh via Supabase SDK as needed.
- Include header `Authorization: Bearer <supabase-access-token>` on every API call.
- API verifies the token using Supabase JWT secret; upserts user record, associates runs with `userId`.
- On 401 responses, prompt user to reauthenticate through Lovable; retry the request after refresh.

## Endpoints
| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Simple heartbeat (no auth) for readiness checks. |
| GET | `/usage` | Returns `{ runsUsed, runsRemaining, tokensUsed, tokenCostEstimate }`. |
| GET | `/runs` | Lists latest runs for the authenticated user (default limit 100). |
| POST | `/runs` | Creates a run. Body: `{ profileUrls: string[], nickname?: string, postLimit?: number, analysisOptions?: { prompts?: string[] } }`. |
| GET | `/runs/{runId}` | Detailed run status, including `state`, `needsLoginUrl`, `artifacts[]`, telemetry fields. |

### Request/Response Notes
- `POST /runs` validates:
  - `profileUrls` length ≤10 and each a valid LinkedIn profile/post URL.
  - `postLimit` defaults to 200 but must be ≤200.
  - Enforces remaining free-tier allowance; returns 429 if limit exceeded.
- `GET /runs` and `GET /runs/{runId}` include:
  - `state`: `queued`, `needs_login`, `running`, `completed`, `failed`.
  - `needsLoginUrl`: Browserless connect URL provided when user must authenticate.
  - `artifacts`: array of `{ name, type, signedUrl, expiresAt }` when run completed.
  - `telemetry`: `{ tokenEstimate, costEstimate, durationSeconds }`.
- Errors follow `{ error: { code, message } }`; codes align with telemetry error catalog.

## Run Lifecycle Expectations
1. User submits run via form → call `POST /runs`.
2. UI displays run entry with `state=queued`; begin polling `GET /runs/{id}` every 5 seconds.
3. If `needsLoginUrl` present:
   - Show modal with instructions.
   - Open Browserless connect URL in new window/iframe; user completes LinkedIn login.
   - Once worker captures cookies, state transitions back to `queued` or `running`; modal closes automatically when `needsLoginUrl` disappears.
4. On `state=completed`, present artifact download buttons plus run metrics (tokens, duration).
5. On `state=failed`, surface `failureReason` text, include retry CTA; optionally allow support escalation.

## Artifact Delivery
- Worker uploads consolidated instructions and per-expert Markdown to Supabase Storage bucket `runs`.
- API generates signed URLs per artifact; frontend should fetch via direct download (do not proxy).
- Signed URLs expire (default 1 hour). Refresh via `GET /runs/{id}` if expired.
- Display artifact metadata (filename, size, lastUpdated) for clarity.

## Usage & Telemetry Display
- `GET /usage` powers usage widget showing remaining runs (default 5) and total tokens consumed.
- Highlight when remaining runs ≤1 to nudge upgrade (future pricing experiments).
- Capture frontend analytics events (Lovable telemetry) for run submission, login prompt opened/completed, download clicks.

## Error & Edge Case Handling
- `429` (quota exceeded): show modal with messaging + contact CTA.
- `503` (worker unavailable): present retry advice; keep poller running for automatic recovery.
- Browserless window closed prematurely: continue polling; if login not completed within timeout, worker reissues `needsLoginUrl`.
- Validate inputs client-side (URL format, duplicates) before submission to minimize API errors.

## Security Considerations
- Supabase tokens stored via Lovable secure storage; never persist in localStorage if Lovable session API available.
- Never render signed artifact URLs in logs/telemetry.
- Ensure Browserless login window runs in secure context (https). Cleanup references after completion.

## Future Enhancements (Out of Scope for MVP)
- Streaming run progress (Server-Sent Events or WebSockets) to replace polling.
- Encrypted artifact caching and inline preview within Lovable.
- User-managed run history curation and deletion from UI.
