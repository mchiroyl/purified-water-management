CREATE TABLE presentation_catalog (
    id UUID PRIMARY KEY,
    code VARCHAR(40) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    unit_id UUID NOT NULL REFERENCES unit_of_measure(id),
    conversion_factor NUMERIC(19, 6) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_presentation_catalog_code_upper CHECK (code = upper(code)),
    CONSTRAINT ck_presentation_catalog_factor_positive CHECK (conversion_factor > 0)
);

CREATE INDEX idx_presentation_catalog_search ON presentation_catalog(active, name, code);
