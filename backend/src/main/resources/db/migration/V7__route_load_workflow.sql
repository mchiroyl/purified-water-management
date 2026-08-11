CREATE SEQUENCE route_load_number_seq START WITH 1;

CREATE TABLE route_load (
    id UUID PRIMARY KEY,
    load_number BIGINT NOT NULL DEFAULT nextval('route_load_number_seq') UNIQUE,
    route_id UUID NOT NULL REFERENCES route(id),
    source_location_id UUID NOT NULL REFERENCES inventory_location(id),
    target_location_id UUID NOT NULL REFERENCES inventory_location(id),
    planned_date DATE NOT NULL,
    notes VARCHAR(500) NOT NULL DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'PREPARED',
    created_by UUID NOT NULL REFERENCES app_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    warehouse_confirmed_by UUID REFERENCES app_user(id),
    warehouse_confirmed_device_id UUID REFERENCES device(id),
    warehouse_confirmed_at TIMESTAMPTZ,
    seller_received_by UUID REFERENCES app_user(id),
    seller_received_device_id UUID REFERENCES device(id),
    seller_received_at TIMESTAMPTZ,
    started_by UUID REFERENCES app_user(id),
    started_device_id UUID REFERENCES device(id),
    started_at TIMESTAMPTZ,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT ck_route_load_status CHECK (status IN ('PREPARED','WAREHOUSE_CONFIRMED','RECEIVED','STARTED')),
    CONSTRAINT ck_route_load_locations CHECK (source_location_id <> target_location_id),
    CONSTRAINT ck_route_load_warehouse_confirmation CHECK (
        (status='PREPARED' AND warehouse_confirmed_by IS NULL AND warehouse_confirmed_device_id IS NULL AND warehouse_confirmed_at IS NULL)
        OR (status IN ('WAREHOUSE_CONFIRMED','RECEIVED','STARTED') AND warehouse_confirmed_by IS NOT NULL
            AND warehouse_confirmed_device_id IS NOT NULL AND warehouse_confirmed_at IS NOT NULL)
    ),
    CONSTRAINT ck_route_load_seller_confirmation CHECK (
        (status IN ('PREPARED','WAREHOUSE_CONFIRMED') AND seller_received_by IS NULL
            AND seller_received_device_id IS NULL AND seller_received_at IS NULL)
        OR (status IN ('RECEIVED','STARTED') AND seller_received_by IS NOT NULL
            AND seller_received_device_id IS NOT NULL AND seller_received_at IS NOT NULL)
    ),
    CONSTRAINT ck_route_load_started CHECK (
        (status<>'STARTED' AND started_by IS NULL AND started_device_id IS NULL AND started_at IS NULL)
        OR (status='STARTED' AND started_by IS NOT NULL AND started_device_id IS NOT NULL AND started_at IS NOT NULL)
    )
);

CREATE TABLE route_load_item (
    id UUID PRIMARY KEY,
    route_load_id UUID NOT NULL REFERENCES route_load(id),
    product_id UUID NOT NULL REFERENCES product(id),
    quantity_base_units NUMERIC(18,4) NOT NULL,
    CONSTRAINT uq_route_load_product UNIQUE (route_load_id, product_id),
    CONSTRAINT ck_route_load_item_positive CHECK (quantity_base_units > 0)
);

CREATE TABLE route_load_correction (
    id UUID PRIMARY KEY,
    route_load_id UUID NOT NULL REFERENCES route_load(id),
    product_id UUID NOT NULL REFERENCES product(id),
    quantity_delta NUMERIC(18,4) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    actor_id UUID NOT NULL REFERENCES app_user(id),
    device_id UUID NOT NULL REFERENCES device(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_route_load_correction_non_zero CHECK (quantity_delta <> 0)
);

CREATE INDEX idx_route_load_route_date ON route_load(route_id, planned_date DESC);
CREATE INDEX idx_route_load_status_date ON route_load(status, planned_date DESC);
CREATE INDEX idx_route_load_item_product ON route_load_item(product_id);

CREATE OR REPLACE FUNCTION reject_route_load_detail_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'route load details are immutable; use a compensating correction' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER trg_route_load_item_immutable
BEFORE UPDATE OR DELETE ON route_load_item
FOR EACH ROW EXECUTE FUNCTION reject_route_load_detail_mutation();

CREATE TRIGGER trg_route_load_correction_immutable
BEFORE UPDATE OR DELETE ON route_load_correction
FOR EACH ROW EXECUTE FUNCTION reject_route_load_detail_mutation();
