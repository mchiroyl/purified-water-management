-- V46: Permitir anulación/eliminación de entregas de efectivo en liquidaciones no cerradas
CREATE OR REPLACE FUNCTION protect_cash_delivery() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- Si la liquidación de la carga ya está cerrada, no se puede eliminar ninguna entrega
        IF EXISTS (
            SELECT 1 FROM settlement s
            WHERE s.route_load_id = OLD.route_load_id AND s.status = 'CLOSED'
        ) THEN
            RAISE EXCEPTION 'cannot delete cash delivery of a closed settlement' USING ERRCODE='55000';
        END IF;
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'cash deliveries are immutable' USING ERRCODE='55000';
END;
$$ LANGUAGE plpgsql;
