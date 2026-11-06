# ADR 0005: Environment Configuration & Secret Isolation

## Status
Accepted

## Context
NIVA processes sensitive personal context, user credentials, and AI API keys. Secrets must never be exposed to clients or checked into source control.

## Decision
1. **Separation of Concerns:**
   - **Client Configuration:** Only variables prefixed with `NEXT_PUBLIC_` in `apps/web` are exposed to the browser (e.g. `NEXT_PUBLIC_API_URL`).
   - **Server Secrets:** `GEMINI_API_KEY`, `JWT_SECRET`, `DATABASE_URL`, and OAuth secrets are accessible exclusively to backend services (`apps/api`, `apps/ai`).
2. **Fail-Fast Startup Validation:** Environment schemas (`packages/validation` via Zod in Node, `pydantic-settings` in Python) validate required environment variables upon service boot.
3. **Repository Cleanliness:** `.gitignore` explicitly ignores `.env` and all `.env.*` files (excluding `.env.example`).
