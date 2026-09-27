-- Promueve a clientes con crédito autorizado por el administrador a PERMANENT y ACTIVE
UPDATE customer
SET customer_type = 'PERMANENT',
    registration_state = 'ACTIVE',
    updated_at = now()
WHERE credit_allowed = true AND customer_type <> 'PERMANENT';
