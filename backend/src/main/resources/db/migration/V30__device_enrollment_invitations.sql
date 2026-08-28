CREATE TABLE device_enrollment_invitation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_user(id),
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_by UUID NOT NULL REFERENCES app_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    CONSTRAINT ck_device_enrollment_status CHECK (status IN ('PENDING', 'COMPLETED', 'REVOKED', 'EXPIRED')),
    CONSTRAINT ck_device_enrollment_expiry CHECK (expires_at > created_at)
);

CREATE INDEX idx_device_enrollment_user_status ON device_enrollment_invitation(user_id, status);
CREATE INDEX idx_device_enrollment_expiry ON device_enrollment_invitation(status, expires_at);
