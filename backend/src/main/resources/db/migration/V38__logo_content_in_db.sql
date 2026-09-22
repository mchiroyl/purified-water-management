-- Almacenar el contenido del logo directamente en la DB para que persista entre reinicios del servidor.
-- La columna es nullable: los file_objects de PDFs de recibos no necesitan content.
ALTER TABLE file_object ADD COLUMN content BYTEA;

-- Marcar el logo actual como DELETED porque el archivo físico ya no existe en el servidor
-- (Render elimina el filesystem local al reiniciar). El usuario deberá subirlo nuevamente.
UPDATE file_object
SET status = 'DELETED'
WHERE id IN (
    SELECT logo_file_id
    FROM company_configuration
    WHERE singleton_key AND logo_file_id IS NOT NULL
)
AND status = 'ACTIVE';
