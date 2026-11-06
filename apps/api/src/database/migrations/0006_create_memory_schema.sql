-- ==============================================================================
-- Migration 0006: Create persistent memory foundation tables
-- NIVA Phase 3A: Memory Extraction Jobs, Memory Candidates, Durable Memories, Memory Embeddings
-- ==============================================================================

-- Ensure vector extension is active
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Create memory_extraction_jobs table (Recoverable Processing / Outbox)
CREATE TABLE IF NOT EXISTS memory_extraction_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID REFERENCES conversation_messages(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    max_retries INTEGER NOT NULL DEFAULT 3 CHECK (max_retries >= 0),
    last_error TEXT NULL,
    turn_context JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_extraction_jobs_status ON memory_extraction_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_memory_extraction_jobs_user_conv ON memory_extraction_jobs(user_id, conversation_id);

-- 2. Create memory_candidates table
CREATE TABLE IF NOT EXISTS memory_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES memory_extraction_jobs(id) ON DELETE SET NULL,
    source_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    source_message_id UUID REFERENCES conversation_messages(id) ON DELETE SET NULL,
    category VARCHAR(32) NOT NULL CHECK (category IN ('semantic_fact', 'user_preference', 'episodic_event', 'open_loop')),
    content TEXT NOT NULL,
    confidence NUMERIC(3, 2) NOT NULL CHECK (confidence >= 0.00 AND confidence <= 1.00),
    confidence_type VARCHAR(20) NOT NULL CHECK (confidence_type IN ('explicit', 'inferred')),
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'failed')),
    rejection_reason VARCHAR(255) NULL,
    importance INTEGER NOT NULL DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
    rationale TEXT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_candidates_user_status ON memory_candidates(user_id, status);
CREATE INDEX IF NOT EXISTS idx_memory_candidates_user_category ON memory_candidates(user_id, category);
CREATE INDEX IF NOT EXISTS idx_memory_candidates_job ON memory_candidates(job_id);

-- 3. Create memories table (Durable Memories)
CREATE TABLE IF NOT EXISTS memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES memory_candidates(id) ON DELETE SET NULL,
    category VARCHAR(32) NOT NULL CHECK (category IN ('semantic_fact', 'user_preference', 'episodic_event', 'open_loop')),
    content TEXT NOT NULL,
    confidence NUMERIC(3, 2) NOT NULL CHECK (confidence >= 0.00 AND confidence <= 1.00),
    confidence_type VARCHAR(20) NOT NULL CHECK (confidence_type IN ('explicit', 'inferred')),
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'archived', 'deleted')),
    source_type VARCHAR(32) NOT NULL DEFAULT 'conversation' CHECK (source_type IN ('conversation', 'manual_user', 'onboarding')),
    source_conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    source_message_id UUID REFERENCES conversation_messages(id) ON DELETE SET NULL,
    superseded_by_id UUID REFERENCES memories(id) ON DELETE SET NULL,
    reinforcement_count INTEGER NOT NULL DEFAULT 1 CHECK (reinforcement_count >= 1),
    last_reinforced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_from TIMESTAMPTZ NULL,
    valid_until TIMESTAMPTZ NULL,
    importance INTEGER NOT NULL DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memories_user_status ON memories(user_id, status);
CREATE INDEX IF NOT EXISTS idx_memories_user_category ON memories(user_id, category);
CREATE INDEX IF NOT EXISTS idx_memories_user_reinforced ON memories(user_id, last_reinforced_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_superseded_by ON memories(superseded_by_id);

-- 4. Create memory_embeddings table
CREATE TABLE IF NOT EXISTS memory_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_id UUID NOT NULL UNIQUE REFERENCES memories(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    embedding vector(768) NOT NULL,
    provider VARCHAR(64) NOT NULL DEFAULT 'gemini',
    model VARCHAR(64) NOT NULL DEFAULT 'text-embedding-004',
    dimensions INTEGER NOT NULL DEFAULT 768,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_embeddings_user ON memory_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_hnsw ON memory_embeddings USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
