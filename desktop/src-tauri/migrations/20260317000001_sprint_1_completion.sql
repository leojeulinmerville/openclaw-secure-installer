-- 20260317000001_sprint_1_completion.sql

-- Responsibility Ledger Entries table
CREATE TABLE IF NOT EXISTS responsibility_ledger_entries (
    entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mission_id UUID NOT NULL REFERENCES missions(mission_id) ON DELETE CASCADE,
    subject_type TEXT NOT NULL, -- e.g., 'decision', 'action', 'contract'
    subject_id UUID,
    responsibility_tag TEXT NOT NULL,
    description TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enrich Mission State Projections table
ALTER TABLE mission_state_projections 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS mode TEXT,
ADD COLUMN IF NOT EXISTS health_state TEXT,
ADD COLUMN IF NOT EXISTS governance_state TEXT,
ADD COLUMN IF NOT EXISTS reference_path TEXT,
ADD COLUMN IF NOT EXISTS top_blocker TEXT,
ADD COLUMN IF NOT EXISTS top_risk TEXT,
ADD COLUMN IF NOT EXISTS active_contract_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_decision_summary TEXT,
ADD COLUMN IF NOT EXISTS last_validation_summary TEXT,
ADD COLUMN IF NOT EXISTS needs_human_attention BOOLEAN DEFAULT FALSE;

-- Indices
CREATE INDEX IF NOT EXISTS idx_ledger_mission_id ON responsibility_ledger_entries(mission_id);
