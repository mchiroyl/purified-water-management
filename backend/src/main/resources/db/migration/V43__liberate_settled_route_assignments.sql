-- Liberar asignaciones abiertas de rutas cuyas cargas ya fueron cerradas y liquidadas
UPDATE route_assignment ra
SET valid_to = current_date
WHERE ra.valid_to IS NULL
  AND EXISTS (
      SELECT 1 FROM route_load rl
      WHERE rl.route_id = ra.route_id
        AND rl.status = 'SETTLED'
  );
