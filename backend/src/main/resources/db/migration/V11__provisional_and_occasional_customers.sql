ALTER TABLE customer DROP CONSTRAINT ck_customer_type;
ALTER TABLE customer ADD CONSTRAINT ck_customer_type
    CHECK (customer_type IN ('PERMANENT', 'PROVISIONAL', 'OCCASIONAL'));

CREATE INDEX idx_customer_pending_review ON customer(created_at)
    WHERE customer_type = 'PROVISIONAL' AND registration_state = 'PENDING_REVIEW';

CREATE TABLE customer_merge (
    id UUID PRIMARY KEY,
    source_customer_id UUID NOT NULL UNIQUE REFERENCES customer(id),
    target_customer_id UUID NOT NULL REFERENCES customer(id),
    reason TEXT NOT NULL,
    merged_by UUID NOT NULL REFERENCES app_user(id),
    merged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_customer_merge_distinct CHECK (source_customer_id <> target_customer_id),
    CONSTRAINT ck_customer_merge_reason CHECK (length(trim(reason)) > 0)
);

CREATE TABLE customer_registration_review (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL UNIQUE REFERENCES customer(id),
    decision VARCHAR(20) NOT NULL,
    target_customer_id UUID REFERENCES customer(id),
    reason TEXT NOT NULL DEFAULT '',
    reviewed_by UUID NOT NULL REFERENCES app_user(id),
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_customer_review_decision CHECK (decision IN ('APPROVED', 'REJECTED', 'MERGED')),
    CONSTRAINT ck_customer_review_target CHECK (
        (decision = 'MERGED' AND target_customer_id IS NOT NULL AND length(trim(reason)) > 0)
        OR (decision = 'REJECTED' AND target_customer_id IS NULL AND length(trim(reason)) > 0)
        OR (decision = 'APPROVED' AND target_customer_id IS NULL)
    )
);

CREATE OR REPLACE FUNCTION reject_customer_decision_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'customer registration decisions are immutable' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER trg_customer_merge_immutable
BEFORE UPDATE OR DELETE ON customer_merge
FOR EACH ROW EXECUTE FUNCTION reject_customer_decision_mutation();

CREATE TRIGGER trg_customer_review_immutable
BEFORE UPDATE OR DELETE ON customer_registration_review
FOR EACH ROW EXECUTE FUNCTION reject_customer_decision_mutation();
