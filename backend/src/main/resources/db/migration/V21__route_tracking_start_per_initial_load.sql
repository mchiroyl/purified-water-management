DROP INDEX uq_route_tracking_start;

CREATE UNIQUE INDEX uq_route_tracking_start ON route_tracking_point(route_load_id)
    WHERE point_type = 'START';
