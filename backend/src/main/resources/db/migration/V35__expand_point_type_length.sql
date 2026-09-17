-- Ampliar longitud de point_type para soportar NO_PURCHASE_VISIT (17 caracteres)
ALTER TABLE route_tracking_point
    ALTER COLUMN point_type TYPE VARCHAR(30);
