WITH ranked AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY presentation_type, content_quantity, content_unit, unit_id, conversion_factor
               ORDER BY created_at, id
           ) AS position
    FROM presentation_catalog
    WHERE active
)
UPDATE presentation_catalog pc
SET active = FALSE,
    updated_at = now()
FROM ranked
WHERE pc.id = ranked.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX uq_presentation_catalog_active_definition
    ON presentation_catalog (presentation_type, content_quantity, content_unit, unit_id, conversion_factor)
    WHERE active;
