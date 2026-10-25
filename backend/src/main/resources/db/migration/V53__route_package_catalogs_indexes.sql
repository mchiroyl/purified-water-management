-- V53: Índices para descarga eficiente de catálogos y paquetes de ruta offline
CREATE INDEX IF NOT EXISTS idx_customer_route_open_assignment
    ON customer_route(route_id, customer_id)
    WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_active_lookup
    ON customer(id, status)
    WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_customer_special_price_active_status
    ON customer_special_price(customer_id, status)
    WHERE status = 'ACTIVE';

