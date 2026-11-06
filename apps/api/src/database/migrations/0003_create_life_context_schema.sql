-- Migration 0003: Create life context foundation tables (goals, projects, tasks, commitments, ideas)

-- 1. Create life_goals table
CREATE TABLE IF NOT EXISTS life_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(64) NOT NULL CHECK (category IN ('career', 'technical', 'academic', 'personal', 'health')),
    target_date DATE,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'abandoned')),
    priority VARCHAR(32) NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    progress_percentage INTEGER NOT NULL DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_life_goals_user_status ON life_goals(user_id, status);

-- 2. Create life_projects table
CREATE TABLE IF NOT EXISTS life_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id UUID REFERENCES life_goals(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'in_progress' CHECK (status IN ('planning', 'in_progress', 'on_hold', 'completed', 'archived')),
    color VARCHAR(32),
    start_date DATE,
    target_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_life_projects_user_goal ON life_projects(user_id, goal_id);

-- 3. Create life_tasks table
CREATE TABLE IF NOT EXISTS life_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES life_projects(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed', 'cancelled')),
    priority VARCHAR(32) NOT NULL DEFAULT 'medium' CHECK (priority IN ('urgent', 'high', 'medium', 'low')),
    due_date TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_life_tasks_user_status_due ON life_tasks(user_id, status, due_date);

-- 4. Create life_commitments table
CREATE TABLE IF NOT EXISTS life_commitments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    commitment_type VARCHAR(64) NOT NULL CHECK (commitment_type IN ('interview', 'exam', 'deadline', 'meeting', 'habit_routine')),
    due_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'fulfilled', 'missed', 'rescheduled')),
    importance VARCHAR(32) NOT NULL DEFAULT 'standard' CHECK (importance IN ('critical', 'high', 'standard')),
    related_goal_id UUID REFERENCES life_goals(id) ON DELETE SET NULL,
    related_project_id UUID REFERENCES life_projects(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_life_commitments_user_due ON life_commitments(user_id, due_at, status);

-- 5. Create life_ideas table
CREATE TABLE IF NOT EXISTS life_ideas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'raw' CHECK (status IN ('raw', 'incubating', 'promoted', 'archived')),
    promoted_to_project_id UUID REFERENCES life_projects(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_life_ideas_user_status ON life_ideas(user_id, status);
