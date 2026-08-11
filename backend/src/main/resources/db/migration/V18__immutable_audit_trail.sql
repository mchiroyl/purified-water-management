ALTER TABLE audit_log ADD CONSTRAINT ck_audit_action CHECK (action ~ '^[A-Z][A-Z0-9_]{1,79}$');
ALTER TABLE audit_log ADD CONSTRAINT ck_audit_entity_type CHECK (entity_type ~ '^[A-Z][A-Z0-9_]{1,79}$');

CREATE INDEX idx_audit_action_date ON audit_log(action,occurred_at DESC);
CREATE INDEX idx_audit_correlation ON audit_log(correlation_id);

CREATE OR REPLACE FUNCTION reject_audit_mutation() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'audit records are immutable' USING ERRCODE='55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_immutable BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION reject_audit_mutation();
