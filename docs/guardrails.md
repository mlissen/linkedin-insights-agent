## Key Modules
- `src/` – Existing CLI analyzer/scraper modules awaiting service extraction  
- `services/api/src/**` – Backend API (to be created) handling runs and usage  
- `services/worker/src/**` – Worker orchestrator for Browserless sessions  
- Lovable screens (`Onboarding`, `RunDashboard`, etc.) – Front-end experience

## Data & State
Database: Supabase Postgres (managed)  
Cache/Queue: Upstash Redis + BullMQ  
State management: Supabase auth session + in-app React state (Lovable)  

## External Integrations
- Supabase Auth (email magic link)  
- Browserless (interactive Puppeteer sessions)  
- Supabase Storage (artifact downloads)  
- Analytics: Lovable telemetry + custom events

## Build & Deployment
Deployed to: Backend (Render/Fly/TBD), Frontend (Lovable Cloud)  
Environment management: Supabase secrets, Lovable env settings, backend `.env` (secured)  
Feature flag system: None for MVP (env toggles only)  

## Testing
Framework: Vitest (backend), Lovable testing (Cypress/Playwright TBD)  
Coverage goal: Target >80% for critical backend modules; UI uses targeted integration tests  
CI steps: Manual for MVP; future pipeline Test → Build → Deploy  

## Observability
Logs: pino (backend), Lovable logging for front-end  
Metrics: Supabase tables (usage counters); future queue depth logging  

## Notable Risks or TODOs
- Browserless login fragility (MFA, pop-up blockers)  
- Need per-expert bundler tests to ensure fidelity  
- Backend queue depth monitoring still minimal  
- Supabase JWT refresh must be verified in Lovable UI
