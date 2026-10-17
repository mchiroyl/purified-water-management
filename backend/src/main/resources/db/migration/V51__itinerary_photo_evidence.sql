-- V51: Evidencia fotográfica y auditoría para aplazamientos / bloqueos de paradas en recorridos
ALTER TABLE daily_itinerary_stop
    ADD COLUMN IF NOT EXISTS evidence_photo TEXT,
    ADD COLUMN IF NOT EXISTS evidence_photo_captured_at TIMESTAMPTZ;

COMMENT ON COLUMN daily_itinerary_stop.evidence_photo IS 'Fotografía de evidencia (Base64 o URI) capturada en sitio ante un bloqueo vial o impedimento de acceso.';
COMMENT ON COLUMN daily_itinerary_stop.evidence_photo_captured_at IS 'Marca de tiempo en la que se tomó la fotografía de evidencia satelital.';
