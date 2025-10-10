Plan ID: 20250214-2000-lyn  
Owner: codex  
Branch: feature/lovable-mvp-ui  
Target services or packages: Lovable Cloud App, Supabase Auth, /docs  
Estimated effort: M  
Risk rating: Medium – Coordinating Supabase Auth, backend API integration, and Browserless login messaging demands tight UX/engineering alignment.

## Objectives
- Deliver a Lovable front-end that guides users through onboarding, run setup, login handoff, and artifact downloads for the LinkedIn Insights Agent MVP.  
- Surface usage allowance (five runs), status polling, and error handling in a clear, responsive UI.  
- Reuse Supabase Auth flows while integrating seamlessly with the new backend API service.

## Scope – In
- Lovable app screens for onboarding, sample preview, run configuration, run list/detail, login prompt modal, and downloads.  
- API integration using Supabase JWT bearer tokens.  
- Usage allowance display and basic analytics events (page views, run actions).  
- Documentation updates for front-end environment variables and QA steps.

## Scope – Out
- Insight explorer, scheduling/alerts, team collaboration, or billing flows.  
- Offline/cache support beyond Supabase session persistence.  
- Advanced analytics dashboards or AB testing.

## Assumptions and Constraints
- Supabase Auth (email/magic link) already configured; Lovable has access to `SUPABASE_ANON_KEY` and `SUPABASE_URL`.  
- Backend API deployed separately; base URL supplied via Lovable environment variable.  
- Front end relies on Supabase session refresh; no custom token storage beyond Lovable defaults.  
- Browserless login occurs in a separate window; front end only displays instructions and polls run status.

## Architecture and Data Flow Summary
1. User signs in via Supabase Auth hosted in Lovable; session stored client-side.  
2. Lovable calls backend API with `Authorization: Bearer <access_token>`; API validates token and enqueues run.  
3. Front end polls `/runs/{id}` every 5s; handles state transitions (queued → needs_login → running → completed/failed).  
4. When run enters `needs_login`, UI displays modal with connect URL instructions; user opens Browserless window.  
5. Upon completion, UI lists Markdown artifacts and triggers signed download URLs via backend endpoint.  
6. Usage bar derives remaining runs from `/usage`; front end updates UI without page refresh.

## Work Plan (Tasks)
- **T-001** – Configure Lovable project environment (Supabase Auth, API base URL, secure env storage).  
- **T-002** – Build onboarding & sample preview experience.  
- **T-003** – Implement run configuration form (profile URLs, topics chips, output format, post limit) with validation.  
- **T-004** – Create run history dashboard, detail view, and login prompt modal with polling.  
- **T-005** – Add downloads, usage allowance display, and user messaging for run limits/errors.  
- **T-006** – Document QA checklist and analytics instrumentation plan.

## File/Asset Operations
| Artifact | Op | Type | Owner | Risk |
| --- | --- | --- | --- | --- |
| Lovable `env` settings | modify | config | platform | Medium |
| Lovable screen: `Onboarding` | create | UI | product-eng | Medium |
| Lovable screen: `SamplePreview` | create | UI | product-eng | Low |
| Lovable screen: `RunConfig` | create | UI | product-eng | Medium |
| Lovable screen: `RunDashboard` | create | UI | product-eng | Medium |
| Lovable modal: `LoginPrompt` | create | UI | product-eng | Medium |
| Lovable screen: `RunDetail` | create | UI | product-eng | Medium |
| docs/frontend-qa.md | create | doc | product-eng | Low |

## Implementation Details per Task

### T-001 – Lovable Environment Setup
- Configure Supabase Auth provider in Lovable (email magic link) and ensure token persistence.  
- Add environment variables:  
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
  - `NEXT_PUBLIC_API_BASE_URL` (backend API)  
  - Optional `NEXT_PUBLIC_SAMPLE_ARTIFACT_URL` for sample preview.  
- Ensure Lovable build uses secure secrets for deployment; no hard-coded keys in UI.  
- Verify Supabase client initialization uses Lovable’s runtime-safe storage.

### T-002 – Onboarding & Sample Preview
- Create onboarding screen with brief product pitch, Browserless login explanation, and “View Sample Output” CTA.  
- Sample preview pulls static artifact(s) from `NEXT_PUBLIC_SAMPLE_ARTIFACT_URL` or baked-in JSON; render Markdown preview.  
- Include checklist for prerequisites (Supabase login, Browserless prompt, run limit reminder).  
- Track analytics event `onboarding_viewed`, `sample_preview_opened`.

### T-003 – Run Configuration Form
- Fields: profile URL list (textarea with validation), topics multi-select with suggested chips, output format toggle (`AI Project Files`, `Written Brief`), optional post limit numeric input (>=10).  
- Display validation errors inline (invalid URL, duplicate profiles, over 10 experts).  
- Submit POST `/runs` with Supabase JWT; handle 201 success, 400 validation errors, 429 run limit message.  
- Provide run nickname auto-generated (timestamp + primary expert) with option to edit.  
- Analytics events: `run_config_submitted`, `run_config_failed`.

### T-004 – Run Dashboard & Detail
- Dashboard lists latest runs (status, experts count, timestamps, remaining runs).  
- Detail view polls `/runs/{id}` every 5s until terminal state; pause polling after completion/failure.  
- On `needs_login_url`, show modal with instructions, clickable “Open Login Window” (opens new tab to provided URL), and troubleshooting tips.  
- Display real-time status badges, progress indicator, and aggregated metrics (posts analyzed, experts processed) when available.  
- Capture analytics: `run_poll_started`, `login_prompt_shown`, `run_completed`, `run_failed`.

### T-005 – Downloads & Usage Display
- Fetch `/usage` after login and after each run completion; show remaining runs bar + token estimate.  
- For completed runs, fetch artifact metadata (signed URLs exposed by backend) and offer per-expert downloads plus consolidated instructions.  
- Provide copy-to-clipboard CTA for Markdown and guidance for importing into AI projects.  
- Handle 404/410 gracefully if artifact expired; prompt user to re-run.  
- Analytics: `artifact_downloaded`, `usage_viewed`.

### T-006 – QA & Analytics Documentation
- Create `docs/frontend-qa.md` outlining manual test cases (auth flow, run creation, login prompt, download).  
- Define analytics schema (event name, payload) to ensure consistent tracking.  
- Document Lighthouse performance thresholds (LCP < 2.5s target on dashboard).  
- Include accessibility checklist (keyboard navigation, ARIA labels on modals).

## Implementation Notes
- Use Supabase JS client within Lovable to manage sessions and JWT retrieval.  
- Centralize API client with interceptors for 401 handling (refresh or sign out).  
- Debounce polling stop when user navigates away; cleanup intervals to avoid memory leaks.  
- Leverage Lovable components for consistency (cards, modals, toasts) and keep custom CSS minimal.

## Error Handling
- Global toast system for API errors; differentiate validation vs. unexpected errors.  
- For 429 (run limit), display upgrade messaging and link to documentation.  
- If `needs_login_url` persists >10 minutes without progress, show reminder with retry instructions.  
- Log front-end errors to Lovable telemetry / window.onerror hook.

## Telemetry & Analytics
- Track page views, run lifecycle events, errors, and download actions.  
- Ensure analytics calls are non-blocking and respect user privacy (no PII beyond hashed user ID).  
- Provide toggle to disable analytics in development/staging.  
- Mirror event names with backend log fields to ease correlation.

## Testing Strategy
- **Unit**: Validate form input parsing/validation logic, usage bar calculations, polling interval cleanup.  
- **Integration (mock API)**: Cypress or Playwright tests for run creation → status polling → download flow.  
- **Manual QA**: Onboarding, sample preview, login prompt, run limit exhaustion, error handling.  
- **Accessibility**: Use aria-live regions for status updates; keyboard test modals and focus traps.

## Performance Considerations
- Cache `/usage` response client-side for short window (e.g., 30s) to limit API calls during polling.  
- Lazy-load sample preview Markdown to avoid initial bundle bloat.  
- Use incremental polling backoff after completion/failure to reduce requests.

## Risks & Mitigations
- **Token refresh failures**: fallback to sign-in prompt; log incident for debugging.  
- **Browserless link blocked by pop-up blockers**: provide copyable URL and instructions.  
- **Markdown render issues**: sanitize/escape content; provide fallback plain text.

## Acceptance Criteria
- Authenticated user can configure and launch a run, see status updates, complete Browserless login, and download artifacts.  
- Usage allowance accurately reflects backend data after each run.  
- UI communicates errors (validation, run limit, failures) clearly and offers next steps.  
- QA checklist executed with no critical issues.

## Cutover Checklist
- Confirm Supabase env variables present in Lovable production project.  
- Update onboarding copy with final Browserless provider name and pricing tips.  
- Smoke-test run flow in staging and first production deployment.  
- Coordinate release notes with backend launch.

