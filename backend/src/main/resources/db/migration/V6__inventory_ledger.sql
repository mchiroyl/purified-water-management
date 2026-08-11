CREATE TABLE inventory_location (
    id UUID PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(160) NOT NULL,
    location_type VARCHAR(20) NOT NULL,
    route_id UUID UNIQUE REFERENCES route(id),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_inventory_location_code CHECK (code = upper(code)),
    CONSTRAINT ck_inventory_location_type CHECK (location_type IN ('WAREHOUSE', 'ROUTE')),
    CONSTRAINT ck_inventory_location_route CHECK (
        (location_type = 'WAREHOUSE' AND route_id IS NULL)
        OR (location_type = 'ROUTE' AND route_id IS NOT NULL)
    )
);

CREATE TABLE inventory_balance (
    location_id UUID NOT NULL REFERENCES inventory_location(id),
    product_id UUID NOT NULL REFERENCES product(id),
    quantity_base_units NUMERIC(18,4) NOT NULL DEFAULT 0,
    version BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (location_id, product_id),
    CONSTRAINT ck_inventory_balance_non_negative CHECK (quantity_base_units >= 0)
);

CREATE TABLE inventory_movement (
    id UUID PRIMARY KEY,
    location_id UUID NOT NULL REFERENCES inventory_location(id),
    product_id UUID NOT NULL REFERENCES product(id),
    movement_type VARCHAR(30) NOT NULL,
    quantity_delta NUMERIC(18,4) NOT NULL,
    balance_before NUMERIC(18,4) NOT NULL,
    balance_after NUMERIC(18,4) NOT NULL,
    reason VARCHAR(500) NOT NULL,
    reference_type VARCHAR(40),
    reference_id UUID,
    actor_id UUID NOT NULL REFERENCES app_user(id),
    device_id UUID REFERENCES device(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_inventory_movement_type CHECK (movement_type IN (
        'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'LOAD_OUT', 'LOAD_IN', 'SALE_OUT',
        'RETURN_IN', 'WASTE_OUT', 'VOID_IN', 'TRANSFER_IN', 'TRANSFER_OUT'
    )),
    CONSTRAINT ck_inventory_movement_non_zero CHECK (quantity_delta <> 0),
    CONSTRAINT ck_inventory_movement_balances CHECK (
        balance_before >= 0 AND balance_after >= 0
        AND balance_after = balance_before + quantity_delta
    )
);

CREATE INDEX idx_inventory_balance_product ON inventory_balance(product_id);
CREATE INDEX idx_inventory_movement_location_date ON inventory_movement(location_id, created_at DESC);
CREATE INDEX idx_inventory_movement_product_date ON inventory_movement(product_id, created_at DESC);
CREATE INDEX idx_inventory_movement_reference ON inventory_movement(reference_type, reference_id)
    WHERE reference_id IS NOT NULL;

CREATE OR REPLACE FUNCTION reject_inventory_movement_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'inventory movements are immutable' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER trg_inventory_movement_immutable
BEFORE UPDATE OR DELETE ON inventory_movement
FOR EACH ROW EXECUTE FUNCTION reject_inventory_movement_mutation();
