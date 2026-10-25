-- V53: Índices para descarga eficiente de catálogos y paquetes de ruta offline
CREATE INDEX IF NOT EXISTS idx_customer_route_active
    ON customer(route_id, is_active)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_special_price_customer_status
    ON special_price(customer_id, status)
    WHERE status = 'ACTIVE';
