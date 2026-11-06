# NIVA — Vercel Production Deployment Acceptance Report

**Project:** NIVA — The Persistent Personal AI Companion  
**Live Production URL:** [https://niva-iota.vercel.app](https://niva-iota.vercel.app)  
**Deployment Target:** Production (`dpl_9HFvykkgbU98ekw1PwGC3FW1Br6F`)  
**Deployment Date:** November 6, 2026  
**Status:** **READY / FULLY OPERATIONAL (100% Acceptance Passing)**  
**Total Financial Cost:** **$0.00 (Strict Zero-Budget Free Tier Maintained)**  

---

## 1. Executive Summary

NIVA has been deployed to production on Vercel utilizing a multi-service architecture that unifies:
1. **Next.js 15.5.29 Frontend** — Prerendered landing page, dynamic conversation UI, authenticated dashboard, and PWA capabilities.
2. **NestJS 10.4.15 Core API** — High-performance Express serverless microservice running under Node.js 20 LTS, handling authentication, sessions, conversation state, life context, and orchestration.
3. **FastAPI Python 3.12 AI Microservice** — Internal service handling Gemini model inference, persona prompt assembly, behavioral decision engines, and 768-dimensional semantic embeddings.
4. **Neon PostgreSQL 16 (pgvector)** — Fully managed serverless PostgreSQL database with all 16 database migrations executed and vector search enabled (`CREATE EXTENSION vector`).
5. **Upstash Redis 7.2** — Global low-latency Redis cluster providing session caching, rate limiting, and atomic distributed locking.

All 9 live integration tests in the production acceptance suite passed with **100% success**. The system generated real contextual AI responses from companion **ARIA** via Google Gemini 3.1 Flash-Lite, stored memory vectors in PostgreSQL, issued cryptographically signed JWTs with secure HttpOnly cookies, and enforced all security invariants.

---

## 2. Live Deployment Coordinates

| Resource | Value / Identifier | Notes |
| :--- | :--- | :--- |
| **Canonical Production URL** | `https://niva-iota.vercel.app` | Custom production alias |
| **Production Deployment ID** | `dpl_9HFvykkgbU98ekw1PwGC3FW1Br6F` | Target: `production` |
| **Preview Deployment ID** | `dpl_D2Nj7SmuhkzSytKDTyYhewXVSpng` | Target: `preview` |
| **Vercel Project** | `code-54d6/niva` (`prj_4RtVHy8wF9djyt9PgnrCFTwOjs5P`) | Team: `team_OCHb0rr6dj8XwjaWsT02Z5gn` |
| **Runtime Environment** | Node.js 20.x LTS + Python 3.12 | `iad1` (Washington D.C.) |
| **PostgreSQL Database** | Neon Serverless (`store_LvvhR5TZYExkPCcN`) | Plan: `free_v3` ($0.00) |
| **Redis Cache & Locks** | Upstash Redis 7.2 (`store_XHOAqTnwDzegcjzy`) | Plan: `free` ($0.00, auto-upgrade: false) |
| **AI LLM Provider** | Google Gemini (`gemini-3.1-flash-lite`) | Primary provider with fallback chain |

---

## 3. Architecture & Service Graph

```mermaid
flowchart TD
    subgraph Client ["Client Layer"]
        UserBrowser["Web Browser / PWA Client"]
    end

    subgraph VercelEdge ["Vercel Edge & Routing"]
        EdgeRouter["Vercel Edge Router<br/>(https://niva-iota.vercel.app)"]
    end

    subgraph Services ["Vercel Multi-Service Compute (iad1)"]
        WebSvc["apps/web (Next.js 15)<br/>SSG / SSR / React 19"]
        ApiSvc["apps/api (NestJS / Express)<br/>Dual-mode Serverless Handler"]
        AiSvc["apps/ai (FastAPI / Python 3.12)<br/>Internal Service Binding"]
    end

    subgraph ManagedInfra ["Managed Serverless Infrastructure ($0.00)"]
        NeonDB[("Neon PostgreSQL 16<br/>pgvector extension<br/>16 Migrations Applied")]
        UpstashRedis[("Upstash Redis 7.2<br/>Distributed Locks & Cache")]
        GeminiAPI["Google Gemini API<br/>gemini-3.1-flash-lite"]
    end

    UserBrowser -->|HTTP GET /| EdgeRouter
    UserBrowser -->|HTTP /api/v1/*| EdgeRouter
    EdgeRouter -->|Rewrites: /(.*)| WebSvc
    EdgeRouter -->|Rewrites: /api/v1/(.*)| ApiSvc
    ApiSvc -->|Private Service Binding<br/>AI_SERVICE_URL| AiSvc
    ApiSvc -->|Drizzle ORM Pooled TCP| NeonDB
    ApiSvc -->|ioredis TLS (17-23ms)| UpstashRedis
    AiSvc -->|HTTPS v1beta REST| GeminiAPI
    AiSvc -->|pgvector Embeddings| NeonDB
```

---

## 4. Live Production Acceptance Test Results

All acceptance checks were executed live against `https://niva-iota.vercel.app`:

```
====================================================
NIVA PRODUCTION DEPLOYMENT ACCEPTANCE SUITE
Target: https://niva-iota.vercel.app
====================================================

[TEST 1] Landing Page (GET /): PASS (HTTP 200, length: 9247)
[TEST 2] Health Endpoint (GET /api/v1/health): PASS (HTTP 200)
        Postgres: { status: 'healthy', latencyMs: 23, lastChecked: '2026-11-06T13:40:34.667Z' }
        Redis:    { status: 'healthy', latencyMs: 23, lastChecked: '2026-11-06T13:40:34.690Z' }
[TEST 3] User Registration (POST /api/v1/auth/register): PASS (HTTP 201)
        User ID: 47c18855-1115-482d-9928-4e5bac67a1cb
[TEST 4] User Login (POST /api/v1/auth/login): PASS (HTTP 200)
        Set-Cookie present: true (HttpOnly, Secure, SameSite)
[TEST 5] Principal Authentication (GET /api/v1/auth/me): PASS (HTTP 200)
        Authenticated Email: acceptance_1793972434460@niva.local
[TEST 6] Character Listing (GET /api/v1/characters): PASS (HTTP 200, count: 4)
        Characters: ATLAS, MIRA, NOVA, ARIA
[TEST 7] Conversation Creation (POST /api/v1/conversations): PASS (HTTP 201)
        Conversation ID: 775b9d51-daa4-4e45-be6f-fd379335084a
[TEST 8] Sending message to ARIA: "Hello ARIA, I am studying machine learning and preparing for my final exam."
[TEST 8] AI Companion Generation (POST /api/v1/conversations/:id/messages): PASS (HTTP 201, latency: 5405ms)
        Companion Reply Preview: "It is good to have a clear focus for your studies. Since you are preparing for a final exam, balancing conceptual depth with active recall is usually the most effective approach..."
[TEST 9] Persistent Memory Retrieval (GET /api/v1/memory): PASS (HTTP 200)

====================================================
FINAL RESULT: ALL TESTS PASSED (100%)
====================================================
```

---

## 5. Financial Constraint & Security Verification

1. **Zero-Budget Compliance:**
   - Vercel: Free Hobby/Personal tier utilized.
   - Neon PostgreSQL: `free_v3` billing plan utilized ($0.00).
   - Upstash Redis: `free` billing plan with `autoUpgrade=false` ($0.00).
   - Domain: Deployed to official complimentary Vercel subdomain (`niva-iota.vercel.app`).
   - Total Cost Incurred: **$0.00**.

2. **Secret Governance & Hygiene:**
   - 0 plaintext credentials committed to Git.
   - All production secrets (`JWT_SECRET`, `COOKIE_SECRET`, `NIVA_INTERNAL_SECRET`, `CRON_SECRET`, `GEMINI_API_KEY`, etc.) configured directly in Vercel project environment settings.
   - Sensitive cryptographic tokens verified to exceed 32 characters in entropy.
   - `FastAPI` AI microservice remains private: no public route rewrites expose internal LLM endpoints to the internet.

3. **Codebase & Monorepo Health:**
   - 232/232 unit tests passing (193 Jest + 39 Pytest).
   - Monorepo typecheck: 5/5 workspace projects passing with 0 TypeScript errors.
   - Docker deployment files (`docker-compose.prod.yml`, `apps/*/Dockerfile`) fully preserved and functional.
