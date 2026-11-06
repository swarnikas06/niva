# NIVA Database Architecture (PostgreSQL 16 + pgvector)

## Overview
PostgreSQL is the single, authoritative source of truth for NIVA.

## Extensions Required
- `vector` (pgvector for semantic search embeddings)
- `uuid-ossp` (UUID v4 primary keys)
- `pgcrypto` (cryptographic hashing functions)

## Target Domains (Scheduled for Phase 6)
1. **Core Identity:** `users`, `profiles`, `sessions`, `user_preferences`
2. **Companion & Character:** `characters`, `personas`, `companion_states`
3. **Conversations:** `conversations`, `messages`, `interaction_signals`
4. **Memory:** `memories`, `memory_embeddings` (vector dimension 768 / 1536)
5. **Life State:** `goals`, `projects`, `tasks`, `commitments`, `ideas`, `events`
6. **Growth & Placement:** `skills`, `placement_profiles`, `study_sessions`
7. **Orchestration & Audit:** `agent_runs`, `notifications`, `audit_logs`
