-- 20260317000000_sprint_1_core.sql

-- Case Files table
CREATE TABLE IF NOT EXISTS case_files (
    case_file_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(mission_id) ON DELETE CASCADE,
    summary TEXT,
    next_action TEXT,
    risk_summary TEXT,
    obligation_summary TEXT,
    continuity_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Contracts table
CREATE TABLE IF NOT EXISTS contracts (
    contract_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(mission_id) ON DELETE CASCADE,
    contract_type TEXT NOT NULL,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    health_state TEXT NOT NULL DEFAULT 'stable',
    governance_state TEXT NOT NULL DEFAULT 'normal',
    assigned_role TEXT,
    spec_raw TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Artifacts table
CREATE TABLE IF NOT EXISTS artifacts (
    artifact_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(mission_id) ON DELETE CASCADE,
    origin_contract_id UUID REFERENCES contracts(contract_id) ON DELETE SET NULL,
    artifact_type TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    promotion_state TEXT NOT NULL DEFAULT 'candidate',
    storage_path TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Decision Records table
CREATE TABLE IF NOT EXISTS decision_records (
    decision_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(mission_id) ON DELETE CASCADE,
    decision_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    outcome TEXT,
    responsibility_tag TEXT,
    rationale TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Validation Records table
CREATE TABLE IF NOT EXISTS validation_records (
    validation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(mission_id) ON DELETE CASCADE,
    validation_scope TEXT NOT NULL,
    outcome TEXT NOT NULL,
    summary TEXT,
    responsibility_tag TEXT,
    evidence_links JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Resume Snapshots table
CREATE TABLE IF NOT EXISTS resume_snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(mission_id) ON DELETE CASCADE,
    snapshot_summary TEXT NOT NULL,
    recommended_resume_mode TEXT,
    next_action_suggestion TEXT,
    state_blob JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Mission State Projections table
CREATE TABLE IF NOT EXISTS mission_state_projections (
    projection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(mission_id) ON DELETE CASCADE UNIQUE,
    phase TEXT,
    status TEXT,
    health TEXT,
    governance TEXT,
    focus TEXT,
    blocker_risk TEXT,
    resume_readiness BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_case_files_mission_id ON case_files(mission_id);
CREATE INDEX IF NOT EXISTS idx_contracts_mission_id ON contracts(mission_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_mission_id ON artifacts(mission_id);
CREATE INDEX IF NOT EXISTS idx_decision_records_mission_id ON decision_records(mission_id);
CREATE INDEX IF NOT EXISTS idx_validation_records_mission_id ON validation_records(mission_id);
CREATE INDEX IF NOT EXISTS idx_resume_snapshots_mission_id ON resume_snapshots(mission_id);
