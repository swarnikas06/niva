-- Migration 0014: Expand proactive preferences with scheduled companion moments and categories
ALTER TABLE user_proactive_preferences ADD COLUMN IF NOT EXISTS morning_checkin_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_proactive_preferences ADD COLUMN IF NOT EXISTS morning_checkin_time VARCHAR(8) NOT NULL DEFAULT '09:00';
ALTER TABLE user_proactive_preferences ADD COLUMN IF NOT EXISTS evening_checkin_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_proactive_preferences ADD COLUMN IF NOT EXISTS evening_checkin_time VARCHAR(8) NOT NULL DEFAULT '18:00';
ALTER TABLE user_proactive_preferences ADD COLUMN IF NOT EXISTS weekly_reflection_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE user_proactive_preferences ADD COLUMN IF NOT EXISTS enabled_categories JSONB NOT NULL DEFAULT '["deadline_reminders","study_checkins","project_followups","goal_progress","daily_companion","milestone_acknowledgements","gentle_inactivity"]'::jsonb;
