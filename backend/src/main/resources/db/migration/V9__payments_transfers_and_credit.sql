CREATE TABLE payment (
    id UUID PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES sale(id),
    payment_method VARCHAR(20) NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    status VARCHAR(30) NOT NULL,
    reference VARCHAR(120) NOT NULL DEFAULT '',
    bank VARCHAR(120) NOT NULL DEFAULT '',
    evidence_reference VARCHAR(500) NOT NULL DEFAULT '',
    registered_by UUID NOT NULL REFERENCES app_user(id),
    device_id UUID NOT NULL REFERENCES device(id),
    verified_by UUID REFERENCES app_user(id),
    verified_at TIMESTAMPTZ,
    rejection_reason VARCHAR(500) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_payment_sale_method UNIQUE (sale_id, payment_method),
    CONSTRAINT ck_payment_amount CHECK (amount > 0),
    CONSTRAINT ck_payment_method_status CHECK (
        (payment_method='CASH' AND status='CONFIRMED') OR
        (payment_method='TRANSFER' AND status IN ('PENDING_VERIFICATION','VERIFIED','REJECTED')) OR
        (payment_method='CREDIT' AND status='APPLIED')
    ),
    CONSTRAINT ck_transfer_reference CHECK (payment_method <> 'TRANSFER' OR length(trim(reference)) > 0),
    CONSTRAINT ck_transfer_decision CHECK (
        (status='PENDING_VERIFICATION' AND verified_by IS NULL AND verified_at IS NULL AND rejection_reason='') OR
        (status='VERIFIED' AND verified_by IS NOT NULL AND verified_at IS NOT NULL AND rejection_reason='') OR
        (status='REJECTED' AND verified_by IS NOT NULL AND verified_at IS NOT NULL AND length(trim(rejection_reason)) > 0) OR
        (payment_method <> 'TRANSFER' AND verified_by IS NULL AND verified_at IS NULL AND rejection_reason='')
    )
);

CREATE TABLE credit_account_entry (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customer(id),
    sale_id UUID NOT NULL REFERENCES sale(id),
    payment_id UUID NOT NULL UNIQUE REFERENCES payment(id),
    entry_type VARCHAR(30) NOT NULL,
    amount NUMERIC(18,2) NOT NULL,
    balance_after NUMERIC(18,2) NOT NULL,
    created_by UUID NOT NULL REFERENCES app_user(id),
    device_id UUID NOT NULL REFERENCES device(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_credit_entry_type CHECK (entry_type='SALE_CHARGE'),
    CONSTRAINT ck_credit_entry_amount CHECK (amount > 0 AND balance_after >= 0)
);

CREATE INDEX idx_payment_transfer_status ON payment(status, created_at DESC)
    WHERE payment_method='TRANSFER';
CREATE INDEX idx_credit_entry_customer_date ON credit_account_entry(customer_id, created_at DESC);

CREATE OR REPLACE FUNCTION protect_payment_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP='DELETE' THEN
        RAISE EXCEPTION 'payments cannot be deleted' USING ERRCODE='55000';
    END IF;
    IF OLD.payment_method <> 'TRANSFER' OR OLD.status <> 'PENDING_VERIFICATION'
       OR NEW.status NOT IN ('VERIFIED','REJECTED') THEN
        RAISE EXCEPTION 'invalid payment state transition' USING ERRCODE='55000';
    END IF;
    IF (NEW.id,NEW.sale_id,NEW.payment_method,NEW.amount,NEW.reference,NEW.bank,
        NEW.evidence_reference,NEW.registered_by,NEW.device_id,NEW.created_at)
       IS DISTINCT FROM
       (OLD.id,OLD.sale_id,OLD.payment_method,OLD.amount,OLD.reference,OLD.bank,
        OLD.evidence_reference,OLD.registered_by,OLD.device_id,OLD.created_at) THEN
        RAISE EXCEPTION 'payment financial data is immutable' USING ERRCODE='55000';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_protected
BEFORE UPDATE OR DELETE ON payment
FOR EACH ROW EXECUTE FUNCTION protect_payment_mutation();

CREATE TRIGGER trg_credit_entry_immutable
BEFORE UPDATE OR DELETE ON credit_account_entry
FOR EACH ROW EXECUTE FUNCTION reject_sale_mutation();
