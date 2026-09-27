-- Eliminar asignaciones cerradas en la fecha actual o cuyas cargas estan liquidadas
DELETE FROM route_assignment
WHERE valid_to = current_date
   OR EXISTS (
       SELECT 1 FROM route_load rl
       WHERE rl.route_id = route_assignment.route_id
         AND rl.status = 'SETTLED'
   );
