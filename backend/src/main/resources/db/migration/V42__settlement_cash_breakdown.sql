ALTER TABLE settlement
    ADD COLUMN IF NOT EXISTS sales_cash NUMERIC(18,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS credit_collections_cash NUMERIC(18,2) NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION protect_settlement() RETURNS trigger AS $$
BEGIN
    IF TG_OP='DELETE' THEN
        RAISE EXCEPTION 'settlements cannot be deleted' USING ERRCODE='55000';
    END IF;
    IF (NEW.id, NEW.route_load_id, NEW.route_id) IS DISTINCT FROM (OLD.id, OLD.route_load_id, OLD.route_id) THEN
        RAISE EXCEPTION 'settlement identity is immutable' USING ERRCODE='55000';
    END IF;
    IF OLD.status='CLOSED' THEN
        -- Permitir rectificación de efectivo entregado para liquidaciones con faltante
        IF NEW.delivered_cash >= OLD.delivered_cash 
           AND NEW.expected_cash = OLD.expected_cash 
           AND NEW.sales_total = OLD.sales_total
           AND NEW.physical_difference_total = OLD.physical_difference_total
           AND NEW.monetary_difference = (NEW.expected_cash - NEW.delivered_cash) THEN
            RETURN NEW;
        END IF;
        -- Permitir actualización de desglose contable sin alterar montos
        IF NEW.expected_cash = OLD.expected_cash 
           AND NEW.sales_total = OLD.sales_total 
           AND NEW.delivered_cash = OLD.delivered_cash THEN
            RETURN NEW;
        END IF;
        RAISE EXCEPTION 'closed settlements are immutable' USING ERRCODE='55000';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE settlement
SET sales_cash = expected_cash,
    credit_collections_cash = 0
WHERE sales_cash = 0 AND expected_cash > 0;
