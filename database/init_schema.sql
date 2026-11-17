\set ON_ERROR_STOP on

\if :{?pulse_app_password}
\else
\set pulse_app_password 'pulse_dev_password'
\endif

CREATE EXTENSION IF NOT EXISTS pgcrypto;

SELECT format(
    'CREATE ROLE pulse_app LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT',
    :'pulse_app_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'pulse_app')
\gexec

CREATE OR REPLACE FUNCTION pulse_current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
    SELECT NULLIF(current_setting('app.tenant_id', true), '')::uuid
$$;

CREATE TABLE IF NOT EXISTS tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name varchar(160) NOT NULL,
    slug varchar(80) NOT NULL UNIQUE,
    plan varchar(40) NOT NULL DEFAULT 'pilot',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email varchar(320) NOT NULL,
    full_name varchar(160) NOT NULL,
    password_hash text NOT NULL,
    role varchar(32) NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'analyst', 'operator', 'viewer')),
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email)
);

CREATE TABLE IF NOT EXISTS counties (
    id uuid PRIMARY KEY,
    code smallint NOT NULL UNIQUE CHECK (code BETWEEN 1 AND 47),
    name varchar(100) NOT NULL UNIQUE,
    slug varchar(100) NOT NULL UNIQUE,
    centroid_lat double precision,
    centroid_lng double precision
);

CREATE TABLE IF NOT EXISTS constituencies (
    id uuid PRIMARY KEY,
    county_id uuid NOT NULL REFERENCES counties(id) ON DELETE RESTRICT,
    code smallint NOT NULL UNIQUE CHECK (code BETWEEN 1 AND 290),
    name varchar(120) NOT NULL,
    slug varchar(120) NOT NULL,
    CONSTRAINT uq_constituencies_county_name UNIQUE (county_id, name)
);

CREATE INDEX IF NOT EXISTS ix_constituencies_county_id ON constituencies(county_id);

CREATE TABLE IF NOT EXISTS wards (
    id uuid PRIMARY KEY,
    constituency_id uuid NOT NULL REFERENCES constituencies(id) ON DELETE RESTRICT,
    code smallint NOT NULL UNIQUE CHECK (code BETWEEN 1 AND 1450),
    name varchar(140) NOT NULL,
    slug varchar(140) NOT NULL,
    CONSTRAINT uq_wards_constituency_name UNIQUE (constituency_id, name)
);

CREATE INDEX IF NOT EXISTS ix_wards_constituency_id ON wards(constituency_id);

CREATE TABLE IF NOT EXISTS mentions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    county_id uuid REFERENCES counties(id) ON DELETE SET NULL,
    constituency_id uuid REFERENCES constituencies(id) ON DELETE SET NULL,
    ward_id uuid REFERENCES wards(id) ON DELETE SET NULL,
    source varchar(32) NOT NULL CHECK (source IN ('x', 'tiktok', 'facebook', 'news', 'radio', 'cati', 'unknown')),
    external_id varchar(200),
    author_handle varchar(160),
    text text NOT NULL,
    language varchar(16) NOT NULL DEFAULT 'en',
    sheng_detected boolean NOT NULL DEFAULT false,
    engagement_count integer NOT NULL DEFAULT 0 CHECK (engagement_count >= 0),
    collected_at timestamptz NOT NULL DEFAULT now(),
    raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ix_mentions_tenant_collected ON mentions(tenant_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS ix_mentions_tenant_county_collected ON mentions(tenant_id, county_id, collected_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_mentions_tenant_source_external
    ON mentions(tenant_id, source, external_id) WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sentiment_scores (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    mention_id uuid NOT NULL REFERENCES mentions(id) ON DELETE CASCADE,
    issue_axis varchar(48) NOT NULL CHECK (issue_axis IN (
        'economy', 'healthcare', 'infrastructure', 'corruption', 'education',
        'youth_employment', 'security', 'local_leadership', 'agriculture'
    )),
    score double precision NOT NULL CHECK (score BETWEEN -1 AND 1),
    confidence double precision NOT NULL CHECK (confidence BETWEEN 0 AND 1),
    model_version varchar(64) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_sentiment_mention_axis UNIQUE (mention_id, issue_axis)
);

CREATE INDEX IF NOT EXISTS ix_sentiment_scores_tenant_id ON sentiment_scores(tenant_id);
CREATE INDEX IF NOT EXISTS ix_sentiment_scores_mention_id ON sentiment_scores(mention_id);

CREATE TABLE IF NOT EXISTS bot_clusters (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    county_id uuid REFERENCES counties(id) ON DELETE SET NULL,
    label varchar(180) NOT NULL,
    narrative text NOT NULL,
    coordination_score double precision NOT NULL CHECK (coordination_score BETWEEN 0 AND 1),
    threat_level smallint NOT NULL CHECK (threat_level BETWEEN 1 AND 4),
    account_count integer NOT NULL DEFAULT 0 CHECK (account_count >= 0),
    evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_bot_clusters_tenant_id ON bot_clusters(tenant_id);

CREATE TABLE IF NOT EXISTS alerts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    county_id uuid REFERENCES counties(id) ON DELETE SET NULL,
    bot_cluster_id uuid REFERENCES bot_clusters(id) ON DELETE SET NULL,
    severity smallint NOT NULL CHECK (severity BETWEEN 1 AND 4),
    category varchar(64) NOT NULL,
    title varchar(240) NOT NULL,
    narrative text NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
    playbook jsonb NOT NULL DEFAULT '[]'::jsonb,
    acknowledged_by uuid REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at timestamptz,
    resolved_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_alerts_tenant_status_created ON alerts(tenant_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS voice_polls (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    county_id uuid REFERENCES counties(id) ON DELETE SET NULL,
    name varchar(180) NOT NULL,
    status varchar(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'complete')),
    target_sample integer NOT NULL CHECK (target_sample > 0),
    completed integer NOT NULL DEFAULT 0 CHECK (completed >= 0),
    calls_attempted integer NOT NULL DEFAULT 0 CHECK (calls_attempted >= 0),
    active_agents integer NOT NULL DEFAULT 0 CHECK (active_agents >= 0),
    average_handle_seconds integer NOT NULL DEFAULT 0 CHECK (average_handle_seconds >= 0),
    quotas jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_voice_polls_tenant_id ON voice_polls(tenant_id);

CREATE TABLE IF NOT EXISTS survey_responses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    poll_id uuid NOT NULL REFERENCES voice_polls(id) ON DELETE CASCADE,
    county_id uuid REFERENCES counties(id) ON DELETE SET NULL,
    ward_id uuid REFERENCES wards(id) ON DELETE SET NULL,
    respondent_hash varchar(128) NOT NULL,
    answers jsonb NOT NULL,
    weight double precision NOT NULL DEFAULT 1.0 CHECK (weight > 0),
    completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_survey_responses_tenant_poll ON survey_responses(tenant_id, poll_id);

CREATE OR REPLACE FUNCTION pulse_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END
$$;

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['tenants', 'users', 'bot_clusters', 'alerts', 'voice_polls']
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON %I', table_name, table_name);
        EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION pulse_touch_updated_at()',
            table_name,
            table_name
        );
    END LOOP;
END
$$;

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'users', 'mentions', 'sentiment_scores', 'bot_clusters', 'alerts', 'voice_polls', 'survey_responses'
    ]
    LOOP
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', table_name);
        EXECUTE format(
            'CREATE POLICY tenant_isolation ON %I USING (tenant_id = pulse_current_tenant_id()) WITH CHECK (tenant_id = pulse_current_tenant_id())',
            table_name
        );
    END LOOP;
END
$$;

INSERT INTO tenants (id, name, slug, plan)
VALUES ('10000000-0000-4000-8000-000000000001', 'Pulse Kenya Demo', 'demo', 'enterprise-demo')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug, plan = EXCLUDED.plan;

SELECT set_config('app.tenant_id', '10000000-0000-4000-8000-000000000001', false);

INSERT INTO users (id, tenant_id, email, full_name, password_hash, role)
VALUES (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'demo@pulse.ke',
    'Pulse Demo Operator',
    'pbkdf2_sha256$390000$cHVsc2UtZGVtby1zYWx0IQ$ayUJ5vusEHqfWkvfwVEPuR7Ss5mTksQPAHteQ5P2kA8',
    'admin'
)
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role;

INSERT INTO voice_polls (
    id, tenant_id, name, status, target_sample, completed, calls_attempted,
    active_agents, average_handle_seconds, quotas
)
VALUES (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'National Issues Pulse — November 2026',
    'active', 2400, 1386, 2841, 38, 267,
    '{"age_18_24":{"target":420,"complete":348},"age_25_34":{"target":620,"complete":401},"women":{"target":1200,"complete":692},"rural":{"target":1440,"complete":811}}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
    completed = EXCLUDED.completed,
    calls_attempted = EXCLUDED.calls_attempted,
    active_agents = EXCLUDED.active_agents,
    quotas = EXCLUDED.quotas;

RESET app.tenant_id;

DO $$
BEGIN
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO pulse_app', current_database());
END
$$;
GRANT USAGE ON SCHEMA public TO pulse_app;
GRANT SELECT ON tenants, counties, constituencies, wards TO pulse_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON users, mentions, sentiment_scores, bot_clusters, alerts, voice_polls, survey_responses TO pulse_app;
ALTER ROLE pulse_app SET statement_timeout = '30s';

