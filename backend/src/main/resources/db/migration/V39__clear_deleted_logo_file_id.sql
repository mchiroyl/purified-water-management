-- Limpiar la referencia de logo_file_id si apunta a un archivo marcado como DELETED
UPDATE company_configuration
SET logo_file_id = NULL
WHERE singleton_key
  AND logo_file_id IN (
      SELECT id FROM file_object WHERE status = 'DELETED'
  );
