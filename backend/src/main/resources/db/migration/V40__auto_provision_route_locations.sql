INSERT INTO inventory_location (id, code, name, location_type, route_id, active)
SELECT 
    gen_random_uuid(),
    'IR-' || COALESCE(NULLIF(regexp_replace(r.code, '^RUT-', ''), ''), substr(md5(random()::text), 1, 6)),
    'Inventario ' || r.name,
    'ROUTE',
    r.id,
    true
FROM route r
WHERE NOT EXISTS (
    SELECT 1 FROM inventory_location il WHERE il.route_id = r.id
)
ON CONFLICT (route_id) DO NOTHING;
