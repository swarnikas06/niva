-- ==============================================================================
-- Migration 0008: Create domain events and proactive companion tables
-- NIVA Phase 4: Event & Proactive Companion Foundation
-- ==============================================================================

-- 1. Create domain_events table (Durable Event Store & Outbox)
CREATE TABLE IF NOT EXISTS domain_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    event_version INTEGER NOT NULL DEFAULT 1,
    aggregate_type VARCHAR(64) NOT NULL,
    aggregate_id VARCHAR(128) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'dead_letter')),
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    max_retries INTEGER NOT NULL DEFAULT 3 CHECK (max_retries >= 0),
    last_error TEXT NULL,
    processed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_domain_events_status_created ON domain_events(status, created_at);
CREATE INDEX IF NOT EXISTS idx_domain_events_user_status ON domain_events(user_id, status);
CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate ON domain_events(aggregate_type, aggregate_id);

-- 2. Create proactive_candidates table
CREATE TABLE IF NOT EXISTS proactive_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES domain_events(id) ON DELETE CASCADE,
    candidate_type VARCHAR(64) NOT NULL,
    topic VARCHAR(128) NOT NULL,
    urgency VARCHAR(32) NOT NULL DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high')),
    importance INTEGER NOT NULL DEFAULT 5 CHECK (importance >= 1 AND importance <= 10),
    context_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'evaluated', 'discarded')),
    decision VARCHAR(32) NULL CHECK (decision IS NULL OR decision IN ('NO_ACTION', 'DEFER', 'ACT')),
    decision_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    evaluated_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_proactive_candidates_user_status ON proactive_candidates(user_id, status);
CREATE INDEX IF NOT EXISTS idx_proactive_candidates_event ON proactive_candidates(event_id);

-- 3. Create proactive_actions table (Delivered In-App Interventions)
CREATE TABLE IF NOT EXISTS proactive_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    candidate_id UUID REFERENCES proactive_candidates(id) ON DELETE SET NULL,
    action_type VARCHAR(64) NOT NULL DEFAULT 'IN_APP_MESSAGE' CHECK (action_type IN ('IN_APP_MESSAGE', 'IN_APP_PROMPT')),
    channel VARCHAR(32) NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app')),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'delivered' CHECK (status IN ('pending_delivery', 'delivered', 'dismissed', 'acted_upon')),
    delivered_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proactive_actions_user_status ON proactive_actions(user_id, status, created_at);

-- 4. Create proactive_cooldowns table (Anti-Spam & Duplicate Prevention)
CREATE TABLE IF NOT EXISTS proactive_cooldowns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    topic VARCHAR(128) NOT NULL,
    candidate_type VARCHAR(64) NOT NULL,
    cooldown_until TIMESTAMPTZ NOT NULL,
    last_action_id UUID REFERENCES proactive_actions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_proactive_cooldown_unique ON proactive_cooldowns(user_id, topic, candidate_type);
CREATE INDEX IF NOT EXISTS idx_proactive_cooldown_lookup ON proactive_cooldowns(user_id, cooldown_until);

-- 5. Create user_proactive_preferences table (Quiet Hours, Timezone, Limits)
CREATE TABLE IF NOT EXISTS user_proactive_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    proactive_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    quiet_hours_start VARCHAR(8) NOT NULL DEFAULT '22:00',
    quiet_hours_end VARCHAR(8) NOT NULL DEFAULT '08:00',
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    max_daily_interactions INTEGER NOT NULL DEFAULT 3 CHECK (max_daily_interactions >= 1 AND max_daily_interactions <= 10),
    allow_high_urgency_in_quiet_hours BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
