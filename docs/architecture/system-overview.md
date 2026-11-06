# NIVA Architecture System Overview

**Status:** Phase 0 Active  
**Last Updated:** September 2026  

---

## 1. Core Architectural Tenet

> **NIVA is not an LLM with features built around it. NIVA is a persistent personal intelligence system in which an LLM is one reasoning component.**

NIVA's intelligence emerges from the synergy of:
`Conversation + Memory + Life State + Time Awareness + Events + Goals + Behavioral Context + Planning + Personality + AI Reasoning + Proactive Decision Making`

---

## 2. Service Responsibilities & Domain Boundaries

### 1. `apps/web` (Frontend - Next.js 15 App Router)
- **Role:** Presentation & Presence layer.
- **Responsibilities:**
  - Ambient presence experience (not a dense dashboard).
  - Streaming conversational interface.
  - Memory exploration and transparent management.
  - Life & Growth context visualization.
  - Client-side token / session storage via secure cookies.

### 2. `apps/api` (Core Backend - NestJS 10 REST API)
- **Role:** Central domain authority and transaction coordinator.
- **Responsibilities:**
  - Strict user isolation and authorization.
  - PostgreSQL schema management & migrations.
  - Redis cache & BullMQ background job orchestration.
  - Event publishing (`UserMessageSent`, `TaskCreated`, `StudySessionStarted`, etc.).
  - Orchestration of AI service requests.
  - **Single gateway for all client interactions.** (Browser never calls AI or DB directly).

### 3. `apps/ai` (AI Intelligence Service - Python 3.12 FastAPI)
- **Role:** AI reasoning, vector operations, and agent execution.
- **Responsibilities:**
  - AI Provider abstraction (`AIProvider` / `GeminiProvider`).
  - Structured output extraction (Memory, Life Signals, Planning).
  - Semantic similarity calculation and dense vector generation.
  - Prompt registry and versioning.

---

## 3. Data Storage Tiers

1. **PostgreSQL 16 with pgvector:**
   - **The Single Source of Truth.**
   - Stores all durable state: users, conversations, durable memories, memory vectors, goals, projects, tasks, placement profiles, companion states, audit logs.
2. **Redis 7.2:**
   - **Ephemeral Infrastructure & Caching.**
   - Stores rate-limit buckets, session locks, temporary tokens, BullMQ job queues, and cached presence indicators.
   - **Never used as primary storage for durable memories.**

---

## 4. Distinction: Current Phase 0 vs. Future Roadmap

| Capability | Phase 0 Status | Target Phase |
| :--- | :--- | :--- |
| Monorepo & Polyglot Scaffolding | **Implemented & Verified** | Phase 0 |
| Docker Compose (Postgres + Redis) | **Configured & Validated** | Phase 0 |
| Liveness & Readiness Health Probes | **Implemented & Verified** | Phase 0 |
| AI Provider Abstraction Interface | **Implemented & Verified** | Phase 0 |
| Base Packages (`shared-types`, `validation`, `config`) | **Implemented & Verified** | Phase 0 |
| Authentication & User Isolation | Not Implemented | Phase 2 |
| Contextual Onboarding | Not Implemented | Phase 3 |
| Character / Persona Engine | Not Implemented | Phase 4 |
| Conversation Engine & Streaming | Not Implemented | Phase 5 |
| Relational Database Schema & Migrations | Migration Framework in Phase 0; Domain Tables in Phase 6 | Phase 6 |
| Durable Memory Extraction & Vector Retrieval | Not Implemented | Phase 7 |
| Life State & Tasks / Goals | Not Implemented | Phase 8 |
| Multi-Agent Companion Orchestration | Not Implemented | Phase 9 |
| Career & Placement Intelligence | Not Implemented | Phase 10 |
| Study Companion & "Stay With Me" Mode | Not Implemented | Phase 11 |
| Proactive Interaction Policy Engine | Not Implemented | Phase 12 |
