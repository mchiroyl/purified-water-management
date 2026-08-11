CREATE TABLE price_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    currency_code CHAR(3) NOT NULL DEFAULT 'GTQ',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_price_list_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT ck_price_list_currency CHECK (currency_code = upper(currency_code))
);

CREATE TABLE price_version (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_list_id UUID NOT NULL REFERENCES price_list(id),
    version_number INTEGER NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_by UUID NOT NULL REFERENCES app_user(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_price_version_number UNIQUE (price_list_id, version_number),
    CONSTRAINT ck_price_version_number CHECK (version_number > 0),
    CONSTRAINT ck_price_version_dates CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ck_price_version_status CHECK (status IN ('DRAFT', 'SCHEDULED', 'ACTIVE', 'INACTIVE'))
);

CREATE UNIQUE INDEX uq_price_version_active_list ON price_version(price_list_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_price_version_validity ON price_version(price_list_id, valid_from, valid_to);

CREATE TABLE price_tier (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    price_version_id UUID NOT NULL REFERENCES price_version(id),
    product_presentation_id UUID NOT NULL REFERENCES product_presentation(id),
    min_base_units NUMERIC(14,4) NOT NULL,
    max_base_units NUMERIC(14,4),
    unit_price NUMERIC(14,2) NOT NULL,
    CONSTRAINT ck_price_tier_range CHECK (min_base_units > 0 AND (max_base_units IS NULL OR max_base_units >= min_base_units)),
    CONSTRAINT ck_price_tier_price CHECK (unit_price > 0)
);

CREATE INDEX idx_price_tier_resolution ON price_tier(product_presentation_id, min_base_units, max_base_units);

CREATE TABLE customer_special_price (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customer(id),
    product_presentation_id UUID NOT NULL REFERENCES product_presentation(id),
    unit_price NUMERIC(14,2) NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ,
    approved_by UUID NOT NULL REFERENCES app_user(id),
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_special_price_positive CHECK (unit_price > 0),
    CONSTRAINT ck_special_price_dates CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT ck_special_price_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX idx_special_price_resolution ON customer_special_price(customer_id, product_presentation_id, valid_from, valid_to);

CREATE TABLE discount_request (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requested_by UUID NOT NULL REFERENCES app_user(id),
    approved_by UUID REFERENCES app_user(id),
    customer_id UUID NOT NULL REFERENCES customer(id),
    product_presentation_id UUID NOT NULL REFERENCES product_presentation(id),
    normal_price NUMERIC(14,2) NOT NULL,
    requested_price NUMERIC(14,2) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'REQUESTED',
    expires_at TIMESTAMPTZ NOT NULL,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_discount_prices CHECK (normal_price > 0 AND requested_price > 0 AND requested_price < normal_price),
    CONSTRAINT ck_discount_status CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'EXPIRED'))
);

CREATE INDEX idx_discount_request_status_expiry ON discount_request(status, expires_at);
