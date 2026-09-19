CREATE TABLE credit_payment (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id      UUID NOT NULL REFERENCES customer(id),
    route_load_id    UUID REFERENCES route_load(id),
    amount           NUMERIC(14,2) NOT NULL,
    payment_method   VARCHAR(20) NOT NULL,
    status           VARCHAR(30) NOT NULL,
    reference        VARCHAR(120) NOT NULL DEFAULT '',
    bank             VARCHAR(120) NOT NULL DEFAULT '',
    rejection_reason VARCHAR(500) NOT NULL DEFAULT '',
    notes            VARCHAR(500) NOT NULL DEFAULT '',
    collected_by     UUID NOT NULL REFERENCES app_user(id),
    device_id        UUID NOT NULL REFERENCES device(id),
    verified_by      UUID REFERENCES app_user(id),
    verified_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_cp_method CHECK (payment_method IN ('CASH', 'TRANSFER')),
    CONSTRAINT ck_cp_amount CHECK (amount > 0),
    CONSTRAINT ck_cp_status CHECK (status IN ('CONFIRMED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED')),
    CONSTRAINT ck_cp_method_status CHECK (
        (payment_method = 'CASH'     AND status = 'CONFIRMED') OR
        (payment_method = 'TRANSFER' AND status IN ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED'))
    ),
    CONSTRAINT ck_cp_transfer_ref CHECK (
        payment_method <> 'TRANSFER' OR length(trim(reference)) > 0
    ),
    CONSTRAINT ck_cp_verification CHECK (
        (status = 'PENDING_VERIFICATION' AND verified_by IS NULL AND verified_at IS NULL AND rejection_reason = '') OR
        (status = 'VERIFIED' AND verified_by IS NOT NULL AND verified_at IS NOT NULL AND rejection_reason = '') OR
        (status = 'REJECTED' AND verified_by IS NOT NULL AND verified_at IS NOT NULL AND length(trim(rejection_reason)) > 0) OR
        (payment_method = 'CASH' AND verified_by IS NULL AND verified_at IS NULL AND rejection_reason = '')
    )
);

CREATE INDEX idx_credit_payment_customer ON credit_payment(customer_id, created_at DESC);
CREATE INDEX idx_credit_payment_status ON credit_payment(status, created_at DESC)
    WHERE payment_method = 'TRANSFER';

CREATE OR REPLACE FUNCTION protect_credit_payment_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'credit_payment cannot be deleted' USING ERRCODE='55000';
    END IF;
    IF OLD.payment_method <> 'TRANSFER' OR OLD.status <> 'PENDING_VERIFICATION'
       OR NEW.status NOT IN ('VERIFIED', 'REJECTED') THEN
        RAISE EXCEPTION 'invalid credit_payment state transition' USING ERRCODE='55000';
    END IF;
    IF (NEW.id, NEW.customer_id, NEW.route_load_id, NEW.payment_method, NEW.amount, NEW.reference,
        NEW.bank, NEW.collected_by, NEW.device_id, NEW.created_at)
       IS DISTINCT FROM
       (OLD.id, OLD.customer_id, OLD.route_load_id, OLD.payment_method, OLD.amount, OLD.reference,
        OLD.bank, OLD.collected_by, OLD.device_id, OLD.created_at) THEN
        RAISE EXCEPTION 'credit_payment financial data is immutable' USING ERRCODE='55000';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credit_payment_protected
BEFORE UPDATE OR DELETE ON credit_payment
FOR EACH ROW EXECUTE FUNCTION protect_credit_payment_mutation();

-- Extensión aditiva de credit_account_entry
ALTER TABLE credit_account_entry DROP CONSTRAINT ck_credit_entry_type;
ALTER TABLE credit_account_entry ADD CONSTRAINT ck_credit_entry_type CHECK (
    entry_type IN ('SALE_CHARGE', 'SALE_VOID', 'CREDIT_PAYMENT')
);

ALTER TABLE credit_account_entry ALTER COLUMN sale_id DROP NOT NULL;
ALTER TABLE credit_account_entry ALTER COLUMN payment_id DROP NOT NULL;

ALTER TABLE credit_account_entry ADD COLUMN credit_payment_id UUID REFERENCES credit_payment(id);

CREATE UNIQUE INDEX uq_credit_entry_credit_payment ON credit_account_entry(credit_payment_id)
    WHERE credit_payment_id IS NOT NULL;

ALTER TABLE credit_account_entry ADD CONSTRAINT ck_credit_entry_source CHECK (
    (entry_type IN ('SALE_CHARGE', 'SALE_VOID') AND payment_id IS NOT NULL AND sale_id IS NOT NULL AND credit_payment_id IS NULL) OR
    (entry_type = 'CREDIT_PAYMENT' AND credit_payment_id IS NOT NULL AND payment_id IS NULL AND sale_id IS NULL)
);
