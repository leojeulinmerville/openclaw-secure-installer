-- 20260311000000_init_core.sql

-- Missions table
CREATE TABLE IF NOT EXISTS missions (
    mission_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    mission_mode TEXT NOT NULL DEFAULT 'autonomous',
    current_phase TEXT,
    health_state TEXT NOT NULL DEFAULT 'stable',
    governance_state TEXT NOT NULL DEFAULT 'normal',
    resume_readiness BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_resume_at TIMESTAMPTZ,
    summary_current TEXT,
    risk_level_initial TEXT,
    risk_level_current TEXT
);

-- Mission Charters table
CREATE TABLE IF NOT EXISTS mission_charters (
    charter_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(mission_id) ON DELETE CASCADE,
    intent_raw TEXT NOT NULL,
    intent_interpreted TEXT,
    goal_statement TEXT,
    constraints JSONB,
    acceptance_criteria JSONB,
    scope_statement TEXT,
    policy_profile TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
CREATE INDEX IF NOT EXISTS idx_mission_charters_mission_id ON mission_charters(mission_id);
