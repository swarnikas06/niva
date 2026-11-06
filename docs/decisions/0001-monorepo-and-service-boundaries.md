# ADR 0001: Monorepo Architecture & Service Boundaries

## Status
Accepted

## Context
NIVA requires a web frontend (Next.js), a core transactional backend (NestJS), and an AI reasoning service (Python/FastAPI). We needed to decide between separate repositories or a unified polyglot monorepo.

## Decision
We adopted a unified monorepo using `pnpm` workspaces for TypeScript applications and packages, alongside an isolated Python virtual environment for the AI service.

### Service Boundaries:
1. **`apps/web` (Next.js):** Client-side presentation and presence. Never calls the AI service or database directly.
2. **`apps/api` (NestJS):** The authoritative orchestrator. Handles authentication, authorization, business logic, persistence, and external service mediation.
3. **`apps/ai` (FastAPI):** Specialized AI computation, embedding generation, and prompt execution. Exposes internal REST endpoints to `apps/api`.
4. **`packages/*`:** Shared TypeScript types, Zod validation schemas, and common constants.

## Consequences
- **Positive:** Single commit history, simplified cross-package atomic refactoring, unified CI/CD, and explicit internal network boundaries.
- **Trade-off:** Requires explicit contract sharing strategy between TypeScript and Python services (see ADR 0004).
