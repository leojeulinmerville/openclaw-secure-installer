-- 20260317000002_sprint_2_bridge.sql

-- Run Linkages table
CREATE TABLE IF NOT EXISTS run_linkages (
    run_id TEXT PRIMARY KEY, -- The existing UUID-as-string from meta.json
    mission_id UUID NOT NULL REFERENCES missions(mission_id) ON DELETE CASCADE,
    contract_id UUID NOT NULL REFERENCES contracts(contract_id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'queued',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_run_linkages_mission_id ON run_linkages(mission_id);
CREATE INDEX IF NOT EXISTS idx_run_linkages_contract_id ON run_linkages(contract_id);
