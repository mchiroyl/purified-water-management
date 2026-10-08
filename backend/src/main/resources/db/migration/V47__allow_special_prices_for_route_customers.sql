-- Permitir y normalizar precios especiales para clientes creados en ruta por el vendedor
-- Promueve clientes activos que cuenten con precios especiales asignados a PERMANENT y ACTIVE
UPDATE customer
SET customer_type = 'PERMANENT',
    registration_state = 'ACTIVE',
    updated_at = now()
WHERE id IN (SELECT DISTINCT customer_id FROM customer_special_price)
  AND status = 'ACTIVE'
  AND (customer_type <> 'PERMANENT' OR registration_state <> 'ACTIVE');

-- Asegura registro de aprobación en auditoría de revisiones para clientes con precio especial
INSERT INTO customer_registration_review (id, customer_id, decision, reviewed_by, reason)
SELECT gen_random_uuid(), c.id, 'APPROVED', c.created_by, 'Aprobado automáticamente por asignación de precio especial por la administración'
FROM customer c
JOIN customer_special_price sp ON sp.customer_id = c.id
WHERE NOT EXISTS (SELECT 1 FROM customer_registration_review cr WHERE cr.customer_id = c.id)
ON CONFLICT (customer_id) DO NOTHING;
