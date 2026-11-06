-- Migration 0002: Create character archetypes and user personalization tables

-- 1. Create character_archetypes table
CREATE TABLE IF NOT EXISTS character_archetypes (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    tagline VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    default_warmth INTEGER NOT NULL CHECK (default_warmth >= 1 AND default_warmth <= 100),
    default_directness INTEGER NOT NULL CHECK (default_directness >= 1 AND default_directness <= 100),
    default_humor INTEGER NOT NULL CHECK (default_humor >= 1 AND default_humor <= 100),
    default_challenge_level INTEGER NOT NULL CHECK (default_challenge_level >= 1 AND default_challenge_level <= 100),
    default_proactivity VARCHAR(20) NOT NULL CHECK (default_proactivity IN ('low', 'medium', 'high')),
    default_response_length VARCHAR(20) NOT NULL CHECK (default_response_length IN ('concise', 'balanced', 'thorough')),
    sample_dialogue JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Seed initial 4 predefined archetypes
INSERT INTO character_archetypes (
    id, name, tagline, description, default_warmth, default_directness, 
    default_humor, default_challenge_level, default_proactivity, 
    default_response_length, sample_dialogue, sort_order
) VALUES 
(
    'niva_anchor',
    'The Balanced Anchor',
    'Grounded, thoughtful, and context-aware continuity.',
    'Balanced empathy and structured thinking. Acts as an enduring, stable counterpart through demanding semesters and stressful deadlines.',
    75, 65, 50, 60, 'medium', 'balanced',
    '[{"user": "I am feeling overwhelmed with my placement prep and semester exams.", "companion": "Let us pause and sequence this. Exams are immediate, but placement prep can be sustained with 30 focused minutes of problem solving a day. We will protect that 30-minute block and park the rest for now."}]'::jsonb,
    1
),
(
    'niva_strategist',
    'The Focused Strategist',
    'High-rigor, analytical coach focused on execution and mastery.',
    'Razor-sharp directness, high expectations, zero fluff. Evaluates edge cases, cuts through excuses, and insists on measurable progress.',
    35, 95, 25, 90, 'high', 'concise',
    '[{"user": "My sorting code passed 8 out of 10 test cases.", "companion": "The remaining two are edge cases—likely integer overflow or duplicate keys. Inspect your boundary conditions and tell me how your pivot handles equal elements."}]'::jsonb,
    2
),
(
    'niva_guide',
    'The Calm Guide',
    'Empathetic, low-pressure clarity and cognitive space.',
    'Deep listener, patient and unhurried. Excellent for managing imposter syndrome, untangling complex architectural decisions, and finding equilibrium under pressure.',
    90, 45, 40, 40, 'low', 'thorough',
    '[{"user": "I feel like I am falling behind everyone else in my batch.", "companion": "Comparison amplifies noise and obscures your actual trajectory. Let us look at what you mastered this week: your concurrency understanding is demonstrably stronger than it was ten days ago. Growth is compounding, not theatrical."}]'::jsonb,
    3
),
(
    'niva_catalyst',
    'The Energetic Catalyst',
    'Proactive spark, bias towards action, celebrating momentum.',
    'Vibrant, stimulating, action-oriented. Drives forward motion, keeps energy high during late-night build sessions, and turns ambiguity into immediate next steps.',
    65, 75, 75, 70, 'high', 'concise',
    '[{"user": "I am stuck deciding between PostgreSQL and MongoDB for this feature.", "companion": "Your domain has strict foreign keys and transactional guarantees. PostgreSQL is the obvious choice here—let us spin up the schema and get building!"}]'::jsonb,
    4
)
ON CONFLICT (id) DO NOTHING;

-- 3. Create user_personalization table
CREATE TABLE IF NOT EXISTS user_personalization (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    preferred_name VARCHAR(100),
    occupation_role VARCHAR(100),
    primary_focus VARCHAR(50),
    selected_archetype_id VARCHAR(50) NOT NULL REFERENCES character_archetypes(id) DEFAULT 'niva_anchor',
    warmth INTEGER NOT NULL DEFAULT 75 CHECK (warmth >= 1 AND warmth <= 100),
    directness INTEGER NOT NULL DEFAULT 65 CHECK (directness >= 1 AND directness <= 100),
    humor INTEGER NOT NULL DEFAULT 50 CHECK (humor >= 1 AND humor <= 100),
    challenge_level INTEGER NOT NULL DEFAULT 60 CHECK (challenge_level >= 1 AND challenge_level <= 100),
    proactivity VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (proactivity IN ('low', 'medium', 'high')),
    response_length VARCHAR(20) NOT NULL DEFAULT 'balanced' CHECK (response_length IN ('concise', 'balanced', 'thorough')),
    onboarding_completed BOOLEAN NOT NULL DEFAULT false,
    onboarding_step VARCHAR(50) NOT NULL DEFAULT 'identity',
    onboarded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for instant user personal lookup
CREATE INDEX IF NOT EXISTS idx_user_personalization_user_id ON user_personalization(user_id);
