-- V52: Idempotencia estricta en ventas y soporte de sincronización de visitas sin compra
-- Previene duplicidades ante redes celulares inestables (1 o 2 barritas) y reintentos automáticos

-- 1. Unicidad estricta para evitar que una misma venta se inserte dos veces
CREATE UNIQUE INDEX IF NOT EXISTS uq_sale_device_client_reference
    ON sale(device_id, client_reference);

-- 2. Soporte de referencia de cliente en puntos de rastreo para visitas sin compra
ALTER TABLE route_tracking_point
    ADD COLUMN IF NOT EXISTS client_reference UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uq_route_tracking_device_client_ref
    ON route_tracking_point(device_id, client_reference)
    WHERE client_reference IS NOT NULL;
