CREATE TABLE sale (
    id UUID PRIMARY KEY,
    client_reference UUID NOT NULL,
    document_number VARCHAR(80) NOT NULL UNIQUE,
    receipt_sequence_number BIGINT NOT NULL,
    route_id UUID NOT NULL REFERENCES route(id),
    inventory_location_id UUID NOT NULL REFERENCES inventory_location(id),
    seller_id UUID NOT NULL REFERENCES seller(id),
    customer_id UUID NOT NULL REFERENCES customer(id),
    status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED',
    subtotal NUMERIC(18,2) NOT NULL,
    total NUMERIC(18,2) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    company_name VARCHAR(160) NOT NULL,
    company_tax_id VARCHAR(30) NOT NULL,
    company_address TEXT NOT NULL,
    document_legend VARCHAR(500) NOT NULL DEFAULT '',
    created_by UUID NOT NULL REFERENCES app_user(id),
    device_id UUID NOT NULL REFERENCES device(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_sale_status CHECK (status='CONFIRMED'),
    CONSTRAINT ck_sale_totals CHECK (subtotal >= 0 AND total = subtotal)
);

CREATE TABLE sale_item (
    id UUID PRIMARY KEY,
    sale_id UUID NOT NULL REFERENCES sale(id),
    product_id UUID NOT NULL REFERENCES product(id),
    presentation_id UUID NOT NULL REFERENCES product_presentation(id),
    presentation_quantity NUMERIC(18,4) NOT NULL,
    quantity_base_units NUMERIC(18,4) NOT NULL,
    unit_price NUMERIC(18,2) NOT NULL,
    line_total NUMERIC(18,2) NOT NULL,
    price_source VARCHAR(40) NOT NULL,
    price_version_id UUID REFERENCES price_version(id),
    price_tier_id UUID REFERENCES price_tier(id),
    special_price_id UUID REFERENCES customer_special_price(id),
    CONSTRAINT ck_sale_item_quantities CHECK (presentation_quantity > 0 AND quantity_base_units > 0),
    CONSTRAINT ck_sale_item_amounts CHECK (unit_price >= 0 AND line_total >= 0)
);

CREATE INDEX idx_sale_route_date ON sale(route_id, created_at DESC);
CREATE INDEX idx_sale_customer_date ON sale(customer_id, created_at DESC);
CREATE INDEX idx_sale_seller_date ON sale(seller_id, created_at DESC);
CREATE INDEX idx_sale_client_reference ON sale(client_reference);
CREATE INDEX idx_sale_item_product ON sale_item(product_id);

CREATE OR REPLACE FUNCTION reject_sale_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'confirmed sales are immutable' USING ERRCODE = '55000';
END;
$$;

CREATE TRIGGER trg_sale_immutable
BEFORE UPDATE OR DELETE ON sale
FOR EACH ROW EXECUTE FUNCTION reject_sale_mutation();

CREATE TRIGGER trg_sale_item_immutable
BEFORE UPDATE OR DELETE ON sale_item
FOR EACH ROW EXECUTE FUNCTION reject_sale_mutation();
