-- Migration V54: Soporte de Ventas Directas en Mostrador / Despacho en Planta y Atribución a Cargas

-- 1. Agregar origin_type a sale ('ROUTE' o 'DIRECT_OFFICE')
ALTER TABLE sale ADD COLUMN IF NOT EXISTS origin_type VARCHAR(20) NOT NULL DEFAULT 'ROUTE';
ALTER TABLE sale ADD CONSTRAINT ck_sale_origin_type CHECK (origin_type IN ('ROUTE', 'DIRECT_OFFICE'));

-- 2. Permitir que route_id y seller_id sean NULL únicamente cuando la venta es de tipo DIRECT_OFFICE
ALTER TABLE sale ALTER COLUMN route_id DROP NOT NULL;
ALTER TABLE sale ALTER COLUMN seller_id DROP NOT NULL;

-- 3. Invariante de coherencia de origen
ALTER TABLE sale ADD CONSTRAINT ck_sale_origin_fields CHECK (
    (origin_type = 'ROUTE' AND route_id IS NOT NULL AND seller_id IS NOT NULL)
    OR (origin_type = 'DIRECT_OFFICE' AND route_id IS NULL AND route_load_id IS NULL)
);

-- 4. Índices para acelerar reportes y consultas por tipo de origen y carga
CREATE INDEX IF NOT EXISTS idx_sale_origin_type_date ON sale(origin_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_route_load_id ON sale(route_load_id) WHERE route_load_id IS NOT NULL;

-- 5. Asegurar un cliente predeterminado para ventas de mostrador / consumidor final si no existe
INSERT INTO customer (id, code, name, normalized_name, address_reference, customer_type, status, registration_state)
VALUES ('00000000-0000-0000-0000-000000000001', 'CLI-MOSTRADOR', 'Consumidor Final (Mostrador)', 'CONSUMIDOR FINAL MOSTRADOR', 'Venta directa en oficina/planta', 'OCCASIONAL', 'ACTIVE', 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

