CREATE TABLE waste_type (
    id UUID PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    evidence_policy VARCHAR(20) NOT NULL,
    warehouse_approval_limit_base_units NUMERIC(18,4) NOT NULL,
    supervisor_approval_limit_base_units NUMERIC(18,4) NOT NULL,
    daily_alert_threshold INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_waste_type_code CHECK (code=upper(code)),
    CONSTRAINT ck_waste_type_evidence CHECK (evidence_policy IN ('REQUIRED','RECOMMENDED','NONE')),
    CONSTRAINT ck_waste_type_limits CHECK (
        warehouse_approval_limit_base_units>=0
        AND supervisor_approval_limit_base_units>=warehouse_approval_limit_base_units
        AND daily_alert_threshold>0
    )
);

CREATE TABLE waste (
    id UUID PRIMARY KEY,
    client_reference UUID NOT NULL,
    route_id UUID NOT NULL REFERENCES route(id),
    inventory_location_id UUID NOT NULL REFERENCES inventory_location(id),
    seller_id UUID NOT NULL REFERENCES seller(id),
    reported_by UUID NOT NULL REFERENCES app_user(id),
    device_id UUID NOT NULL REFERENCES device(id),
    status VARCHAR(40) NOT NULL DEFAULT 'PENDING_REVIEW',
    required_role VARCHAR(40),
    reason VARCHAR(500) NOT NULL,
    occurred_at_local TIMESTAMPTZ NOT NULL,
    received_at_server TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_waste_device_reference UNIQUE (device_id,client_reference),
    CONSTRAINT ck_waste_status CHECK (status IN (
        'PENDING_REVIEW','PENDING_SECOND_APPROVAL','APPROVED','PARTIALLY_APPROVED','REJECTED'
    )),
    CONSTRAINT ck_waste_required_role CHECK (
        (status='PENDING_SECOND_APPROVAL' AND required_role IN ('SUPERVISOR','ADMINISTRADOR'))
        OR (status<>'PENDING_SECOND_APPROVAL' AND required_role IS NULL)
    )
);

CREATE TABLE waste_item (
    id UUID PRIMARY KEY,
    waste_id UUID NOT NULL REFERENCES waste(id),
    waste_type_id UUID NOT NULL REFERENCES waste_type(id),
    presentation_id UUID NOT NULL REFERENCES product_presentation(id),
    product_id UUID NOT NULL REFERENCES product(id),
    presentation_quantity NUMERIC(18,4) NOT NULL,
    reported_base_units NUMERIC(18,4) NOT NULL,
    recoverable_base_units NUMERIC(18,4) NOT NULL,
    proposed_approved_base_units NUMERIC(18,4) NOT NULL DEFAULT 0,
    approved_base_units NUMERIC(18,4) NOT NULL DEFAULT 0,
    CONSTRAINT uq_waste_item_type_presentation UNIQUE (waste_id,waste_type_id,presentation_id),
    CONSTRAINT ck_waste_item_quantities CHECK (
        presentation_quantity>0 AND reported_base_units>0 AND recoverable_base_units>=0
        AND proposed_approved_base_units>=0 AND proposed_approved_base_units<=reported_base_units
        AND approved_base_units>=0 AND approved_base_units<=reported_base_units
    )
);

CREATE TABLE waste_evidence (
    id UUID PRIMARY KEY,
    waste_id UUID NOT NULL REFERENCES waste(id),
    storage_reference VARCHAR(500) NOT NULL,
    media_type VARCHAR(100) NOT NULL,
    sha256 CHAR(64) NOT NULL,
    captured_device_id UUID NOT NULL REFERENCES device(id),
    captured_at_local TIMESTAMPTZ NOT NULL,
    received_at_server TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_waste_evidence_media CHECK (media_type IN ('image/jpeg','image/png','image/webp')),
    CONSTRAINT ck_waste_evidence_hash CHECK (sha256 ~ '^[a-f0-9]{64}$')
);

CREATE TABLE waste_review (
    id UUID PRIMARY KEY,
    waste_id UUID NOT NULL REFERENCES waste(id),
    reviewer_id UUID NOT NULL REFERENCES app_user(id),
    reviewer_role VARCHAR(40) NOT NULL,
    decision VARCHAR(30) NOT NULL,
    approved_base_units NUMERIC(18,4) NOT NULL,
    notes VARCHAR(500) NOT NULL,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_waste_reviewer UNIQUE (waste_id,reviewer_id),
    CONSTRAINT ck_waste_review_role CHECK (reviewer_role IN ('BODEGA','SUPERVISOR','ADMINISTRADOR')),
    CONSTRAINT ck_waste_review_decision CHECK (decision IN ('APPROVE','REJECT','ESCALATE')),
    CONSTRAINT ck_waste_review_quantity CHECK (approved_base_units>=0)
);

CREATE TABLE alert (
    id UUID PRIMARY KEY,
    alert_type VARCHAR(60) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    reference_type VARCHAR(40) NOT NULL,
    reference_id UUID NOT NULL,
    title VARCHAR(200) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    investigated_by UUID REFERENCES app_user(id),
    investigated_at TIMESTAMPTZ,
    investigation_notes VARCHAR(500) NOT NULL DEFAULT '',
    CONSTRAINT uq_alert_reference_type UNIQUE (alert_type,reference_type,reference_id),
    CONSTRAINT ck_alert_status CHECK (status IN ('OPEN','INVESTIGATING','RESOLVED','DISMISSED')),
    CONSTRAINT ck_alert_severity CHECK (severity IN ('INFO','WARNING','CRITICAL'))
);

CREATE INDEX idx_waste_status_received ON waste(status,received_at_server DESC);
CREATE INDEX idx_waste_seller_received ON waste(seller_id,received_at_server DESC);
CREATE INDEX idx_waste_route_received ON waste(route_id,received_at_server DESC);
CREATE INDEX idx_waste_item_product ON waste_item(product_id);
CREATE INDEX idx_waste_evidence_waste ON waste_evidence(waste_id);
CREATE INDEX idx_waste_review_waste ON waste_review(waste_id,reviewed_at);
CREATE INDEX idx_alert_open ON alert(status,created_at DESC) WHERE status IN ('OPEN','INVESTIGATING');

INSERT INTO waste_type(id,code,name,evidence_policy,warehouse_approval_limit_base_units,
                       supervisor_approval_limit_base_units,daily_alert_threshold)
VALUES
    (gen_random_uuid(),'ROTURA','Rotura o envase quebrado','REQUIRED',5,20,3),
    (gen_random_uuid(),'DERRAME','Derrame','RECOMMENDED',5,20,3),
    (gen_random_uuid(),'CONTAMINACION','Producto contaminado','REQUIRED',2,10,1),
    (gen_random_uuid(),'TRANSPORTE','Daño durante transporte','RECOMMENDED',5,20,3);

CREATE OR REPLACE FUNCTION protect_waste_core() RETURNS trigger AS $$
BEGIN
    IF TG_OP='DELETE' THEN
        RAISE EXCEPTION 'waste records cannot be deleted' USING ERRCODE='55000';
    END IF;
    IF (NEW.id,NEW.client_reference,NEW.route_id,NEW.inventory_location_id,NEW.seller_id,
        NEW.reported_by,NEW.device_id,NEW.reason,NEW.occurred_at_local,NEW.received_at_server)
       IS DISTINCT FROM
       (OLD.id,OLD.client_reference,OLD.route_id,OLD.inventory_location_id,OLD.seller_id,
        OLD.reported_by,OLD.device_id,OLD.reason,OLD.occurred_at_local,OLD.received_at_server) THEN
        RAISE EXCEPTION 'waste report is immutable' USING ERRCODE='55000';
    END IF;
    IF OLD.status IN ('APPROVED','PARTIALLY_APPROVED','REJECTED') THEN
        RAISE EXCEPTION 'final waste decision is immutable' USING ERRCODE='55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_waste_item() RETURNS trigger AS $$
BEGIN
    IF TG_OP='DELETE' THEN
        RAISE EXCEPTION 'waste items cannot be deleted' USING ERRCODE='55000';
    END IF;
    IF (NEW.id,NEW.waste_id,NEW.waste_type_id,NEW.presentation_id,NEW.product_id,
        NEW.presentation_quantity,NEW.reported_base_units,NEW.recoverable_base_units)
       IS DISTINCT FROM
       (OLD.id,OLD.waste_id,OLD.waste_type_id,OLD.presentation_id,OLD.product_id,
        OLD.presentation_quantity,OLD.reported_base_units,OLD.recoverable_base_units) THEN
        RAISE EXCEPTION 'reported waste quantities are immutable' USING ERRCODE='55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reject_waste_history_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'waste evidence and reviews are immutable' USING ERRCODE='55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_waste_protected BEFORE UPDATE OR DELETE ON waste
FOR EACH ROW EXECUTE FUNCTION protect_waste_core();
CREATE TRIGGER trg_waste_item_protected BEFORE UPDATE OR DELETE ON waste_item
FOR EACH ROW EXECUTE FUNCTION protect_waste_item();
CREATE TRIGGER trg_waste_evidence_immutable BEFORE UPDATE OR DELETE ON waste_evidence
FOR EACH ROW EXECUTE FUNCTION reject_waste_history_mutation();
CREATE TRIGGER trg_waste_review_immutable BEFORE UPDATE OR DELETE ON waste_review
FOR EACH ROW EXECUTE FUNCTION reject_waste_history_mutation();
