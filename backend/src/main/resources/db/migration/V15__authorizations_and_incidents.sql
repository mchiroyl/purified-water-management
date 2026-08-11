CREATE TABLE authorization_request (
    id UUID PRIMARY KEY,
    authorization_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(40) NOT NULL,
    entity_id UUID NOT NULL,
    requested_by UUID NOT NULL REFERENCES app_user(id),
    requested_device_id UUID NOT NULL REFERENCES device(id),
    reason VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    expires_at TIMESTAMPTZ NOT NULL,
    decided_by UUID REFERENCES app_user(id),
    decided_device_id UUID REFERENCES device(id),
    decision_notes VARCHAR(500) NOT NULL DEFAULT '',
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_authorization_type CHECK (authorization_type IN (
        'LOAD_CORRECTION','SETTLEMENT_DIFFERENCE','CREDIT_LIMIT_CHANGE','OTHER_OPERATION'
    )),
    CONSTRAINT ck_authorization_entity CHECK (entity_type IN ('ROUTE_LOAD','SETTLEMENT','CUSTOMER','SALE')),
    CONSTRAINT ck_authorization_status CHECK (status IN ('REQUESTED','APPROVED','REJECTED','EXPIRED')),
    CONSTRAINT ck_authorization_reason CHECK (length(trim(reason))>0),
    CONSTRAINT ck_authorization_expiry CHECK (expires_at>created_at AND expires_at<=created_at+interval '7 days'),
    CONSTRAINT ck_authorization_decision CHECK (
        (status='REQUESTED' AND decided_by IS NULL AND decided_device_id IS NULL AND decided_at IS NULL AND decision_notes='')
        OR (status IN ('APPROVED','REJECTED') AND decided_by IS NOT NULL AND decided_device_id IS NOT NULL
            AND decided_at IS NOT NULL AND length(trim(decision_notes))>0 AND decided_by<>requested_by)
        OR (status='EXPIRED' AND decided_by IS NULL AND decided_device_id IS NULL AND decided_at IS NULL AND decision_notes='')
    )
);

CREATE TABLE incident (
    id UUID PRIMARY KEY,
    route_id UUID REFERENCES route(id),
    settlement_id UUID REFERENCES settlement(id),
    reference_type VARCHAR(40),
    reference_id UUID,
    incident_type VARCHAR(40) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    description VARCHAR(1000) NOT NULL,
    reported_by UUID NOT NULL REFERENCES app_user(id),
    reported_device_id UUID NOT NULL REFERENCES device(id),
    handled_by UUID REFERENCES app_user(id),
    handled_device_id UUID REFERENCES device(id),
    resolution_notes VARCHAR(1000) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    handled_at TIMESTAMPTZ,
    CONSTRAINT ck_incident_type CHECK (incident_type IN (
        'CASH_DIFFERENCE','PHYSICAL_DIFFERENCE','INVENTORY','ROUTE','CUSTOMER','DEVICE','OTHER'
    )),
    CONSTRAINT ck_incident_severity CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
    CONSTRAINT ck_incident_status CHECK (status IN ('OPEN','INVESTIGATING','RESOLVED','DISMISSED')),
    CONSTRAINT ck_incident_reference CHECK ((reference_type IS NULL)=(reference_id IS NULL)),
    CONSTRAINT ck_incident_description CHECK (length(trim(description))>0),
    CONSTRAINT ck_incident_handling CHECK (
        (status='OPEN' AND handled_by IS NULL AND handled_device_id IS NULL AND handled_at IS NULL AND resolution_notes='')
        OR (status='INVESTIGATING' AND handled_by IS NOT NULL AND handled_device_id IS NOT NULL
            AND handled_at IS NOT NULL AND handled_by<>reported_by)
        OR (status IN ('RESOLVED','DISMISSED') AND handled_by IS NOT NULL AND handled_device_id IS NOT NULL
            AND handled_at IS NOT NULL AND handled_by<>reported_by AND length(trim(resolution_notes))>0)
    )
);

CREATE INDEX idx_authorization_status_expiry ON authorization_request(status,expires_at);
CREATE INDEX idx_authorization_requester_date ON authorization_request(requested_by,created_at DESC);
CREATE INDEX idx_authorization_entity ON authorization_request(entity_type,entity_id,created_at DESC);
CREATE INDEX idx_incident_status_severity ON incident(status,severity,created_at DESC);
CREATE INDEX idx_incident_route_date ON incident(route_id,created_at DESC) WHERE route_id IS NOT NULL;

CREATE OR REPLACE FUNCTION protect_authorization_request() RETURNS trigger AS $$
BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'authorization requests cannot be deleted' USING ERRCODE='55000'; END IF;
    IF (NEW.id,NEW.authorization_type,NEW.entity_type,NEW.entity_id,NEW.requested_by,
        NEW.requested_device_id,NEW.reason,NEW.expires_at,NEW.created_at)
       IS DISTINCT FROM
       (OLD.id,OLD.authorization_type,OLD.entity_type,OLD.entity_id,OLD.requested_by,
        OLD.requested_device_id,OLD.reason,OLD.expires_at,OLD.created_at) THEN
        RAISE EXCEPTION 'authorization request core is immutable' USING ERRCODE='55000';
    END IF;
    IF OLD.status<>'REQUESTED' THEN RAISE EXCEPTION 'authorization decision is final' USING ERRCODE='55000'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_incident() RETURNS trigger AS $$
BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'incidents cannot be deleted' USING ERRCODE='55000'; END IF;
    IF (NEW.id,NEW.route_id,NEW.settlement_id,NEW.reference_type,NEW.reference_id,NEW.incident_type,
        NEW.severity,NEW.description,NEW.reported_by,NEW.reported_device_id,NEW.created_at)
       IS DISTINCT FROM
       (OLD.id,OLD.route_id,OLD.settlement_id,OLD.reference_type,OLD.reference_id,OLD.incident_type,
        OLD.severity,OLD.description,OLD.reported_by,OLD.reported_device_id,OLD.created_at) THEN
        RAISE EXCEPTION 'incident report core is immutable' USING ERRCODE='55000';
    END IF;
    IF OLD.status IN ('RESOLVED','DISMISSED') THEN RAISE EXCEPTION 'incident resolution is final' USING ERRCODE='55000'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_authorization_protected BEFORE UPDATE OR DELETE ON authorization_request
FOR EACH ROW EXECUTE FUNCTION protect_authorization_request();
CREATE TRIGGER trg_incident_protected BEFORE UPDATE OR DELETE ON incident
FOR EACH ROW EXECUTE FUNCTION protect_incident();
