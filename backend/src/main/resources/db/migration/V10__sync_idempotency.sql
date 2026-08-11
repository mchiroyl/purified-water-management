CREATE TABLE sync_operation (
    id UUID PRIMARY KEY,
    device_id UUID NOT NULL REFERENCES device(id),
    client_operation_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES app_user(id),
    entity_type VARCHAR(40) NOT NULL,
    operation_type VARCHAR(40) NOT NULL,
    aggregate_local_id UUID NOT NULL,
    payload JSONB NOT NULL,
    payload_hash CHAR(64) NOT NULL,
    dependencies JSONB NOT NULL DEFAULT '[]'::jsonb,
    processing_status VARCHAR(20) NOT NULL DEFAULT 'PROCESSING',
    result_status VARCHAR(24),
    server_entity_id UUID,
    result_payload JSONB,
    error_code VARCHAR(100),
    error_message VARCHAR(500),
    created_at_local TIMESTAMPTZ NOT NULL,
    received_at_server TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at_server TIMESTAMPTZ,
    CONSTRAINT uq_sync_operation_device_client UNIQUE (device_id, client_operation_id),
    CONSTRAINT ck_sync_operation_entity CHECK (entity_type ~ '^[A-Z_]+$'),
    CONSTRAINT ck_sync_operation_action CHECK (operation_type ~ '^[A-Z_]+$'),
    CONSTRAINT ck_sync_operation_dependencies CHECK (jsonb_typeof(dependencies) = 'array'),
    CONSTRAINT ck_sync_operation_processing CHECK (processing_status IN ('PROCESSING', 'COMPLETED')),
    CONSTRAINT ck_sync_operation_result CHECK (result_status IS NULL OR result_status IN
        ('ACCEPTED', 'ALREADY_PROCESSED', 'REJECTED', 'CONFLICT', 'RETRY')),
    CONSTRAINT ck_sync_operation_completion CHECK (
        (processing_status = 'PROCESSING' AND result_status IS NULL AND processed_at_server IS NULL)
        OR (processing_status = 'COMPLETED' AND result_status IS NOT NULL AND processed_at_server IS NOT NULL)
    )
);

CREATE INDEX idx_sync_operation_device_result ON sync_operation(device_id, result_status);
CREATE INDEX idx_sync_operation_user_received ON sync_operation(user_id, received_at_server DESC);
CREATE INDEX idx_sync_operation_aggregate ON sync_operation(entity_type, aggregate_local_id);

CREATE OR REPLACE FUNCTION protect_sync_operation_result() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'sync_operation records cannot be deleted';
    END IF;
    IF OLD.device_id IS DISTINCT FROM NEW.device_id
       OR OLD.client_operation_id IS DISTINCT FROM NEW.client_operation_id
       OR OLD.user_id IS DISTINCT FROM NEW.user_id
       OR OLD.entity_type IS DISTINCT FROM NEW.entity_type
       OR OLD.operation_type IS DISTINCT FROM NEW.operation_type
       OR OLD.aggregate_local_id IS DISTINCT FROM NEW.aggregate_local_id
       OR OLD.payload IS DISTINCT FROM NEW.payload
       OR OLD.payload_hash IS DISTINCT FROM NEW.payload_hash
       OR OLD.dependencies IS DISTINCT FROM NEW.dependencies
       OR OLD.created_at_local IS DISTINCT FROM NEW.created_at_local
       OR OLD.received_at_server IS DISTINCT FROM NEW.received_at_server THEN
        RAISE EXCEPTION 'sync_operation identity and payload are immutable';
    END IF;
    IF OLD.processing_status = 'COMPLETED' AND OLD.result_status <> 'RETRY' THEN
        RAISE EXCEPTION 'final sync_operation results are immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_operation_result_protection
BEFORE UPDATE OR DELETE ON sync_operation
FOR EACH ROW EXECUTE FUNCTION protect_sync_operation_result();
