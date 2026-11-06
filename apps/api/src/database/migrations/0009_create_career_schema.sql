-- NIVA Phase 6A: Career & Placement Intelligence Foundation Migration
-- Creates career_profiles, career_target_roles, career_skills, target_role_skills,
-- user_skills, skill_evidence, career_preparation_activities, career_gap_analyses

CREATE TABLE IF NOT EXISTS career_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  headline VARCHAR(255) NOT NULL,
  current_level VARCHAR(64) NOT NULL DEFAULT 'mid_level',
  target_timeline_months INTEGER NOT NULL DEFAULT 6,
  target_company_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_locations JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_compensation_range JSONB,
  stated_readiness VARCHAR(64) NOT NULL DEFAULT 'early_preparation',
  status VARCHAR(64) NOT NULL DEFAULT 'active_preparation',
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS career_target_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  role_family VARCHAR(64) NOT NULL DEFAULT 'software_engineering',
  seniority_level VARCHAR(64) NOT NULL DEFAULT 'senior',
  priority VARCHAR(32) NOT NULL DEFAULT 'primary',
  target_company_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS career_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL UNIQUE,
  category VARCHAR(64) NOT NULL DEFAULT 'core_technical',
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS target_role_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_role_id UUID NOT NULL REFERENCES career_target_roles(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES career_skills(id) ON DELETE CASCADE,
  importance VARCHAR(32) NOT NULL DEFAULT 'high_priority',
  minimum_proficiency VARCHAR(32) NOT NULL DEFAULT 'intermediate',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_target_role_skill UNIQUE (target_role_id, skill_id)
);

CREATE TABLE IF NOT EXISTS user_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES career_skills(id) ON DELETE CASCADE,
  self_rating VARCHAR(32) NOT NULL DEFAULT 'intermediate',
  verified_level VARCHAR(32),
  confidence_score INTEGER NOT NULL DEFAULT 50,
  last_practiced_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_skill UNIQUE (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS skill_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_skill_id UUID NOT NULL REFERENCES user_skills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  evidence_type VARCHAR(64) NOT NULL DEFAULT 'project_artifact',
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  url VARCHAR(1000),
  validation_status VARCHAR(32) NOT NULL DEFAULT 'unverified',
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS career_preparation_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_role_id UUID REFERENCES career_target_roles(id) ON DELETE SET NULL,
  skill_id UUID REFERENCES career_skills(id) ON DELETE SET NULL,
  activity_type VARCHAR(64) NOT NULL DEFAULT 'coding_challenge',
  title VARCHAR(255) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'planned',
  duration_minutes INTEGER,
  outcome_notes TEXT,
  performance_score INTEGER,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS career_gap_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_role_id UUID NOT NULL REFERENCES career_target_roles(id) ON DELETE CASCADE,
  readiness_score INTEGER NOT NULL DEFAULT 0,
  stated_readiness VARCHAR(64) NOT NULL DEFAULT 'early_preparation',
  evidence_alignment_score INTEGER NOT NULL DEFAULT 0,
  readiness_discrepancy VARCHAR(32) NOT NULL DEFAULT 'unassessed',
  gaps JSONB NOT NULL DEFAULT '[]'::jsonb,
  strengths JSONB NOT NULL DEFAULT '[]'::jsonb,
  priorities JSONB NOT NULL DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Indexes for performance & query isolation
CREATE INDEX IF NOT EXISTS idx_career_profiles_user ON career_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_career_target_roles_user ON career_target_roles(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_target_role_skills_role ON target_role_skills(target_role_id);
CREATE INDEX IF NOT EXISTS idx_user_skills_user ON user_skills(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_evidence_user_skill ON skill_evidence(user_skill_id);
CREATE INDEX IF NOT EXISTS idx_skill_evidence_user ON skill_evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_career_prep_activities_user ON career_preparation_activities(user_id, status);
CREATE INDEX IF NOT EXISTS idx_career_gap_analyses_user ON career_gap_analyses(user_id, target_role_id);
