ALTER TABLE inventory_movement DROP CONSTRAINT ck_inventory_movement_type;
ALTER TABLE inventory_movement ADD CONSTRAINT ck_inventory_movement_type CHECK (movement_type IN (
    'ADJUSTMENT_IN','ADJUSTMENT_OUT','LOAD_OUT','LOAD_IN','SALE_OUT','RETURN_OUT','RETURN_IN',
    'WASTE_OUT','VOID_IN','TRANSFER_IN','TRANSFER_OUT'
));

CREATE TABLE customer_return (
    id UUID PRIMARY KEY,
    client_reference UUID NOT NULL,
    return_type VARCHAR(30) NOT NULL,
    route_id UUID NOT NULL REFERENCES route(id),
    route_location_id UUID NOT NULL REFERENCES inventory_location(id),
    customer_id UUID REFERENCES customer(id),
    sale_id UUID REFERENCES sale(id),
    seller_id UUID NOT NULL REFERENCES seller(id),
    reported_by UUID NOT NULL REFERENCES app_user(id),
    device_id UUID NOT NULL REFERENCES device(id),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_RECEIPT',
    reason VARCHAR(500) NOT NULL,
    reported_at_local TIMESTAMPTZ NOT NULL,
    received_at_server TIMESTAMPTZ NOT NULL DEFAULT now(),
    warehouse_location_id UUID REFERENCES inventory_location(id),
    received_by UUID REFERENCES app_user(id),
    received_device_id UUID REFERENCES device(id),
    received_at TIMESTAMPTZ,
    receipt_notes VARCHAR(500) NOT NULL DEFAULT '',
    CONSTRAINT uq_customer_return_device_reference UNIQUE (device_id,client_reference),
    CONSTRAINT ck_customer_return_type CHECK (return_type IN ('UNSOLD_GOOD','CUSTOMER_RETURN')),
    CONSTRAINT ck_customer_return_reference CHECK (
        (return_type='UNSOLD_GOOD' AND customer_id IS NULL AND sale_id IS NULL)
        OR (return_type='CUSTOMER_RETURN' AND customer_id IS NOT NULL)
    ),
    CONSTRAINT ck_customer_return_status CHECK (status IN (
        'PENDING_RECEIPT','RECEIVED','PARTIALLY_RECEIVED','REJECTED'
    )),
    CONSTRAINT ck_customer_return_receipt CHECK (
        (status='PENDING_RECEIPT' AND warehouse_location_id IS NULL AND received_by IS NULL
            AND received_device_id IS NULL AND received_at IS NULL AND receipt_notes='')
        OR (status<>'PENDING_RECEIPT' AND warehouse_location_id IS NOT NULL AND received_by IS NOT NULL
            AND received_device_id IS NOT NULL AND received_at IS NOT NULL AND length(trim(receipt_notes))>0)
    )
);

CREATE TABLE return_item (
    id UUID PRIMARY KEY,
    return_id UUID NOT NULL REFERENCES customer_return(id),
    presentation_id UUID NOT NULL REFERENCES product_presentation(id),
    product_id UUID NOT NULL REFERENCES product(id),
    presentation_quantity NUMERIC(18,4) NOT NULL,
    reported_base_units NUMERIC(18,4) NOT NULL,
    received_base_units NUMERIC(18,4) NOT NULL DEFAULT 0,
    condition VARCHAR(20) NOT NULL DEFAULT 'GOOD',
    CONSTRAINT uq_return_item_presentation UNIQUE (return_id,presentation_id),
    CONSTRAINT ck_return_item_quantities CHECK (
        presentation_quantity>0 AND reported_base_units>0
        AND received_base_units>=0 AND received_base_units<=reported_base_units
    ),
    CONSTRAINT ck_return_item_condition CHECK (condition='GOOD')
);

CREATE INDEX idx_customer_return_route_date ON customer_return(route_id,received_at_server DESC);
CREATE INDEX idx_customer_return_seller_date ON customer_return(seller_id,received_at_server DESC);
CREATE INDEX idx_customer_return_status_date ON customer_return(status,received_at_server DESC);
CREATE INDEX idx_customer_return_customer ON customer_return(customer_id,received_at_server DESC)
    WHERE customer_id IS NOT NULL;
CREATE INDEX idx_return_item_product ON return_item(product_id);

CREATE OR REPLACE FUNCTION protect_customer_return_core() RETURNS trigger AS $$
BEGIN
    IF TG_OP='DELETE' THEN
        RAISE EXCEPTION 'returns cannot be deleted' USING ERRCODE='55000';
    END IF;
    IF (NEW.id,NEW.client_reference,NEW.return_type,NEW.route_id,NEW.route_location_id,
        NEW.customer_id,NEW.sale_id,NEW.seller_id,NEW.reported_by,NEW.device_id,NEW.reason,
        NEW.reported_at_local,NEW.received_at_server)
       IS DISTINCT FROM
       (OLD.id,OLD.client_reference,OLD.return_type,OLD.route_id,OLD.route_location_id,
        OLD.customer_id,OLD.sale_id,OLD.seller_id,OLD.reported_by,OLD.device_id,OLD.reason,
        OLD.reported_at_local,OLD.received_at_server) THEN
        RAISE EXCEPTION 'reported return is immutable' USING ERRCODE='55000';
    END IF;
    IF OLD.status<>'PENDING_RECEIPT' THEN
        RAISE EXCEPTION 'final return receipt is immutable' USING ERRCODE='55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_return_item() RETURNS trigger AS $$
BEGIN
    IF TG_OP='DELETE' THEN
        RAISE EXCEPTION 'return items cannot be deleted' USING ERRCODE='55000';
    END IF;
    IF (NEW.id,NEW.return_id,NEW.presentation_id,NEW.product_id,NEW.presentation_quantity,
        NEW.reported_base_units,NEW.condition)
       IS DISTINCT FROM
       (OLD.id,OLD.return_id,OLD.presentation_id,OLD.product_id,OLD.presentation_quantity,
        OLD.reported_base_units,OLD.condition) THEN
        RAISE EXCEPTION 'reported return quantities are immutable' USING ERRCODE='55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customer_return_protected BEFORE UPDATE OR DELETE ON customer_return
FOR EACH ROW EXECUTE FUNCTION protect_customer_return_core();
CREATE TRIGGER trg_return_item_protected BEFORE UPDATE OR DELETE ON return_item
FOR EACH ROW EXECUTE FUNCTION protect_return_item();
