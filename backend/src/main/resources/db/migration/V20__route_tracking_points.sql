CREATE TABLE route_tracking_point (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_load_id UUID NOT NULL REFERENCES route_load(id),
    route_id UUID NOT NULL REFERENCES route(id),
    sale_id UUID REFERENCES sale(id),
    point_type VARCHAR(10) NOT NULL,
    latitude NUMERIC(10,7) NOT NULL,
    longitude NUMERIC(10,7) NOT NULL,
    accuracy_meters NUMERIC(10,2),
    captured_at TIMESTAMPTZ NOT NULL,
    persisted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_id UUID NOT NULL REFERENCES app_user(id),
    device_id UUID NOT NULL REFERENCES device(id),
    CONSTRAINT ck_route_tracking_point_type CHECK (point_type IN ('START','SALE')),
    CONSTRAINT ck_route_tracking_point_latitude CHECK (latitude >= -90 AND latitude <= 90),
    CONSTRAINT ck_route_tracking_point_longitude CHECK (longitude >= -180 AND longitude <= 180),
    CONSTRAINT ck_route_tracking_point_accuracy CHECK (accuracy_meters IS NULL OR accuracy_meters >= 0),
    CONSTRAINT ck_route_tracking_point_sale CHECK (
        (point_type = 'START' AND sale_id IS NULL) OR
        (point_type = 'SALE' AND sale_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX uq_route_tracking_start ON route_tracking_point(route_id)
    WHERE point_type = 'START';
CREATE UNIQUE INDEX uq_route_tracking_sale ON route_tracking_point(sale_id)
    WHERE point_type = 'SALE';
CREATE INDEX idx_route_tracking_route_captured ON route_tracking_point(route_id, captured_at);
CREATE INDEX idx_route_tracking_load_captured ON route_tracking_point(route_load_id, captured_at);

CREATE OR REPLACE FUNCTION reject_route_tracking_point_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'route_tracking_point rows are immutable';
END;
$$;

CREATE TRIGGER trg_route_tracking_point_immutable
BEFORE UPDATE OR DELETE ON route_tracking_point
FOR EACH ROW EXECUTE FUNCTION reject_route_tracking_point_mutation();
