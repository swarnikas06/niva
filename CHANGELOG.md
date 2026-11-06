# Changelog

All notable changes to the NIVA project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-11-06

### Initial Production-Ready Open-Source Release

#### Added
* **Four Calibrated Companion Archetypes**:
  - `ATLAS` (The Strategic Mind — Sapphire `#2563EB`): Objective, systems-oriented first-principles thinking.
  - `MIRA` (The Thoughtful Companion — Emerald `#059669`): Empathetic, grounded equilibrium and reflective inquiry.
  - `NOVA` (The Momentum Builder — Amber `#D97706`): Action-oriented, high-energy acceleration to overcome friction.
  - `ARIA` (The Balanced Intelligence — Iris `#7C3AED`): Composed, synthesized clarity and adaptable guidance.
  - In-thread persona switching (`PATCH /conversations/:id`) with shared cognitive memory continuity.

* **Durable Cognitive Memory Engine**:
  - Automated background extraction daemon (`MemoryWorkerService`) with 5-second atomic job claiming (`SKIP LOCKED`).
  - PostgreSQL 16 `pgvector` extension with 768-dimensional embeddings (`gemini-embedding-001`).
  - HNSW indexing (`m=16`, `ef_construction=64`) for sub-millisecond semantic retrieval.
  - Memory provenance logging, confidence tracking, and explicit user forgetting (`DELETE /memory/:id`).

* **Thread-Isolated Conversation Processing**:
  - Per-thread independent state tracking (`messagesByConvId`, `processingByConvId`, `loadingConvs`, `draftsByConvIdRef`, `abortControllersRef`).
  - Non-blocking concurrent message generation across multiple active conversations.
  - Lossless unsent draft preservation on thread navigation.
  - Real-time animated `Thinking...` badges in the dialogue drawer.
  - Per-thread generation cancellation via dynamic Stop button controls.
  - Zero cross-thread message bleeding.

* **Browser-Native Voice Engine**:
  - Speech-to-Text (STT) voice dictation via W3C Web Speech API with clean session text accumulation and word deduplication.
  - Text-to-Speech (TTS) voice synthesis tuned per character archetype with automatic markdown stripping.
  - Safe error suppression for user-initiated recognition cancellations.

* **Proactive Intelligence & Scheduler**:
  - 3-tier advance reminder scheduling (`advance`, `progress_check`, `final`) backed by PostgreSQL.
  - Proactive check-ins, morning intentions, evening check-ins, project follow-ups, and milestone acknowledgments.
  - Browser Push API (VAPID) delivery with deep-link context handover (`/conversation?commitmentId=...`).
  - Respect for user quiet hours and 24-hour anti-spam deduplication cooldowns.

* **Deterministic Cognitive Context Assembly**:
  - Synthesizes 8 personal life domains (Identity, Goals, Commitments, Study Roadblocks, Career Benchmarks, Memories, Reflections, Persona Directives).
  - Strict 4,000-token budget preventing prompt bloat and hallucination.

* **Enterprise Authentication & Account Governance**:
  - Bcrypt (cost factor 12) password hashing with strong password validation.
  - Dual-token lifecycle (15m JWT access tokens, 30d rotated refresh tokens in PostgreSQL `sessions`).
  - Google OAuth 2.0 with HMAC CSRF state tokens, single-use Redis nonces, and replay attack prevention.
  - GDPR-compliant JSON data export (`GET /auth/export`) and atomic cascade account deletion (`DELETE /auth/account`).

* **Multi-Container Production Topology**:
  - Multi-stage Dockerfiles (`apps/web`, `apps/api`, `apps/ai`) running as unprivileged non-root users (`UID 1001`).
  - Dual-network security topology (`niva-backend-network: internal=true`, `niva-egress-network`).
  - Gemini provider free-tier quota cooldown and model fallback chain (`gemini-3.1-flash-lite`, `gemini-3.1-flash-lite-preview`).

#### Security & Compliance
* Fixed critical Next.js dependency CVEs by upgrading to `next@15.5.29` (`pnpm audit --prod` reports 0 critical vulnerabilities).
* Enforced strict row-level user data isolation across all 44 relational database tables.
* Reconciled cumulative monorepo automated test count to **472 / 472 passing tests** across 27 integration suites and 25 Jest API suites.
