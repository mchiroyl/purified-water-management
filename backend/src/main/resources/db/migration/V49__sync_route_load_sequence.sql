-- Sincronizar la secuencia route_load_number_seq con el valor maximo actual de load_number
-- para garantizar correlatividad estricta consecutiva y evitar huecos/saltos en cargas y recargas.
SELECT setval(
    'route_load_number_seq',
    GREATEST(COALESCE((SELECT MAX(load_number) FROM route_load), 0), 1),
    (SELECT EXISTS (SELECT 1 FROM route_load))
);
