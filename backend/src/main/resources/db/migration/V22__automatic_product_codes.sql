-- El código visible de producto es correlativo y es asignado únicamente por el servidor.
CREATE SEQUENCE product_code_seq START WITH 1;

SELECT setval('product_code_seq', COALESCE((
    SELECT MAX(substring(code FROM 5)::BIGINT) + 1
    FROM product
    WHERE code ~ '^PRD-[0-9]+$'
), 1), false);
