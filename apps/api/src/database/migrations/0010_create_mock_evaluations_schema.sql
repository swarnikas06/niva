-- NIVA Phase 6B: Career Placement Strategy & Mock Evaluation Foundation Migration
-- Creates career_evaluation_sessions, career_evaluation_questions, career_evaluation_answers

CREATE TABLE IF NOT EXISTS career_evaluation_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_role_id UUID NOT NULL REFERENCES career_target_roles(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES career_skills(id) ON DELETE SET NULL,
  evaluation_type VARCHAR(64) NOT NULL DEFAULT 'technical',
  status VARCHAR(32) NOT NULL DEFAULT 'started',
  current_difficulty VARCHAR(32) NOT NULL DEFAULT 'intermediate',
  current_question_index INTEGER NOT NULL DEFAULT 0,
  total_planned_questions INTEGER NOT NULL DEFAULT 3,
  overall_rating VARCHAR(32),
  overall_score INTEGER,
  summary TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS career_evaluation_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES career_evaluation_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sequence_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  difficulty VARCHAR(32) NOT NULL DEFAULT 'intermediate',
  targeted_skill VARCHAR(150) NOT NULL,
  context_rationale TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_career_eval_question_seq UNIQUE (session_id, sequence_number)
);

CREATE TABLE IF NOT EXISTS career_evaluation_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL UNIQUE REFERENCES career_evaluation_questions(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES career_evaluation_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer_text TEXT NOT NULL,
  evaluation_status VARCHAR(32) NOT NULL DEFAULT 'pending',
  overall_rating VARCHAR(32),
  dimensions JSONB NOT NULL DEFAULT '[]'::jsonb,
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  follow_up_needed BOOLEAN NOT NULL DEFAULT false,
  suggested_next_difficulty VARCHAR(32),
  feedback_notes TEXT,
  evaluated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries and user-scoped isolation
CREATE INDEX IF NOT EXISTS idx_career_eval_sessions_user_status ON career_evaluation_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_career_eval_sessions_role ON career_evaluation_sessions(target_role_id);
CREATE INDEX IF NOT EXISTS idx_career_eval_questions_session ON career_evaluation_questions(session_id, sequence_number);
CREATE INDEX IF NOT EXISTS idx_career_eval_answers_session ON career_evaluation_answers(session_id);
CREATE INDEX IF NOT EXISTS idx_career_eval_answers_user ON career_evaluation_answers(user_id);
