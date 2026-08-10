CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE app_user (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(80) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_app_user_username UNIQUE (username),
    CONSTRAINT uq_app_user_email UNIQUE (email),
    CONSTRAINT ck_app_user_username_lower CHECK (username = lower(username)),
    CONSTRAINT ck_app_user_status CHECK (status IN ('ACTIVE', 'INACTIVE', 'LOCKED')),
    CONSTRAINT ck_app_user_failed_attempts CHECK (failed_attempts >= 0)
);

CREATE TABLE role (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE user_role (
    user_id UUID NOT NULL REFERENCES app_user(id),
    role_id UUID NOT NULL REFERENCES role(id),
    assigned_by UUID REFERENCES app_user(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE seller (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES app_user(id),
    code VARCHAR(40) NOT NULL UNIQUE,
    display_name VARCHAR(150) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_seller_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE TABLE device (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_user(id),
    friendly_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    app_version VARCHAR(40),
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES app_user(id),
    CONSTRAINT ck_device_status CHECK (status IN ('PENDING', 'ACTIVE', 'REVOKED'))
);

CREATE INDEX idx_device_user_status ON device(user_id, status);

CREATE TABLE refresh_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_user(id),
    device_id UUID NOT NULL REFERENCES device(id),
    family_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    issued_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by_id UUID REFERENCES refresh_session(id),
    revoke_reason VARCHAR(100),
    CONSTRAINT ck_refresh_expiry CHECK (expires_at > issued_at)
);

CREATE INDEX idx_refresh_session_family ON refresh_session(family_id);
CREATE INDEX idx_refresh_session_user_device ON refresh_session(user_id, device_id);

CREATE TABLE file_object (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_key VARCHAR(500) NOT NULL UNIQUE,
    original_name VARCHAR(255),
    media_type VARCHAR(150) NOT NULL,
    size_bytes BIGINT NOT NULL,
    sha256 VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_by UUID REFERENCES app_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_file_size CHECK (size_bytes >= 0),
    CONSTRAINT ck_file_status CHECK (status IN ('ACTIVE', 'QUARANTINED', 'DELETED'))
);

CREATE TABLE company_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    singleton_key BOOLEAN NOT NULL DEFAULT TRUE UNIQUE,
    commercial_name VARCHAR(150) NOT NULL,
    legal_name VARCHAR(200) NOT NULL,
    tax_id VARCHAR(30) NOT NULL,
    address VARCHAR(500) NOT NULL,
    phone VARCHAR(30) NOT NULL DEFAULT '',
    whatsapp VARCHAR(30) NOT NULL DEFAULT '',
    email VARCHAR(254) NOT NULL DEFAULT '',
    logo_file_id UUID REFERENCES file_object(id),
    currency_code CHAR(3) NOT NULL DEFAULT 'GTQ',
    timezone VARCHAR(80) NOT NULL DEFAULT 'America/Guatemala',
    receipt_prefix VARCHAR(20) NOT NULL DEFAULT 'V',
    next_receipt_number BIGINT NOT NULL DEFAULT 1,
    document_legend VARCHAR(500) NOT NULL DEFAULT '',
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_company_singleton CHECK (singleton_key),
    CONSTRAINT ck_company_receipt_number CHECK (next_receipt_number > 0),
    CONSTRAINT ck_company_currency_upper CHECK (currency_code = upper(currency_code))
);

CREATE TABLE fel_configuration (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    singleton_key BOOLEAN NOT NULL DEFAULT TRUE UNIQUE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    provider_code VARCHAR(100),
    credential_secret_ref VARCHAR(500),
    environment VARCHAR(20) NOT NULL DEFAULT 'TEST',
    establishment_code VARCHAR(40),
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES app_user(id),
    CONSTRAINT ck_fel_singleton CHECK (singleton_key),
    CONSTRAINT ck_fel_environment CHECK (environment IN ('TEST', 'PRODUCTION')),
    CONSTRAINT ck_fel_activation CHECK (NOT enabled OR (provider_code IS NOT NULL AND credential_secret_ref IS NOT NULL))
);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES app_user(id),
    device_id UUID REFERENCES device(id),
    action VARCHAR(80) NOT NULL,
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID,
    before_data JSONB,
    after_data JSONB,
    correlation_id UUID NOT NULL,
    ip_address VARCHAR(64),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id, occurred_at DESC);
CREATE INDEX idx_audit_user ON audit_log(user_id, occurred_at DESC);

INSERT INTO role(code, name) VALUES
    ('ADMINISTRADOR', 'Administrador / Propietario'),
    ('BODEGA', 'Bodega'),
    ('VENDEDOR', 'Vendedor'),
    ('SUPERVISOR', 'Supervisor');
