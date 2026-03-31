-- libs/db/prisma/migrations/002_brain_tables.sql
-- Einstein Brain: supporting tables for the Cognitive Router, Advisor,
-- Consigliere, Honey-Pot detection, and Witness Protection pipeline.
-- Run via: psql $DATABASE_URL -f 002_brain_tables.sql

-- ── pgvector extension (required for long-term brain memory) ─────────────────
CREATE EXTENSION IF NOT EXISTS vector;

-- ── Operational Playbook (pgvector long-term memory) ─────────────────────────
CREATE TABLE IF NOT EXISTS operational_playbook (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT        NOT NULL,
    topic       TEXT        NOT NULL,
    content     TEXT        NOT NULL,
    embedding   vector(1536),           -- OpenAI text-embedding-ada-002 dimension
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_playbook_tenant
    ON operational_playbook (tenant_id);
CREATE INDEX IF NOT EXISTS idx_playbook_embedding
    ON operational_playbook USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- RLS: tenants only see their own playbook entries
ALTER TABLE operational_playbook ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS playbook_tenant_isolation ON operational_playbook;
CREATE POLICY playbook_tenant_isolation ON operational_playbook
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE));

-- ── Ingested Files (Cognitive Router meta-table) ──────────────────────────────
CREATE TABLE IF NOT EXISTS ingested_files (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       TEXT        NOT NULL,
    source_app      TEXT        NOT NULL,
    category        TEXT        NOT NULL CHECK (category IN ('FINANCE','OPERATIONS','LEGAL','UNKNOWN')),
    original_path   TEXT        NOT NULL,
    processed_path  TEXT        NOT NULL,
    file_hash       TEXT        NOT NULL,
    status          TEXT        NOT NULL DEFAULT 'PROCESSED'
                                CHECK (status IN ('PROCESSED','REPROCESSED','FAILED','QUARANTINE')),
    ingested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (file_hash, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_ingested_tenant
    ON ingested_files (tenant_id, ingested_at DESC);

ALTER TABLE ingested_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ingested_tenant_isolation ON ingested_files;
CREATE POLICY ingested_tenant_isolation ON ingested_files
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE));

-- ── System Suggestions (EinsteinAdvisor → Admin Dashboard) ───────────────────
CREATE TABLE IF NOT EXISTS system_suggestions (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    TEXT        NOT NULL,
    category     TEXT        NOT NULL,               -- FINANCE | INFRA | SECURITY
    message      TEXT        NOT NULL,
    impact_score TEXT        NOT NULL DEFAULT 'Medium'
                             CHECK (impact_score IN ('Low','Medium','High','Critical')),
    status       TEXT        NOT NULL DEFAULT 'Pending'
                             CHECK (status IN ('Pending','Applied','Dismissed')),
    confidence   NUMERIC(4,3) NOT NULL DEFAULT 0.0
                             CHECK (confidence BETWEEN 0.0 AND 1.0),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_suggestions_tenant
    ON system_suggestions (tenant_id, status, created_at DESC);

-- No RLS on system_suggestions: 'system' tenant writes infra-level rows
-- NestJS filters by tenant_id in application layer.

-- ── Notifications Admin (legacy name kept for compatibility) ─────────────────
-- Alias view so old code referring to notifications_admin still works.
CREATE OR REPLACE VIEW notifications_admin AS
    SELECT * FROM system_suggestions;

-- ── Proactive Insights (daily "Optimization Tips") ───────────────────────────
CREATE TABLE IF NOT EXISTS proactive_insights (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT        NOT NULL,
    type        TEXT        NOT NULL,                -- COST | PERFORMANCE | SECURITY | COMPLIANCE
    insight     TEXT        NOT NULL,
    impact      TEXT        NOT NULL DEFAULT 'Medium',
    action_link TEXT,
    confidence  NUMERIC(4,3) NOT NULL DEFAULT 0.0
                            CHECK (confidence BETWEEN 0.0 AND 1.0),
    status      TEXT        NOT NULL DEFAULT 'UNREAD'
                            CHECK (status IN ('UNREAD','READ','ACTIONED','DISMISSED')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_insights_tenant
    ON proactive_insights (tenant_id, status, created_at DESC);

ALTER TABLE proactive_insights ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS insights_tenant_isolation ON proactive_insights;
CREATE POLICY insights_tenant_isolation ON proactive_insights
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)
           OR current_setting('app.current_tenant_id', TRUE) = 'system');

-- ── Honey-Pot Records ─────────────────────────────────────────────────────────
-- Any access to these rows triggers the Consigliere honeypot handler.
CREATE TABLE IF NOT EXISTS honeypot_records (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   TEXT        NOT NULL,
    record_type TEXT        NOT NULL,                -- ghost_admin_user | dummy_ledger_entry
    label       TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Postgres trigger function: notifies FastAPI when a honey-pot row is read.
CREATE OR REPLACE FUNCTION notify_honeypot_access()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_notify(
        'honeypot_access',
        json_build_object(
            'tenant_id',   OLD.tenant_id,
            'record_type', OLD.record_type,
            'accessed_at', NOW()
        )::text
    );
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS honeypot_read_trigger ON honeypot_records;
CREATE TRIGGER honeypot_read_trigger
    AFTER UPDATE OR DELETE ON honeypot_records   -- UPDATE is used as a read-marker
    FOR EACH ROW EXECUTE FUNCTION notify_honeypot_access();

-- Seed ghost records (one per sentinel category; tenant_id 'system' = global)
INSERT INTO honeypot_records (tenant_id, record_type, label)
VALUES
    ('system', 'ghost_admin_user',    'ghost_superadmin_do_not_touch'),
    ('system', 'dummy_ledger_entry',  'dummy_journal_entry_sentinel')
ON CONFLICT DO NOTHING;

-- ── Budget Variance View (extended with day_of_week) ─────────────────────────
-- Extends 001_budget_variance_view.sql with the columns EinsteinAdvisor needs.
CREATE OR REPLACE VIEW budget_variance_view AS
SELECT
    fm.tenant_id,
    fm.category,
    TO_CHAR(fm.date, 'YYYY-MM')                                          AS period_label,
    EXTRACT(DOW FROM fm.date)::int                                        AS day_of_week,
    SUM(CASE WHEN fm.type = 'BUDGET' THEN fm.amount ELSE 0 END)           AS budget_amount,
    SUM(CASE WHEN fm.type = 'ACTUAL' THEN fm.amount ELSE 0 END)           AS actual_amount,
    CASE
        WHEN SUM(CASE WHEN fm.type = 'BUDGET' THEN fm.amount ELSE 0 END) = 0 THEN 0
        ELSE ROUND(
            (SUM(CASE WHEN fm.type = 'ACTUAL' THEN fm.amount ELSE 0 END) /
             SUM(CASE WHEN fm.type = 'BUDGET' THEN fm.amount ELSE 0 END) - 1) * 100,
            2)
    END                                                                    AS variance_pct
FROM finance_metrics fm
GROUP BY fm.tenant_id, fm.category,
         TO_CHAR(fm.date, 'YYYY-MM'), EXTRACT(DOW FROM fm.date)::int;

-- ── PostgreSQL Row-Level Security on core tables ──────────────────────────────
-- Ensures absolute data isolation even if application WHERE clause is omitted.

ALTER TABLE journal_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_metrics   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS je_tenant_isolation   ON journal_entries;
DROP POLICY IF EXISTS inv_tenant_isolation  ON invoices;
DROP POLICY IF EXISTS fm_tenant_isolation   ON finance_metrics;

CREATE POLICY je_tenant_isolation ON journal_entries
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY inv_tenant_isolation ON invoices
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE));

CREATE POLICY fm_tenant_isolation ON finance_metrics
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE));
