-- migrate: connect_profiles table
CREATE TABLE IF NOT EXISTS app.connect_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(64)  NOT NULL,
    display_name            VARCHAR(120) NOT NULL,
    description             VARCHAR(255) NOT NULL DEFAULT '',
    is_default              BOOLEAN      NOT NULL DEFAULT FALSE,
    bandwidth_up_kbps       INT          NOT NULL DEFAULT 0,
    bandwidth_down_kbps     INT          NOT NULL DEFAULT 0,
    session_timeout_seconds INT          NOT NULL DEFAULT 3600,
    voucher_ttl_seconds     INT          NOT NULL DEFAULT 300,
    is_active               BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    deleted_at              TIMESTAMPTZ,
    CONSTRAINT connect_profiles_name_uq UNIQUE (name)
);

-- Tambah kolom ke portal_sessions
ALTER TABLE app.portal_sessions
    ADD COLUMN IF NOT EXISTS survey_email   VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS survey_phone   VARCHAR(32)  NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS survey_skipped BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS profile_id     UUID REFERENCES app.connect_profiles(id);

CREATE INDEX IF NOT EXISTS idx_portal_sessions_profile_id ON app.portal_sessions(profile_id);

-- Tambah kolom ke vouchers
ALTER TABLE radius.vouchers
    ADD COLUMN IF NOT EXISTS profile_id           UUID REFERENCES app.connect_profiles(id),
    ADD COLUMN IF NOT EXISTS bandwidth_up_kbps    INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS bandwidth_down_kbps  INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_vouchers_profile_id ON radius.vouchers(profile_id);

-- Seed dua profile default
INSERT INTO app.connect_profiles (id, name, display_name, description, is_default, bandwidth_up_kbps, bandwidth_down_kbps, session_timeout_seconds, voucher_ttl_seconds, is_active)
VALUES
    (gen_random_uuid(), 'basic',   'Basic',   'User yang skip survey. Bandwidth terbatas.',    TRUE,  512,  1024, 1800, 300, TRUE),
    (gen_random_uuid(), 'premium', 'Premium', 'User yang isi survey. Bandwidth lebih tinggi.', FALSE, 2048, 5120, 7200, 300, TRUE)
ON CONFLICT (name) DO NOTHING;
