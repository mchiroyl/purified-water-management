INSERT INTO role (id, code, name)
VALUES (gen_random_uuid(), 'ADMINISTRADOR_CREDITO', 'Administrador de Créditos')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE jug_loan_event (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id    UUID NOT NULL REFERENCES customer(id),
    route_id       UUID NOT NULL REFERENCES route(id),
    route_load_id  UUID REFERENCES route_load(id),
    sale_id        UUID REFERENCES sale(id),
    event_type     VARCHAR(30) NOT NULL,
    quantity       INT NOT NULL,
    unit_price     NUMERIC(14,2),
    notes          VARCHAR(500) NOT NULL DEFAULT '',
    registered_by  UUID NOT NULL REFERENCES app_user(id),
    device_id      UUID NOT NULL REFERENCES device(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT ck_jug_event_type CHECK (event_type IN ('LENT', 'RETURNED', 'CHARGED_LOSS', 'CHARGED_DAMAGE')),
    CONSTRAINT ck_jug_quantity CHECK (quantity > 0),
    CONSTRAINT ck_jug_charge_price CHECK (
        (event_type NOT LIKE 'CHARGED%' AND unit_price IS NULL) OR
        (event_type LIKE 'CHARGED%' AND unit_price > 0)
    )
);

CREATE INDEX idx_jug_loan_customer ON jug_loan_event(customer_id, created_at DESC);
CREATE INDEX idx_jug_loan_route ON jug_loan_event(route_id, created_at DESC);

CREATE VIEW customer_jug_balance AS
SELECT
    customer_id,
    route_id,
    SUM(CASE
        WHEN event_type = 'LENT' THEN quantity
        WHEN event_type IN ('RETURNED', 'CHARGED_LOSS', 'CHARGED_DAMAGE') THEN -quantity
        ELSE 0
    END) AS jugs_outstanding
FROM jug_loan_event
GROUP BY customer_id, route_id;

CREATE OR REPLACE FUNCTION reject_jug_loan_event_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'jug_loan_event rows are immutable';
END;
$$;

CREATE TRIGGER trg_jug_loan_event_immutable
BEFORE UPDATE OR DELETE ON jug_loan_event
FOR EACH ROW EXECUTE FUNCTION reject_jug_loan_event_mutation();
