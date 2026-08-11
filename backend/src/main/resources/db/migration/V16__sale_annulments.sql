ALTER TABLE credit_account_entry DROP CONSTRAINT credit_account_entry_payment_id_key;
ALTER TABLE credit_account_entry DROP CONSTRAINT ck_credit_entry_type;
ALTER TABLE credit_account_entry ADD CONSTRAINT ck_credit_entry_type CHECK (
    entry_type IN ('SALE_CHARGE','SALE_VOID')
);
ALTER TABLE credit_account_entry ADD CONSTRAINT uq_credit_entry_payment_type UNIQUE (payment_id,entry_type);

CREATE TABLE annulment_request (
    id UUID PRIMARY KEY,
    sale_id UUID NOT NULL UNIQUE REFERENCES sale(id),
    requested_by UUID NOT NULL REFERENCES app_user(id),
    requested_device_id UUID NOT NULL REFERENCES device(id),
    reason VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    decided_by UUID REFERENCES app_user(id),
    decided_device_id UUID REFERENCES device(id),
    decision_notes VARCHAR(500) NOT NULL DEFAULT '',
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ,
    CONSTRAINT ck_annulment_status CHECK (status IN ('REQUESTED','APPROVED','REJECTED')),
    CONSTRAINT ck_annulment_reason CHECK (length(trim(reason))>0),
    CONSTRAINT ck_annulment_decision CHECK (
        (status='REQUESTED' AND decided_by IS NULL AND decided_device_id IS NULL AND decided_at IS NULL AND decision_notes='')
        OR (status IN ('APPROVED','REJECTED') AND decided_by IS NOT NULL AND decided_device_id IS NOT NULL
            AND decided_at IS NOT NULL AND decided_by<>requested_by AND length(trim(decision_notes))>0)
    )
);

CREATE TABLE payment_reversal (
    id UUID PRIMARY KEY,
    annulment_request_id UUID NOT NULL REFERENCES annulment_request(id),
    payment_id UUID NOT NULL UNIQUE REFERENCES payment(id),
    payment_method VARCHAR(20) NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    reversed_by UUID NOT NULL REFERENCES app_user(id),
    reversed_device_id UUID NOT NULL REFERENCES device(id),
    reversed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_payment_reversal_method CHECK (payment_method IN ('CASH','TRANSFER','CREDIT')),
    CONSTRAINT ck_payment_reversal_amount CHECK (amount>0)
);

CREATE INDEX idx_annulment_status_date ON annulment_request(status,requested_at DESC);
CREATE INDEX idx_annulment_requester_date ON annulment_request(requested_by,requested_at DESC);

CREATE OR REPLACE FUNCTION protect_annulment_request() RETURNS trigger AS $$
BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'annulment requests cannot be deleted' USING ERRCODE='55000'; END IF;
    IF (NEW.id,NEW.sale_id,NEW.requested_by,NEW.requested_device_id,NEW.reason,NEW.requested_at)
       IS DISTINCT FROM (OLD.id,OLD.sale_id,OLD.requested_by,OLD.requested_device_id,OLD.reason,OLD.requested_at) THEN
        RAISE EXCEPTION 'annulment request core is immutable' USING ERRCODE='55000';
    END IF;
    IF OLD.status<>'REQUESTED' THEN RAISE EXCEPTION 'annulment decision is final' USING ERRCODE='55000'; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_payment_reversal() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'payment reversals are immutable' USING ERRCODE='55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_annulment_protected BEFORE UPDATE OR DELETE ON annulment_request
FOR EACH ROW EXECUTE FUNCTION protect_annulment_request();
CREATE TRIGGER trg_payment_reversal_immutable BEFORE UPDATE OR DELETE ON payment_reversal
FOR EACH ROW EXECUTE FUNCTION protect_payment_reversal();
