-- Aumenta la precisión de lat/lon de 7 a 8 decimales (~1.1 mm → ~1.1 mm ya cubre GPS diferencial).
-- NUMERIC(12,8) da 4 dígitos enteros + 8 decimales, suficiente para cualquier coordenada WGS-84.
ALTER TABLE route_tracking_point
    ALTER COLUMN latitude  TYPE NUMERIC(12,8),
    ALTER COLUMN longitude TYPE NUMERIC(12,8);
