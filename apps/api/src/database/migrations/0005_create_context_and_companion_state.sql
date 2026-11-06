-- Migration 0005: Create Context and Companion State tables

-- 1. Create companion_states table
CREATE TABLE IF NOT EXISTS companion_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    character_id VARCHAR(50) NOT NULL REFERENCES character_archetypes(id) ON DELETE RESTRICT,
    presence_status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (presence_status IN ('active', 'idle', 'focused', 'reflecting')),
    interaction_mode VARCHAR(30) NOT NULL DEFAULT 'chat' CHECK (interaction_mode IN ('chat', 'study', 'planning', 'review')),
    active_focus_goal_id UUID REFERENCES life_goals(id) ON DELETE SET NULL,
    active_focus_project_id UUID REFERENCES life_projects(id) ON DELETE SET NULL,
    continuity_streak_days INTEGER NOT NULL DEFAULT 1 CHECK (continuity_streak_days >= 0),
    total_interactions INTEGER NOT NULL DEFAULT 0 CHECK (total_interactions >= 0),
    last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companion_states_user ON companion_states(user_id);
CREATE INDEX IF NOT EXISTS idx_companion_states_character ON companion_states(character_id);

-- 2. Create context_snapshots table
CREATE TABLE IF NOT EXISTS context_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    trigger_reason VARCHAR(50) NOT NULL,
    token_budget_allocated INTEGER NOT NULL,
    token_count_estimated INTEGER NOT NULL,
    assembled_frame JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_context_snapshots_user_created ON context_snapshots(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_context_snapshots_conversation ON context_snapshots(conversation_id);
