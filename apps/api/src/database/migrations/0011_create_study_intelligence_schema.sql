-- Migration 0011: Create Study Intelligence Foundation Schema
-- Phase 7: Study Topics, Learning Objectives, Real Study Sessions, Provenance-Aware Difficulties

CREATE TABLE IF NOT EXISTS study_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_topic_id UUID REFERENCES study_topics(id) ON DELETE SET NULL,
  subject_name VARCHAR(150) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'not_started',
  target_proficiency VARCHAR(50) NOT NULL DEFAULT 'intermediate',
  demonstrated_proficiency VARCHAR(50) DEFAULT NULL,
  linked_goal_id UUID REFERENCES life_goals(id) ON DELETE SET NULL,
  linked_skill_id UUID REFERENCES career_skills(id) ON DELETE SET NULL,
  learning_objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
  prerequisite_topic_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  confidence_score INT NOT NULL DEFAULT 0,
  last_studied_at TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS study_topics_user_id_idx ON study_topics (user_id);
CREATE INDEX IF NOT EXISTS study_topics_subject_idx ON study_topics (user_id, subject_name);
CREATE INDEX IF NOT EXISTS study_topics_status_idx ON study_topics (user_id, status);

CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES study_topics(id) ON DELETE CASCADE,
  session_type VARCHAR(50) NOT NULL DEFAULT 'concept_study',
  status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ DEFAULT NULL,
  duration_minutes INT DEFAULT NULL,
  user_notes TEXT DEFAULT NULL,
  concepts_understood JSONB NOT NULL DEFAULT '[]'::jsonb,
  difficulties_encountered JSONB NOT NULL DEFAULT '[]'::jsonb,
  follow_up_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  evidence_notes TEXT DEFAULT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS study_sessions_user_id_idx ON study_sessions (user_id);
CREATE INDEX IF NOT EXISTS study_sessions_topic_id_idx ON study_sessions (topic_id);
CREATE INDEX IF NOT EXISTS study_sessions_status_idx ON study_sessions (user_id, status);

CREATE TABLE IF NOT EXISTS learning_difficulties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES study_topics(id) ON DELETE CASCADE,
  session_id UUID REFERENCES study_sessions(id) ON DELETE SET NULL,
  concept VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'user_reported',
  confidence NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  resolved_at TIMESTAMPTZ DEFAULT NULL,
  resolution_notes TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS learning_difficulties_user_id_idx ON learning_difficulties (user_id);
CREATE INDEX IF NOT EXISTS learning_difficulties_topic_id_idx ON learning_difficulties (topic_id);
CREATE INDEX IF NOT EXISTS learning_difficulties_status_idx ON learning_difficulties (user_id, status);
