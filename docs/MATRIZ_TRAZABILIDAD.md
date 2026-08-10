# Matriz de trazabilidad inicial

| Requisitos | Fase | Módulo | Caso de uso principal | Evidencia de prueba |
|---|---:|---|---|---|
| RF-CFG | 7, 26 | company, receipts, fel | Configurar empresa / generar comprobante | API + formulario + PDF |
| RF-IAM, SEC-001–012 | 6, 7, 31 | auth, users, devices | CU-001 Iniciar sesión | Unit + integración + seguridad |
| RF-CAT | 8 | catalog | Gestionar producto/presentación | Dominio + API |
| RF-PRI | 9 | pricing | Configurar/resolver precio | Dominio + manipulación cliente |
| RF-CUS | 10, 20 | customers | CU-007, CU-008, CU-018 | API + IndexedDB + E2E |
| RF-RTE | 10, 12 | routes | Preparar recorrido | Autorización por objeto |
| RF-INV | 11 | inventory | Mover/consultar inventario | Integración + concurrencia |
| RF-LOD | 12 | route-loads | CU-002, CU-003 | API + doble confirmación |
| RF-SAL | 13, 25 | sales | CU-005, CU-006, CU-017 | ACID + E2E + BOLA |
| RF-PAY, RF-CRD | 14 | payments, credit | CU-016 / registrar pago | Integración + límites |
| RF-WST | 21 | waste | CU-009, CU-010 | Parcial + antifraude |
| RF-RET | 22 | returns | CU-011 | Movimientos + recepción |
| RF-SET | 23 | settlements | CU-013 | Escenarios físicos/monetarios |
| RF-SYN | 16–20 | storage, sync | CU-012 | Persistencia + idempotencia |
| RF-DOC, RF-FEL | 26, 27 | receipts, fel | CU-014 | PDF + share + bloqueo FEL |
| RF-REP, RF-ALT | 28, 29 | dashboard, reports | Consultar indicadores | Consultas + permisos |
| RF-AUD | 30 | audit | Consultar auditoría | Eventos + exclusión secretos |
| DAT-001–012 | 5, 16, 33, 37 | persistence | Migrar/respaldar | Flyway + IndexedDB + restore |
| RNF-001–012 | 3, 4, 15, 31–39 | plataforma | Instalación/operación | Build + Docker + E2E |

La matriz se ampliará con identificadores de endpoint, migración y nombre de prueba a medida que se implementen las fases, sin copiar la redacción completa del ERS/SRS.
