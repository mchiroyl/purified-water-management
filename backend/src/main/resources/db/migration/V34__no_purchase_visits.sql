-- Ampliar el CHECK de point_type para incluir NO_PURCHASE_VISIT
ALTER TABLE route_tracking_point
    DROP CONSTRAINT ck_route_tracking_point_type;

ALTER TABLE route_tracking_point
    ADD CONSTRAINT ck_route_tracking_point_type
        CHECK (point_type IN ('START', 'SALE', 'NO_PURCHASE_VISIT'));

-- Agregar customer_id para visitas sin compra (nullable, requerido en NO_PURCHASE_VISIT)
ALTER TABLE route_tracking_point
    ADD COLUMN customer_id UUID REFERENCES customer(id);

-- Agregar nota opcional para visitas sin compra
ALTER TABLE route_tracking_point
    ADD COLUMN visit_note VARCHAR(300);

-- Actualizar la restricción de sale_id: solo obliga sale_id en SALE
ALTER TABLE route_tracking_point
    DROP CONSTRAINT ck_route_tracking_point_sale;

ALTER TABLE route_tracking_point
    ADD CONSTRAINT ck_route_tracking_point_sale CHECK (
        (point_type = 'START'             AND sale_id IS NULL AND customer_id IS NULL) OR
        (point_type = 'SALE'              AND sale_id IS NOT NULL AND customer_id IS NULL) OR
        (point_type = 'NO_PURCHASE_VISIT' AND sale_id IS NULL AND customer_id IS NOT NULL)
    );

-- Índice para consultar visitas de un cliente específico
CREATE INDEX idx_route_tracking_customer ON route_tracking_point(customer_id)
    WHERE point_type = 'NO_PURCHASE_VISIT';
