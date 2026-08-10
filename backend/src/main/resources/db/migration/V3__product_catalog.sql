CREATE TABLE unit_of_measure (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(80) NOT NULL,
    decimal_places SMALLINT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT ck_unit_code_upper CHECK (code = upper(code)),
    CONSTRAINT ck_unit_decimal_places CHECK (decimal_places BETWEEN 0 AND 6)
);

CREATE TABLE product (
    id UUID PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    description VARCHAR(500) NOT NULL DEFAULT '',
    base_unit_id UUID NOT NULL REFERENCES unit_of_measure(id),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    controls_inventory BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_product_code_upper CHECK (code = upper(code))
);

CREATE INDEX idx_product_active_name ON product(active, name);

CREATE TABLE product_presentation (
    id UUID PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES product(id),
    code VARCHAR(40) NOT NULL,
    name VARCHAR(120) NOT NULL,
    unit_id UUID NOT NULL REFERENCES unit_of_measure(id),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_product_presentation_code UNIQUE (product_id, code),
    CONSTRAINT ck_presentation_code_upper CHECK (code = upper(code))
);

CREATE INDEX idx_product_presentation_product_active ON product_presentation(product_id, active);

CREATE TABLE presentation_conversion (
    id UUID PRIMARY KEY,
    presentation_id UUID NOT NULL REFERENCES product_presentation(id),
    base_unit_id UUID NOT NULL REFERENCES unit_of_measure(id),
    conversion_factor NUMERIC(19, 6) NOT NULL,
    valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
    valid_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_conversion_factor_positive CHECK (conversion_factor > 0),
    CONSTRAINT ck_conversion_validity CHECK (valid_to IS NULL OR valid_to > valid_from),
    CONSTRAINT uq_conversion_version UNIQUE (presentation_id, valid_from)
);

CREATE UNIQUE INDEX uq_current_presentation_conversion
    ON presentation_conversion(presentation_id)
    WHERE valid_to IS NULL;

INSERT INTO unit_of_measure(code, name, decimal_places) VALUES
    ('UNIDAD', 'Unidad', 0),
    ('BOTELLA', 'Botella', 0),
    ('FARDO', 'Fardo', 0),
    ('GARRAFON', 'Garrafón', 0);
