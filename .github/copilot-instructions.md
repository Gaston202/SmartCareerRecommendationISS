# Copilot Instructions for SmartCareerRecommendationISS

## Monorepo map (start here)
- `backend/`: FastAPI API (main server on port 3000), business logic, AI orchestration, ingestion, and tests.
- `admin-dashboard/`: Next.js 16 + TypeScript admin UI.
- `Mobile/`: Expo React Native client.
- `Mobile/server/`: standalone FastAPI job scraping service (port 8000).

## First-pass workflow for cloud agents
1. Read `README.md` at repo root, then the subproject README for the area you are changing.
2. Limit scope to one subproject when possible.
3. Make the smallest possible change in that subproject only.
4. Run lint/test/build only for the touched subproject before finishing.

## Where key code lives
- Backend app entrypoint: `backend/app/main.py`
- Backend API router composition: `backend/app/api/v1/router.py`
- Backend tests: `backend/tests/{unit,integration,e2e}/`
- Admin routes: `admin-dashboard/app/**`
- Admin auth/middleware: `admin-dashboard/auth.ts`, `admin-dashboard/middleware.ts`
- Mobile navigation root: `Mobile/src/navigation/RootNavigator.tsx`
- Mobile feature modules: `Mobile/src/features/**`

## Validation commands by subproject

### Backend (`backend/`)
- Install deps: `make install`
- Lint: `make lint`
- Tests: `make test`
- Dev server: `make dev`

### Admin dashboard (`admin-dashboard/`)
- Install deps: `npm install`
- Lint: `npm run lint`
- Build: `npm run build`
- Dev server: `npm run dev`

### Mobile app (`Mobile/`)
- Install deps: `npm install`
- Lint: `npm run lint`
- Dev server: `npm start`

## Environment and secrets
- Never commit `.env`, `.env.local`, API keys, or Supabase secrets.
- Existing env templates:
  - `admin-dashboard/.env.example`
  - `Mobile/.env.example`
- Backend uses `backend/.env` (loaded by `backend/app/core/config.py`) but there is currently no committed `backend/.env.example`; derive required keys from `backend/app/core/config.py` and root/backend README docs.

## Error log from onboarding checks (and workarounds)
The following were observed when running validation commands in a fresh environment before dependency install:

1. `backend: make lint` failed with `ruff: No such file or directory`.
   - Workaround: run `cd backend && make install` first.
2. `backend: make test` failed with `pytest: No such file or directory`.
   - Workaround: run `cd backend && make install` first.
3. `admin-dashboard: npm run lint` failed with `eslint: not found`.
   - Workaround: run `cd admin-dashboard && npm install` first.
4. `admin-dashboard: npm run build` failed with `next: not found`.
   - Workaround: run `cd admin-dashboard && npm install` first.
5. `Mobile: npm run lint` failed with `expo: not found`.
   - Workaround: run `cd Mobile && npm install` first.

## Backend dependency pitfall to preserve
- Keep using `backend/Makefile` `make install` instead of ad-hoc `pip install -r requirements.txt` when bootstrapping.
- Reason: install order is intentional to avoid `python-jobspy` / `numpy` compatibility issues (documented in `backend/Makefile` and `backend/requirements.txt` comments).

## Practical change guidance
- Keep API changes consistent across backend + clients:
  - If backend request/response contracts change, update:
    - Admin hooks/services (`admin-dashboard/hooks`, `admin-dashboard/services`)
    - Mobile API layer/types (`Mobile/src/api`, `Mobile/src/features/**/types`)
- Preserve existing strict TypeScript patterns in dashboard/mobile.
- For backend, keep route registration centralized through `backend/app/api/v1/router.py` unless intentionally mounting root-level routes.

## Quick sanity checks before finishing
- Only changed files relevant to the task.
- Lint/tests/build for touched subproject pass (or failures are documented with cause and workaround).
- No secrets in diffs.
