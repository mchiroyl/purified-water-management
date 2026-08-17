ALTER TABLE presentation_catalog
    ADD COLUMN presentation_type VARCHAR(60) NOT NULL DEFAULT 'BOTELLA',
    ADD COLUMN content_quantity NUMERIC(13, 3) NOT NULL DEFAULT 1,
    ADD COLUMN content_unit VARCHAR(10) NOT NULL DEFAULT 'ML';

ALTER TABLE presentation_catalog
    ADD CONSTRAINT ck_presentation_catalog_content_quantity CHECK (content_quantity > 0),
    ADD CONSTRAINT ck_presentation_catalog_content_unit CHECK (content_unit IN ('ML','L','OZ','GALON'));
