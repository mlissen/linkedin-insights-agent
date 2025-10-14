# Repo Map

## Overview
Language: TypeScript  
Framework: Node.js (backend services), Lovable Cloud (front-end)  
Monorepo: No  
Build tools: TypeScript compiler (`tsc`), TSX, Vitest  
Package manager: npm  
CI/CD: Pending (manual deploys for MVP; GitHub Actions to be defined)

## Folder Structure
- `docs/`  
  - `plan-20250214-1735-lyn.md` – Backend service implementation plan  
  - `plan-20250214-2000-lyn.md` – Lovable front-end implementation plan  
  - (Future) `frontend-qa.md` – QA checklist for UI (to be created in T-006)
- `src/` – Existing CLI-based scraping/analyzer modules (TypeScript)
- `services/api/` – Node/Express API service (to be added during execution)
- `services/worker/` – Worker service for Browserless scraping pipeline (to be added)
- `supabase/` – Database migrations and configs (initial migration pending)  
- `package.json`, `tsconfig.json` – Shared TypeScript project scaffolding
