-- Migration: 0012_create_longitudinal_reflection_schema.sql
-- Description: Create longitudinal observations and reflection snapshots tables with strict user isolation and evidence provenance.

CREATE TABLE IF NOT EXISTS longitudinal_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category VARCHAR(64) NOT NULL,
    title VARCHAR(255) NOT NULL,
    fact TEXT NOT NULL,
    interpretation TEXT NOT NULL,
    supporting_evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
    time_window_start TIMESTAMPTZ NOT NULL,
    time_window_end TIMESTAMPTZ NOT NULL,
    window_days INTEGER NOT NULL DEFAULT 7,
    confidence REAL NOT NULL DEFAULT 0.8,
    confidence_type VARCHAR(32) NOT NULL DEFAULT 'inferred_pattern',
    status VARCHAR(32) NOT NULL DEFAULT 'active',
    user_correction_notes TEXT,
    confirmed_at TIMESTAMPTZ,
    corrected_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    surfaced_count INTEGER NOT NULL DEFAULT 0,
    last_surfaced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_longitudinal_obs_user_status ON longitudinal_observations(user_id, status);
CREATE INDEX IF NOT EXISTS idx_longitudinal_obs_user_category ON longitudinal_observations(user_id, category);
CREATE INDEX IF NOT EXISTS idx_longitudinal_obs_user_created ON longitudinal_observations(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reflection_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    window_days INTEGER NOT NULL DEFAULT 14,
    summary TEXT NOT NULL,
    progress_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    unresolved_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    intentions_and_outcomes JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reflection_snapshots_user_created ON reflection_snapshots(user_id, created_at DESC);
