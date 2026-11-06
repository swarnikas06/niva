# NIVA Testing & Verification Guide

This document outlines the testing architecture, test suites, and verification procedures across the NIVA monorepo.

---

## 1. Testing Philosophy

NIVA enforces a strict **Zero-Mock Verification Standard** for release acceptance:
* **No Mocked Success Claims**: Critical features (PostgreSQL transactions, pgvector cosine search, Redis locks, WebPush delivery, in-thread state isolation) are verified against running Docker containers and live services.
* **Deterministic Invariant Testing**: Conversational intelligence, memory extraction, quiet hours enforcement, and speech processing algorithms are validated with comprehensive scenario matrices.

---

## 2. Test Suite Overview

| Category | Framework / Tool | Scope | Test Count | Pass Rate |
| :--- | :--- | :--- | :--- | :--- |
| **API Unit & Module Tests** | Jest (TypeScript) | Authentication, Context, Memory, Life, Study, Career, Reflection, Events, Health | **193 tests** (25 suites) | **100.0%** |
| **Frontend Static Verification** | TypeScript (`tsc --noEmit`) | Next.js 15 App Router, React 19 hooks, DTO parity | **0 errors** | **100.0%** |
| **Full-System Integration Suites** | Node.js Test Runners | E2E authentication, push notifications, reminder intelligence, voice, multi-thread isolation | **472 tests** (27 suites) | **100.0%** |
| **Browser Acceptance** | Chrome DevTools MCP | Push notifications, Web Speech STT/TTS, visual thread switching | **Verified Live** | **100.0%** |

---

## 3. Running Test Suites

### 3.1 Running NestJS API Unit & Integration Tests
Executes all 25 Jest test suites across backend domain modules:
```bash
pnpm --filter @niva/api test
```

To run a specific domain suite:
```bash
pnpm --filter @niva/api test src/conversation/conversation.service.spec.ts
```

### 3.2 Running Frontend TypeScript Verification
Verifies strict typecheck compliance across the Next.js web application:
```bash
pnpm --filter @niva/web typecheck
```

### 3.3 Running Python AI Service Tests
From the `apps/ai` directory:
```bash
cd apps/ai
pytest tests/ -v
cd ../..
```

---

## 4. End-to-End & Acceptance Test Suites

NIVA maintains a comprehensive suite of live integration test scripts in the repository root and `scratch/`:

```bash
# SaaS Authentication & Security (43 tests)
node test_saas_auth_security.mjs

# Google OAuth Security & CSRF Nonce Validation (14 tests)
node scratch/test_google_oauth_security.mjs

# Real-World Push Notification Acceptance (33 tests)
node test_proactive_push_acceptance.mjs

# Reminder Intelligence & NLU Deadline Extraction (48 tests)
node test_reminder_intelligence_acceptance.mjs

# Personalisation, Trust & 4 Character Archetypes (21 tests)
node test_personalisation_trust_and_companion.mjs

# Everyday Experience & Notification Acceptance (16 tests)
node test_everyday_experience_notifications.mjs

# Final Product Completion & Multi-Persona Architecture (19 tests)
node test_final_product_completion.mjs

# Speech Recognition & Voice Deduplication Fixes (30 tests)
node scratch/test_conversation_voice_fixes.mjs

# Independent Conversation Processing & Composer Isolation (39 tests)
node scratch/test_conversation_isolation.mjs
```

---

## 5. Acceptance Test Verification Matrix

All 472 integration checks have passed against production Docker containers:

| Suite Name | Scope & Scenarios Verified | Tests | Result |
| :--- | :--- | :--- | :--- |
| `test_conversation_isolation.mjs` | Per-thread state isolation, concurrent message generation, response routing non-bleeding, rapid thread navigation, lossless draft preservation, dynamic Stop/Send cancellation, failure isolation, and PostgreSQL live concurrency | 39 | **PASS (100%)** |
| `test_conversation_voice_fixes.mjs` | Speech-to-text deduplication, intentional abort suppression, optimistic submission lifecycle, MIRA short affirmation progression | 30 | **PASS (100%)** |
| `test_final_product_completion.mjs` | Modern 4-character catalog (ATLAS, MIRA, NOVA, ARIA), legacy alias resolution, persistent selection, in-thread persona switching, structured response blueprints, long-term memory continuity | 19 | **PASS (100%)** |
| `test_everyday_experience_notifications.mjs` | 8 proactive notification categories, quiet hours, anti-spam deduplication, active dialogue suppression, timezone math | 16 | **PASS (100%)** |
| `test_personalisation_trust_and_companion.mjs` | Frictionless 1-click onboarding, 4 archetype differentiation, central memory continuity, intelligent questioning, memory deletion, quiet hours | 21 | **PASS (100%)** |
| `test_companion_intelligence_refinement.mjs` | Multi-deadline balance, memory conflict resolution, conversation continuity, proportional natural tone, quiet hours | 15 | **PASS (100%)** |
| `test_reminder_intelligence_acceptance.mjs` | NLU deadline extraction (specific, relative, ambiguous), timezone correctness (IST 5 PM = 11:30 UTC), 3-tier scheduling, dynamic urgent adjustment, delivery, fulfillment cancellation | 48 | **PASS (100%)** |
| `test_proactive_push_acceptance.mjs` | WebPush VAPID lifecycle, multi-device subscriptions, 3-tier advance scheduling, 5s ticker claiming, context handover, cancellation, quiet hours, IDOR | 33 | **PASS (100%)** |
| `test_dst_transitions.mjs` | EST, EDT, IST timezone offset conversion and Daylight Saving Time transition boundaries | 11 | **PASS (100%)** |
| `test_job_retry_backoff.ps1` | Live PostgreSQL failure recovery, retry increment, backoff delay, terminal failure | 2 | **PASS (100%)** |
| `test_container_acceptance.mjs` | Multi-container Docker topology, dual-network isolation, DB persistence across restarts, worker crash recovery | 30 | **PASS (100%)** |
| `test_saas_auth_security.mjs` | SaaS authentication, registration, login, token rotation, sessions, account deletion | 43 | **PASS (100%)** |
| `test_gap_closure.mjs` | End-to-end critical product gap closure verification | 24 | **PASS (100%)** |
| `test_e2e_validation.mjs` | Conversational product validation | 15 | **PASS (100%)** |
| `test_conversational_refinement.mjs` | Conversational naturalness and context handling | 12 | **PASS (100%)** |
| `test_student_understanding.mjs` | Student profile extraction, degree, routines, explicit user corrections | 10 | **PASS (100%)** |
| `test_real_world_user_workflow.mjs` | 14-step end-to-end user lifecycle (Registration through Push Handover) | 14 | **PASS (100%)** |
| `test_security_acceptance.mjs` | Multi-tenant isolation, cross-user IDOR on goals & tasks, cascade deletion | 8 | **PASS (100%)** |
| `test_google_oauth_security.mjs` | Google OAuth CSRF state verification, nonce handling, replay attack rejection | 14 | **PASS (100%)** |
| `test_email_delivery_capabilities.mjs` | Email verification token, reset token, single-use, old password rejection | 22 | **PASS (100%)** |
| `test_local_email_flow.mjs` | Local email capture buffer, verification tokens, reset links, zero token leakage | 12 | **PASS (100%)** |
| `test_browser_push_delivery.mjs` | Browser push subscriptions, WebPush dispatch, dead endpoint pruning | 14 | **PASS (100%)** |
| `test_proactive_intelligence.mjs` | Proactive intelligence policies, scheduled reminders | 19 | **PASS (100%)** |
| `test_live_smtp_delivery.mjs` | Outbound Google SMTP socket and handshake verification | 1 | **PASS (100%)** |
| **Cumulative Total** | **All Integration & Acceptance Suites Combined** | **472** | **100.0% PASS** |
