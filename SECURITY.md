# Política de seguridad — Sistema Agua Pura

## Alcance


## Reportar una vulnerabilidad

No publique secretos, tokens, datos de clientes, dumps ni pruebas explotables en issues públicos. Entregue un informe privado al responsable del repositorio con descripción/impacto, versión o commit, pasos mínimos reproducibles sin datos reales y evidencia sanitizada.

Si el repositorio tiene un canal de seguridad del proveedor Git, use ese canal. Para una instalación local, entregue el informe al propietario/administrador de la purificadora.

## Principios obligatorios

- secretos en gestor seguro/variables de entorno, nunca en Git;
- Argon2id, JWT corto, refresh HttpOnly rotativo y revocable;
- usuario, dispositivo, estado y roles revalidados en cada petición;
- rate limit y respuestas genéricas de login;
- PostgreSQL/backend sin puertos públicos en Compose;
- HTTPS, HSTS y `COOKIE_SECURE=true` en producción;
- CSP, `nosniff`, `frame-ancestors 'none'`, CORS exacto y límites de cuerpo/colección;
- auditoría inmutable con correlación y sin datos sensibles;
- datos offline aislados por usuario/dispositivo y sin credenciales persistentes;
- servidor autoritativo para precio, crédito, total, inventario, numeración e idempotencia;

## Datos sensibles


## Respuesta a incidentes

1. Revocar usuario/dispositivo y rotar secretos comprometidos.
2. Preservar logs/auditoría y correlation IDs sin alterar evidencia.
3. Aislar el servicio afectado y detener exposición pública si procede.
4. Comprobar integridad de PostgreSQL, archivos y backups.
5. Restaurar solo desde conjunto verificado y probado.
6. Documentar alcance, causa, corrección y pruebas de no regresión.
7. Notificar a las partes afectadas según la obligación aplicable.

## Dependencias y cambios

Las versiones se fijan en Maven/npm/Docker. Antes de actualizar una dependencia, ejecute pruebas backend/frontend/E2E, revise cambios de seguridad y regenere imágenes. Una migración Flyway aplicada no se edita.

## Verificación

La fase 31 incluyó un escaneo de seguridad y remediación de secretos, puertos, rate limiting, refresh, autorización, límites, aislamiento móvil, TLS y auditoría. La evidencia de ejecución y las pruebas de regresión están descritas en `docs/PLAN_IMPLEMENTACION.md` y `docs/MANUAL_TECNICO.md`.
