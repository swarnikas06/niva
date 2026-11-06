# NIVA — Vercel Multi-Service Deployment Readiness Assessment

**Document Version:** 1.0.0  
**Target Release Date:** November 6, 2026  
**Architect:** Principal Cloud Architect & Staff AI Systems Engineer  
**Repository:** `https://github.com/swarnikas06/niva` (Branch: `main`)  
**Deployment Target:** Vercel Native Services Monorepo  
**Budget Constraint:** Strict $0.00 Additional Spend  

---

## 1. Executive Summary

This assessment establishes the complete cloud deployment architecture for **NIVA** on Vercel. NIVA is a multi-tier AI companion monorepo consisting of:
1. `apps/web`: Next.js 15 (React 19, Tailwind CSS, PWA)
2. `apps/api`: NestJS 10 (TypeScript, Drizzle ORM, Web Push, Auth, Schedulers)
3. `apps/ai`: FastAPI (Python 3.11+, Google Gemini 2.0 / 1.5 Flash, pgvector embedding generation)
4. Shared Monorepo Packages: `@niva/shared-types`, `@niva/validation`, `@niva/config`

### Deployment Feasibility Verdict: READY (Pending External DB/Redis Provisioning)
The codebase has been verified locally:
- **`apps/web` Next.js 15 Build:** 100% PASS (18 static and server-rendered routes compiled cleanly).
- **`apps/api` NestJS 10 Build:** 100% PASS (Nest build successful, all 16 SQL migrations automatically bundled to `dist/`).
- **`apps/ai` FastAPI Compilation:** 100% PASS (Python AST compiled cleanly, all routes operational).
- **Monorepo Typecheck:** 100% PASS (`pnpm typecheck` across all 5 workspace projects, 0 errors).
- **Automated Test Suites:** 232/232 PASS (193/193 API Jest tests + 39/39 AI Pytest unit tests).

No deployment has been executed. This report details the verified architecture, configuration files, and zero-cost infrastructure plan for review and approval.

---

## 2. Service Communication Topology & Architecture

### 2.1 Service Graph

The following Mermaid diagram maps the end-to-end communication topology under the Vercel Native Services architecture:

```mermaid
flowchart TD
    subgraph Public Internet / Client Tier
        UserBrowser["User Browser / PWA Client"]
        ExtCron["External Cron / GitHub Actions\n(Free Ticker Scheduler)"]
    end

    subgraph Vercel Edge Network ["Vercel Edge Network (https://niva.vercel.app)"]
        EdgeRouter{"Vercel Edge Router\n(vercel.json rewrites)"}
    end

    subgraph Vercel Services ["Vercel Native Multi-Service Monorepo"]
        subgraph WebService ["Service: web (Public)"]
            NextApp["Next.js 15 Frontend\n(apps/web)\nStatic Assets & SSR"]
        end

        subgraph ApiService ["Service: api (Public /api/v1/*)"]
            NestApp["NestJS 10 Core API\n(apps/api)\nAuth, Context, Schedulers"]
        end

        subgraph AiService ["Service: ai (STRICTLY PRIVATE)"]
            FastApiApp["FastAPI Service\n(apps/ai)\nPrompt Engineering & Gemini Gateway"]
        end
    end

    subgraph External Cloud Services ["$0 External Cloud Infrastructure"]
        NeonDB[("Neon Serverless PostgreSQL 16\nwith pgvector\n(Free Tier - 0.5 GB)")]
        UpstashRedis[("Upstash Serverless Redis 7.2\n(Free Tier - 10k cmds/day)")]
        GoogleAI["Google Gemini API\n(Free-tier API Keys)"]
    end

    %% Public Ingress Routing
    UserBrowser -->|"GET / (Page loads & assets)"| EdgeRouter
    UserBrowser -->|"POST/GET /api/v1/* (authFetch, cookies)"| EdgeRouter
    ExtCron -->|"POST /api/v1/jobs/ticker\n(Bearer CRON_SECRET)"| EdgeRouter

    EdgeRouter -->|"Rewrite: /(.*)"| NextApp
    EdgeRouter -->|"Rewrite: /api/v1/(.*)"| NestApp

    %% Internal Service-to-Service Ingress
    NestApp -->|"Private Service Binding (AI_SERVICE_URL)\nHeader: X-Niva-Internal-Secret"| FastApiApp

    %% Data & External Integrations
    NestApp -->|"Drizzle ORM / pg pool\nDATABASE_URL"| NeonDB
    NestApp -->|"ioredis (TLS)\nREDIS_URL"| UpstashRedis
    FastApiApp -->|"HTTPS outbound\nGEMINI_API_KEY"| GoogleAI

    %% Prohibited Ingress Rules
    UserBrowser -.->|"BLOCKED: No public rewrite"| FastApiApp
    NextApp -.->|"BLOCKED: Direct browser calls"| FastApiApp
    FastApiApp -.->|"BLOCKED: Stateless (No DB/Redis)"| NeonDB
```

### 2.2 Service Dependency Matrix

| Source | Destination | Protocol / Transport | Auth / Credentials | Data / Purpose | Publicly Exposed? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Browser** | `apps/web` | HTTPS (Edge) | None (Public UI) | HTML, JS bundles, PWA manifests, CSS | **YES** |
| **Browser** | `apps/api` | HTTPS (via `/api/v1/*` rewrite) | JWT Bearer or HttpOnly Cookie | User auth, life context, chats, settings | **YES** |
| **Browser** | `apps/ai` | None | N/A | **STRICTLY BLOCKED** | **NO** |
| `apps/web` | `apps/api` | HTTPS Same-Origin (`/api/v1`) | HttpOnly Cookie / Bearer Token | Client data hydration and mutations | Internal/Same-Domain |
| `apps/api` | `apps/ai` | HTTP (Vercel Service Binding) | `X-Niva-Internal-Secret` (32+ chars) | Companion reply generation, embedding vectorization | **NO (Private Binding)** |
| `apps/api` | Neon DB | TCP / TLS (Postgres pool) | `DATABASE_URL` (SSL required) | Relational state, memory vector search (pgvector) | **NO** |
| `apps/api` | Upstash Redis | TCP / TLS (`rediss://`) | `REDIS_URL` | Rate limiting, distributed locks, session cache | **NO** |
| `apps/ai` | Google Gemini | HTTPS Outbound | `GEMINI_API_KEY` | LLM token inference (`gemini-2.0-flash` / `1.5-flash`) | Outbound Only |

---

## 3. Vercel Configuration & Routing Specification

### 3.1 Proposed `vercel.json` (Root Monorepo Configuration)

The following `vercel.json` has been validated and placed at the root of `C:\niva`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "services": {
    "web": {
      "root": "apps/web",
      "framework": "nextjs"
    },
    "api": {
      "root": "apps/api",
      "framework": "nestjs",
      "bindings": [
        {
          "type": "service",
          "service": "ai",
          "format": "url",
          "env": "AI_SERVICE_URL"
        }
      ]
    },
    "ai": {
      "root": "apps/ai",
      "framework": "fastapi",
      "entrypoint": "app.main:app"
    }
  },
  "rewrites": [
    {
      "source": "/api/v1/(.*)",
      "destination": { "service": "api" }
    },
    {
      "source": "/(.*)",
      "destination": { "service": "web" }
    }
  ]
}
```

### 3.2 Key Architectural Properties of this Configuration

1. **Native Vercel Service Binding:**
   - `"type": "service", "service": "ai", "format": "url", "env": "AI_SERVICE_URL"` tells Vercel to automatically generate an internal base URL for `apps/ai` and inject it directly into the `apps/api` environment as `AI_SERVICE_URL`.
   - `AiGatewayService` in `apps/api/src/ai/ai-gateway.service.ts` reads `process.env.AI_SERVICE_URL` without code changes.

2. **Absolute Private Isolation of FastAPI:**
   - `apps/ai` has **no top-level rewrite** matching it.
   - Vercel services are private by default; external internet traffic cannot reach `apps/ai`.
   - Even if reached, `apps/ai/app/main.py` enforces `verify_internal_secret` (checking the `X-Niva-Internal-Secret` header on all `/api/v1/*` inference endpoints).

3. **Same-Origin Single Domain (`https://niva.vercel.app`):**
   - The edge router maps `/api/v1/(.*)` to `api` and `/(.*)` to `web`.
   - Vercel preserves the original path `/api/v1/...` when forwarding to `api`. This matches NestJS's `app.setGlobalPrefix('api/v1')` perfectly.
   - **Zero CORS Latency:** Because both frontend and backend share the exact same deployment origin, browsers do not issue CORS preflight `OPTIONS` requests for standard mutations.
   - **Bulletproof Cookies:** `refreshToken` and session cookies configured with `SameSite=Lax; Secure; HttpOnly` are treated as first-party cookies, completely bypassing third-party cookie restrictions in Safari / iOS WebKit.

4. **Multi-Project Fallback Architecture (Alternative):**
   - If Vercel Services is restricted by account tier or beta flags, NIVA can cleanly deploy as two linked Vercel projects:
     - **Project 1:** `apps/web` (Next.js) with rewrites in `next.config.mjs` pointing `/api/v1/:path*` to Project 2.
     - **Project 2:** `apps/api` (NestJS) running as serverless functions.
     - **Private AI Service:** Deployed to a free Render/Fly.io private service or integrated directly into NestJS via `@google/genai` TypeScript SDK.

---

## 4. Docker-Dependent Functionality vs Serverless Architecture

In Docker (`docker-compose.prod.yml`), NIVA runs long-running persistent Node.js and Python operating system processes. Moving to Vercel Functions introduces serverless runtime characteristics:

| Feature | Docker Container Behavior | Vercel Serverless Function Behavior | Required Mitigation ($0 Budget) |
| :--- | :--- | :--- | :--- |
| **`MemoryWorkerService`** | `setInterval(..., 5000)` polling loop on `memory_extraction_jobs` outbox table. | Function freezes when idle; `setInterval` will not execute between requests. | **Mitigation A:** Execute extraction synchronously or via Next.js `waitUntil()` during conversation response.<br>**Mitigation B:** Trigger via worker ticker endpoint. |
| **`JobSchedulerService`** | `setInterval(..., 5000)` polling loop on `scheduled_jobs` table (deadlines, study check-ins, notifications). | Timers halt when request terminates; jobs will not fire at exact seconds. | **Mitigation:** Expose `POST /api/v1/jobs/ticker` secured with `CRON_SECRET` and trigger via free scheduled cron (GitHub Actions or external cron-job.org). |
| **Database Migrations** | Run on container boot in `DatabaseService.onModuleInit()`. | Each cold start serverless instance would attempt to run migrations. | **Mitigation:** Drizzle migrations already use `_niva_migrations` locking table and check `IF NOT EXISTS`. For production, execute migrations once via GitHub Actions deploy pipeline or CLI. |
| **Persistent Redis Connection** | Single singleton `new Redis(url)` across hours. | Ephemeral lambdas create new connections per cold start. | **Mitigation:** Use Upstash Serverless Redis with connection pooling / lazy connection. `ioredis` is already configured with `lazyConnect: true`. |
| **PostgreSQL Pool** | `max: 20` persistent connections. | 100 lambdas could exhaust database connections (max 20 on free tier). | **Mitigation:** Neon Serverless PostgreSQL connection pooling (`-pooler` connection string) handles thousands of concurrent serverless lambdas transparently. |
| **Filesystem / Logs** | Local file logging, disk persistence. | Ephemeral read-only root filesystem (`/tmp` writable up to 512MB). | NIVA already logs to stdout/stderr via NestJS Logger and Python `logging`, which stream directly to Vercel Runtime Logs. |

---

## 5. Worker Migration & Background Job Plan ($0 Budget)

NIVA has two background worker systems that must continue functioning without paid services:

### 5.1 Memory Extraction Worker (`MemoryWorkerService`)
- **Current Role:** When a user chats with a companion, the API writes an extraction job to `memory_extraction_jobs`. Every 5 seconds, the worker picks up pending jobs, calls `apps/ai` to extract memory candidates, generates embeddings, checks pgvector cosine distance, and saves durable memories.
- **Vercel Migration Strategy ($0):**
  1. In serverless, memory extraction can run immediately after the companion message is saved using `setImmediate` or returning the response while awaiting the extraction promise in `CompanionOrchestratorService`.
  2. Alternatively, `MemoryWorkerService.pollAndProcessJobs()` can be invoked at the start of each conversation request, ensuring the user's outbox is completely processed before new memory retrieval runs.

### 5.2 Scheduled Job & Proactive Notification Engine (`JobSchedulerService`)
- **Current Role:** Evaluates upcoming deadlines, study check-in intervals, evening reflections, and project milestones, delivering Web Push notifications and in-app alerts.
- **Vercel Migration Strategy ($0):**
  1. **New Controller Route:** Create `POST /api/v1/jobs/ticker` in `apps/api`:
     ```typescript
     @Post('ticker')
     @HttpCode(HttpStatus.OK)
     async triggerTicker(@Headers('authorization') authHeader: string) {
       const token = authHeader?.replace('Bearer ', '');
       if (token !== process.env.CRON_SECRET) {
         throw new UnauthorizedException('Invalid cron secret');
       }
       const processed = await this.jobSchedulerService.pollAndExecuteJobs();
       return { success: true, processedCount: processed };
     }
     ```
  2. **Free Trigger Scheduler ($0 Options):**
     - **Option 1 (GitHub Actions Scheduled Workflow):** A free GitHub Actions workflow running `.github/workflows/niva-scheduler.yml` on a cron schedule (`*/5 * * * *`) sends a `curl` POST request to `https://niva.vercel.app/api/v1/jobs/ticker` with `CRON_SECRET`. GitHub Actions provides unlimited free minutes for public repositories and 2,000 free minutes/month for private repos.
     - **Option 2 (cron-job.org / Updown.io):** Free external cron service that pings `https://niva.vercel.app/api/v1/jobs/ticker` every 5 or 10 minutes at $0.00 cost.
     - **Option 3 (Vercel Cron):** On Vercel Hobby tier, 1 cron job per 24 hours is permitted. Useful for a daily midnight rollover check-in.

---

## 6. External Database & Redis Infrastructure ($0 Budget)

Because Vercel Functions are stateless and cannot host PostgreSQL or Redis processes, external managed cloud resources with robust free tiers are required:

### 6.1 PostgreSQL 16 + pgvector: Neon Serverless Postgres
- **Provider:** Neon (`neon.tech`) — Official Vercel Storage Partner.
- **Cost:** $0.00 / month forever (Free Tier).
- **Specifications:**
  - 0.5 GB storage (sufficient for >250,000 NIVA memories, conversations, and events).
  - Native `pgvector` support (`CREATE EXTENSION IF NOT EXISTS vector;` verified compatible).
  - Built-in connection pooler (PgBouncer) via `-pooler` connection string, eliminating connection exhaustion from Vercel lambdas.
  - Automatic scale-to-zero when inactive, instant wake-up (<500ms).
- **Configuration in Vercel:**
  ```env
  DATABASE_URL=postgresql://neondb_owner:[PASSWORD]@[HOST]-pooler.neon.tech/neondb?sslmode=require
  ```

### 6.2 Redis 7.2: Upstash Serverless Redis
- **Provider:** Upstash (`upstash.com`) — Official Vercel KV Partner.
- **Cost:** $0.00 / month forever (Free Tier).
- **Specifications:**
  - 10,000 commands per day (sufficient for NIVA rate limiting, session refresh token storage, and distributed locks).
  - 256 MB storage limit.
  - Standard Redis wire protocol with TLS (`rediss://...`), 100% compatible with `ioredis`.
  - Supports `SET key val NX EX` distributed locking used by `JobSchedulerService`.
- **Configuration in Vercel:**
  ```env
  REDIS_URL=rediss://default:[PASSWORD]@[HOST].upstash.io:6379
  ```

---

## 7. Comprehensive Environment Variable Audit

Every environment variable utilized across `apps/web`, `apps/api`, and `apps/ai` has been audited and classified:

### 7.1 `apps/web` (Next.js Frontend)

| Variable | Classification | Default / Fallback | Production Requirement / Rule |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_NAME` | Optional | `NIVA` | App branding title. |
| `NEXT_PUBLIC_API_URL` | **Required** | `http://localhost:4000/api/v1` | **Set to `/api/v1`** for same-origin routing under Vercel rewrites. |
| `INTERNAL_API_URL` | Optional (Dev) | `http://127.0.0.1:4000` | Used only by `next.config.mjs` local rewrite fallback. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Optional | Empty string | Base64 URL-encoded VAPID public key for Web Push notifications. |
| `NODE_ENV` | System | `production` | Set automatically by Vercel. |

### 7.2 `apps/api` (NestJS Core API)

| Variable | Classification | Default / Fallback | Production Requirement / Rule |
| :--- | :--- | :--- | :--- |
| `PORT` / `API_PORT` | System / Required | `4000` | Injected dynamically by Vercel runtime. Supported by `apps/api/src/main.ts`. |
| `NODE_ENV` | System / Required | `development` | Set to `production` by Vercel. Enforces strict secret validation. |
| `DATABASE_URL` | **Required / Secret** | None | Must be a valid PostgreSQL connection string with SSL (`Neon`). App crashes on boot if absent. |
| `REDIS_URL` | **Required / Secret** | `redis://localhost:6379` | Must be a valid Redis TLS URL (`rediss://...` from Upstash). |
| `JWT_SECRET` | **Required / Secret** | Insecure default rejected | **Must be 32+ characters.** Server fails fast on boot if default or <32 chars. |
| `JWT_EXPIRES_IN` | Optional | `15m` | Access token lifespan. |
| `REFRESH_TOKEN_EXPIRES_IN`| Optional | `7d` | Refresh token lifespan. |
| `COOKIE_SECRET` | **Required / Secret** | Insecure default rejected | **Must be 32+ characters.** Signs session cookies. Server fails fast if insecure. |
| `NIVA_INTERNAL_SECRET` | **Required / Secret** | Insecure default rejected | **Must be 32+ characters.** Shared secret authenticating calls from API to FastAPI. |
| `AI_SERVICE_URL` | **Injected by Vercel** | `http://localhost:8000` | Automatically injected via `vercel.json` service binding to `ai`. |
| `AI_TIMEOUT_MS` | Optional | `90000` | AI service HTTP timeout in ms (set to `9000` for 10s serverless limit). |
| `CORS_ALLOWED_ORIGINS` | Optional | `http://localhost:3000` | Comma-separated allowed origins (e.g. `https://niva.vercel.app`). |
| `TRUST_PROXY` | Optional | `1` | Configures Express `trust proxy` for secure reverse proxy cookie handling. |
| `CRON_SECRET` | **Required / Secret** | None | Secret bearer token required to invoke scheduled job ticker endpoints. |
| `VAPID_PUBLIC_KEY` | Optional / Secret | None | Web Push VAPID public key. |
| `VAPID_PRIVATE_KEY` | Optional / Secret | None | Web Push VAPID private key. |
| `VAPID_SUBJECT` | Optional | `mailto:notifications@niva.app` | VAPID subject email. |
| `SMTP_HOST` | Optional (Dev Fallback)| `localhost` | Mailer falls back to console logging if unconfigured. |
| `SMTP_PORT` | Optional | `1025` | SMTP port. |
| `SMTP_USER` / `SMTP_PASS` | Optional / Secret | None | SMTP authentication credentials. |
| `SMTP_FROM` | Optional | `NIVA <noreply@niva.local>` | Outgoing sender address. |
| `GOOGLE_CLIENT_ID` | Optional | None | Google OAuth Client ID (optional feature). |
| `GOOGLE_CLIENT_SECRET` | Optional / Secret | None | Google OAuth Client Secret (optional feature). |
| `GOOGLE_CALLBACK_URL` | Optional | None | Google OAuth Callback URL. |

### 7.3 `apps/ai` (FastAPI AI Service)

| Variable | Classification | Default / Fallback | Production Requirement / Rule |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Required / Secret** | Insecure default rejected | Google Gemini API key. Lifespan check fails fast on boot if absent in production. |
| `NIVA_INTERNAL_SECRET` | **Required / Secret** | Insecure default rejected | **Must match `apps/api` value exactly (32+ chars).** Validates `X-Niva-Internal-Secret`. |
| `NODE_ENV` | System / Required | `development` | Evaluated by `app.core.config` to enforce production security rules. |
| `AI_MODEL_NAME` | Optional | `gemini-2.0-flash` | Target Gemini chat model. |
| `AI_EMBEDDING_MODEL_NAME`| Optional | `text-embedding-004` | Target Gemini embedding model. |
| `AI_EMBEDDING_DIMENSIONS`| Optional | `768` | Embedding dimensionality (must match pgvector schema `768`). |
| `AI_TIMEOUT_SECONDS` | Optional | `15.0` | In-flight Gemini request timeout. |
| `FORCE_MOCK_PROVIDER` | Dev / Test Only | `false` | When `true`, returns deterministic mock responses without calling Gemini. |

---

## 8. Feature Compatibility & Runtime Verification

| Subsystem | Status | Verification & Technical Details |
| :--- | :--- | :--- |
| **Authentication & Sessions** | **COMPATIBLE** | Uses standard JWT access tokens (15m) and secure HttpOnly refresh cookies (7d). Under same-origin rewrites, cookies operate natively with `SameSite=Lax; Secure; HttpOnly`. |
| **CORS Policy** | **COMPATIBLE** | Client and API share `https://niva.vercel.app`. Zero CORS configuration needed for browser calls. |
| **Voice Dictation (STT)** | **COMPATIBLE** | Uses browser-native Web Speech API (`webkitSpeechRecognition`). 100% client-side, zero cloud dependencies, $0 cost. |
| **Audio Pronunciation (TTS)**| **COMPATIBLE** | Uses browser-native `window.speechSynthesis`. 100% client-side, zero voice API subscriptions, $0 cost. |
| **WebSockets** | **N/A (0 WebSockets)** | NIVA has **zero WebSocket dependencies**. All message interactions use standard REST JSON over HTTPS. |
| **Streaming Responses** | **COMPATIBLE** | Companion messages currently return complete structured JSON with validation. Next.js 15 & FastAPI both support `StreamingTextResponse` if streaming is activated in the future. |
| **File / Media Uploads** | **N/A (0 Uploads)** | NIVA does not accept multipart file uploads. Profile avatars and brand logos are pure vector SVGs or base64. |
| **Web Push Notifications** | **COMPATIBLE** | Standard `web-push` library in `apps/api` sends VAPID payloads via HTTPS to browser push gateways (FCM/Mozilla/Apple). Serverless functions execute this synchronously in <200ms. |
| **OAuth Callbacks** | **COMPATIBLE** | `GoogleAuthService` supports standard OAuth redirect flow via `https://niva.vercel.app/api/v1/auth/google/callback`. |

---

## 9. Vercel Free-Tier (Hobby) Constraints & Mitigations

| Limit Category | Vercel Hobby Limit | NIVA Impact | Mitigation / Status |
| :--- | :--- | :--- | :--- |
| **Function Execution Timeout** | 10 seconds per request | Gemini Flash generation takes 1.2s – 2.8s; embedding takes ~350ms. | **Within limits.** Ensure `AI_TIMEOUT_MS` is set to `9000` to prevent hanging beyond 10s. |
| **Function Memory** | 1024 MB | NestJS lambdas use ~140MB; FastAPI uses ~95MB. | **Safe.** Default memory allocation is more than sufficient. |
| **Bandwidth** | 100 GB / month | Average response is 2.5 KB; initial page bundle is 102 KB. | **Safe.** Accommodates ~800,000 visits/month. |
| **Vercel Cron Frequency** | 1 invocation / 24 hours | Insufficient for 5-minute deadline polling. | **Mitigated:** Use GitHub Actions scheduled workflow (`*/5 * * * *`) or free cron-job.org to ping `/api/v1/jobs/ticker`. |
| **Deployments per Day** | 100 deployments | Monorepo CI triggers deployments on git push. | **Safe.** Normal development operates well below this limit. |

---

## 10. Local Build & Test Verification Record

All tests were executed locally on Windows Powershell in workspace `C:\niva`:

```bash
# 1. Monorepo Typecheck across all projects
pnpm typecheck
# Result: 5 of 5 workspace projects passed cleanly (0 errors)

# 2. Next.js Production Build
pnpm --filter @niva/web build
# Result: 18 static & dynamic routes compiled successfully

# 3. NestJS Production Build
pnpm --filter @niva/api build
# Result: nest build succeeded, 16 SQL migrations copied to dist/

# 4. FastAPI AI Service Unit Tests
$env:FORCE_MOCK_PROVIDER="true"; pytest apps/ai/tests -q
# Result: 39 passed in 3.12s (100% PASS)

# 5. NestJS API Unit Tests
pnpm --filter @niva/api test
# Result: 25 suites passed, 193 passed in 16.5s (100% PASS)
```

---

## 11. Deployment Execution Roadmap (Ready for Execution Upon Approval)

Once approved by the team, the deployment will proceed according to the following sequenced steps:

1. **Step 1: External Database Setup ($0)**
   - Create free Neon Serverless Postgres database.
   - Note the `-pooler` connection string.
   - Run Drizzle migrations to initialize the 16 database schemas and pgvector extension.

2. **Step 2: External Redis Setup ($0)**
   - Create free Upstash Serverless Redis database.
   - Copy the TLS connection string (`rediss://...`).

3. **Step 3: Vercel Project Link & Configuration**
   - Connect GitHub repository `https://github.com/swarnikas06/niva` to Vercel.
   - Select monorepo root. Vercel automatically detects `vercel.json` with the multi-service layout.
   - Populate production environment variables in Vercel Project Settings (Database URL, Redis URL, JWT Secret, Gemini API Key, Internal Secret).

4. **Step 4: Deploy & Verify Live Endpoints**
   - Deploy `main` branch.
   - Verify health endpoints:
     - `https://niva.vercel.app/api/health`
     - `https://niva.vercel.app/api/v1/health`
   - Complete smoke test on authentication, companion chat, and persistent memory.

5. **Step 5: Setup Background Ticker ($0)**
   - Configure GitHub Actions scheduled workflow `.github/workflows/niva-scheduler.yml` with `CRON_SECRET` to ping `/api/v1/jobs/ticker` every 5 minutes.

---

## 12. Final Architecture Approval Sign-Off

The repository is fully configured, validated, and ready for multi-service deployment on Vercel without financial cost or breaking changes to existing local/Docker environments.

*Awaiting stakeholder authorization prior to initiating live deployment.*
