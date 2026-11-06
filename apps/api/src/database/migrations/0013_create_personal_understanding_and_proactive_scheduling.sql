-- ==============================================================================
-- Migration 0013: Personal Understanding, Background Scheduling & Notifications
-- NIVA Phase 10: Personal Understanding, Deadline Intelligence & Proactive Scheduling
-- ==============================================================================

-- 1. Create user_profiles table (Consolidated Evolving Personal Understanding)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    education JSONB NOT NULL DEFAULT '{}'::jsonb,
    profession JSONB NOT NULL DEFAULT '{}'::jsonb,
    expertise_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
    interests JSONB NOT NULL DEFAULT '[]'::jsonb,
    daily_routines JSONB NOT NULL DEFAULT '{}'::jsonb,
    communication_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    learning_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    ongoing_challenges JSONB NOT NULL DEFAULT '[]'::jsonb,
    important_dates JSONB NOT NULL DEFAULT '[]'::jsonb,
    attribute_confidence JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- 2. Create scheduled_jobs table (Persistent Background Scheduling & Timers)
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_type VARCHAR(64) NOT NULL,
    target_type VARCHAR(64) NOT NULL,
    target_id VARCHAR(128) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled', 'failed', 'rescheduled')),
    idempotency_key VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    max_retries INTEGER NOT NULL DEFAULT 3 CHECK (max_retries >= 0),
    last_error TEXT NULL,
    executed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scheduled_jobs_user_idempotency ON scheduled_jobs(user_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_poll ON scheduled_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_target ON scheduled_jobs(target_type, target_id);

-- 3. Create notifications table (Durable Multi-Channel Notification Audit & History)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id UUID REFERENCES scheduled_jobs(id) ON DELETE SET NULL,
    channel VARCHAR(32) NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'browser', 'email')),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    action_url TEXT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ NULL,
    delivery_status VARCHAR(32) NOT NULL DEFAULT 'delivered' CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'suppressed')),
    delivery_attempts INTEGER NOT NULL DEFAULT 1 CHECK (delivery_attempts >= 0),
    delivery_result JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read, created_at);

-- 4. Create notification_subscriptions table (Browser Push Web Push Subscriptions)
CREATE TABLE IF NOT EXISTS notification_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    browser VARCHAR(64) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_subs_user ON notification_subscriptions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notif_subs_user_endpoint ON notification_subscriptions(user_id, endpoint);

-- 5. Expand user_proactive_preferences with notification channel settings
ALTER TABLE user_proactive_preferences ADD COLUMN IF NOT EXISTS in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_proactive_preferences ADD COLUMN IF NOT EXISTS browser_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_proactive_preferences ADD COLUMN IF NOT EXISTS email_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_proactive_preferences ADD COLUMN IF NOT EXISTS advance_reminder_days INTEGER NOT NULL DEFAULT 2;
ALTER TABLE user_proactive_preferences ADD COLUMN IF NOT EXISTS progress_check_hours INTEGER NOT NULL DEFAULT 24;
ALTER TABLE user_proactive_preferences ADD COLUMN IF NOT EXISTS final_reminder_hours INTEGER NOT NULL DEFAULT 2;
