-- El código visible de presentación es correlativo y es asignado únicamente por el servidor.
CREATE SEQUENCE presentation_code_seq START WITH 1;

SELECT setval('presentation_code_seq', COALESCE((
    SELECT MAX(substring(code FROM 5)::BIGINT) + 1
    FROM product_presentation
    WHERE code ~ '^PRE-[0-9]+$'
), 1), false);
