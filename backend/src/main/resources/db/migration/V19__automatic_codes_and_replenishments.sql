-- Los códigos operativos son asignados por el servidor. Los códigos históricos
-- se conservan y únicamente se usan para posicionar las secuencias nuevas.
CREATE SEQUENCE customer_code_seq START WITH 1;
CREATE SEQUENCE seller_code_seq START WITH 1;
CREATE SEQUENCE route_code_seq START WITH 1;
CREATE SEQUENCE vehicle_code_seq START WITH 1;

SELECT setval('customer_code_seq', COALESCE((
    SELECT MAX(substring(code FROM 5)::BIGINT) + 1
    FROM customer
    WHERE code ~ '^CLI-[0-9]+$'
), 1), false);

SELECT setval('seller_code_seq', COALESCE((
    SELECT MAX(substring(code FROM 5)::BIGINT) + 1
    FROM seller
    WHERE code ~ '^VND-[0-9]+$'
), 1), false);

SELECT setval('route_code_seq', COALESCE((
    SELECT MAX(substring(code FROM 5)::BIGINT) + 1
    FROM route
    WHERE code ~ '^RUT-[0-9]+$'
), 1), false);

SELECT setval('vehicle_code_seq', COALESCE((
    SELECT MAX(substring(code FROM 5)::BIGINT) + 1
    FROM vehicle
    WHERE code ~ '^VEH-[0-9]+$'
), 1), false);

ALTER TABLE route_load
    ADD COLUMN load_type VARCHAR(20) NOT NULL DEFAULT 'INITIAL';

ALTER TABLE route_load
    ADD CONSTRAINT ck_route_load_type CHECK (load_type IN ('INITIAL', 'REPLENISHMENT'));

DROP INDEX IF EXISTS uq_route_load_open_route;
CREATE UNIQUE INDEX uq_route_load_open_initial_route ON route_load(route_id)
    WHERE load_type = 'INITIAL' AND status IN ('PREPARED','WAREHOUSE_CONFIRMED','RECEIVED','STARTED');

CREATE INDEX idx_route_load_route_type_status
    ON route_load(route_id, load_type, status, planned_date DESC);
