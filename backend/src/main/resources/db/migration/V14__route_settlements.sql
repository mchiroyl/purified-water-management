ALTER TABLE route_load DROP CONSTRAINT ck_route_load_status;
ALTER TABLE route_load DROP CONSTRAINT ck_route_load_warehouse_confirmation;
ALTER TABLE route_load DROP CONSTRAINT ck_route_load_seller_confirmation;
ALTER TABLE route_load DROP CONSTRAINT ck_route_load_started;
ALTER TABLE route_load ADD CONSTRAINT ck_route_load_status CHECK (
    status IN ('PREPARED','WAREHOUSE_CONFIRMED','RECEIVED','STARTED','SETTLED')
);
ALTER TABLE route_load ADD CONSTRAINT ck_route_load_warehouse_confirmation CHECK (
    (status='PREPARED' AND warehouse_confirmed_by IS NULL AND warehouse_confirmed_device_id IS NULL AND warehouse_confirmed_at IS NULL)
    OR (status IN ('WAREHOUSE_CONFIRMED','RECEIVED','STARTED','SETTLED') AND warehouse_confirmed_by IS NOT NULL
        AND warehouse_confirmed_device_id IS NOT NULL AND warehouse_confirmed_at IS NOT NULL)
);
ALTER TABLE route_load ADD CONSTRAINT ck_route_load_seller_confirmation CHECK (
    (status IN ('PREPARED','WAREHOUSE_CONFIRMED') AND seller_received_by IS NULL
        AND seller_received_device_id IS NULL AND seller_received_at IS NULL)
    OR (status IN ('RECEIVED','STARTED','SETTLED') AND seller_received_by IS NOT NULL
        AND seller_received_device_id IS NOT NULL AND seller_received_at IS NOT NULL)
);
ALTER TABLE route_load ADD CONSTRAINT ck_route_load_started CHECK (
    (status NOT IN ('STARTED','SETTLED') AND started_by IS NULL AND started_device_id IS NULL AND started_at IS NULL)
    OR (status IN ('STARTED','SETTLED') AND started_by IS NOT NULL AND started_device_id IS NOT NULL AND started_at IS NOT NULL)
);
CREATE UNIQUE INDEX uq_route_load_open_route ON route_load(route_id)
    WHERE status IN ('PREPARED','WAREHOUSE_CONFIRMED','RECEIVED','STARTED');

CREATE TABLE cash_delivery (
    id UUID PRIMARY KEY,
    route_load_id UUID NOT NULL REFERENCES route_load(id),
    amount NUMERIC(18,2) NOT NULL,
    delivered_by UUID NOT NULL REFERENCES app_user(id),
    delivered_device_id UUID REFERENCES device(id),
    received_by UUID NOT NULL REFERENCES app_user(id),
    received_device_id UUID NOT NULL REFERENCES device(id),
    notes VARCHAR(500) NOT NULL,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_cash_delivery_amount CHECK (amount>0),
    CONSTRAINT ck_cash_delivery_notes CHECK (length(trim(notes))>0)
);

CREATE TABLE settlement (
    id UUID PRIMARY KEY,
    route_load_id UUID NOT NULL UNIQUE REFERENCES route_load(id),
    route_id UUID NOT NULL REFERENCES route(id),
    status VARCHAR(30) NOT NULL,
    sales_total NUMERIC(18,2) NOT NULL,
    expected_cash NUMERIC(18,2) NOT NULL,
    delivered_cash NUMERIC(18,2) NOT NULL,
    verified_transfers NUMERIC(18,2) NOT NULL,
    applied_credit NUMERIC(18,2) NOT NULL,
    monetary_difference NUMERIC(18,2) NOT NULL,
    physical_difference_total NUMERIC(18,4) NOT NULL,
    blocking_reasons TEXT NOT NULL DEFAULT '',
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_by UUID REFERENCES app_user(id),
    closed_device_id UUID REFERENCES device(id),
    closed_at TIMESTAMPTZ,
    close_notes VARCHAR(500) NOT NULL DEFAULT '',
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_settlement_status CHECK (status IN ('PENDING','READY','WITH_DIFFERENCE','BALANCED','CLOSED')),
    CONSTRAINT ck_settlement_amounts CHECK (
        sales_total>=0 AND expected_cash>=0 AND delivered_cash>=0 AND verified_transfers>=0
        AND applied_credit>=0 AND physical_difference_total>=0
        AND monetary_difference=expected_cash-delivered_cash
    ),
    CONSTRAINT ck_settlement_close CHECK (
        (status<>'CLOSED' AND closed_by IS NULL AND closed_device_id IS NULL AND closed_at IS NULL AND close_notes='')
        OR (status='CLOSED' AND closed_by IS NOT NULL AND closed_device_id IS NOT NULL
            AND closed_at IS NOT NULL AND length(trim(close_notes))>0 AND blocking_reasons='')
    )
);

CREATE TABLE settlement_item (
    id UUID PRIMARY KEY,
    settlement_id UUID NOT NULL REFERENCES settlement(id),
    product_id UUID NOT NULL REFERENCES product(id),
    loaded_units NUMERIC(18,4) NOT NULL,
    sold_units NUMERIC(18,4) NOT NULL,
    returned_good_units NUMERIC(18,4) NOT NULL,
    customer_return_units NUMERIC(18,4) NOT NULL,
    approved_waste_units NUMERIC(18,4) NOT NULL,
    physical_difference NUMERIC(18,4) NOT NULL,
    CONSTRAINT uq_settlement_product UNIQUE (settlement_id,product_id),
    CONSTRAINT ck_settlement_item_sources CHECK (
        loaded_units>=0 AND sold_units>=0 AND returned_good_units>=0
        AND customer_return_units>=0 AND approved_waste_units>=0
        AND physical_difference=loaded_units-sold_units-returned_good_units-approved_waste_units
    )
);

CREATE INDEX idx_cash_delivery_load_date ON cash_delivery(route_load_id,delivered_at);
CREATE INDEX idx_settlement_route_date ON settlement(route_id,calculated_at DESC);

CREATE OR REPLACE FUNCTION protect_cash_delivery() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'cash deliveries are immutable' USING ERRCODE='55000';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_settlement() RETURNS trigger AS $$
BEGIN
    IF TG_OP='DELETE' THEN
        RAISE EXCEPTION 'settlements cannot be deleted' USING ERRCODE='55000';
    END IF;
    IF OLD.status='CLOSED' THEN
        RAISE EXCEPTION 'closed settlements are immutable' USING ERRCODE='55000';
    END IF;
    IF (NEW.id,NEW.route_load_id,NEW.route_id) IS DISTINCT FROM (OLD.id,OLD.route_load_id,OLD.route_id) THEN
        RAISE EXCEPTION 'settlement identity is immutable' USING ERRCODE='55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION protect_settlement_item() RETURNS trigger AS $$
BEGIN
    IF EXISTS(SELECT 1 FROM settlement s WHERE s.id=COALESCE(OLD.settlement_id,NEW.settlement_id) AND s.status='CLOSED') THEN
        RAISE EXCEPTION 'closed settlement items are immutable' USING ERRCODE='55000';
    END IF;
    RETURN COALESCE(NEW,OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cash_delivery_immutable BEFORE UPDATE OR DELETE ON cash_delivery
FOR EACH ROW EXECUTE FUNCTION protect_cash_delivery();
CREATE TRIGGER trg_settlement_protected BEFORE UPDATE OR DELETE ON settlement
FOR EACH ROW EXECUTE FUNCTION protect_settlement();
CREATE TRIGGER trg_settlement_item_protected BEFORE UPDATE OR DELETE ON settlement_item
FOR EACH ROW EXECUTE FUNCTION protect_settlement_item();
