CREATE TABLE device_reenrollment_request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_user(id),
    requested_name VARCHAR(100) NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ NOT NULL,
    approved_by UUID REFERENCES app_user(id),
    approved_at TIMESTAMPTZ,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_device_reenrollment_status CHECK (status IN ('PENDING','APPROVED','REJECTED','EXPIRED','USED'))
);
CREATE INDEX idx_device_reenrollment_pending ON device_reenrollment_request(status, expires_at);
CREATE INDEX idx_device_reenrollment_user ON device_reenrollment_request(user_id, created_at DESC);
