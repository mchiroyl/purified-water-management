# PROMPT MAESTRO UNIFICADO — SISTEMA DE CONTROL DE VENTAS, RUTAS, INVENTARIO Y LIQUIDACIONES PARA DISTRIBUIDORA DE AGUA PURA

Actúa como un equipo profesional compuesto por:

- Arquitecto de Software Senior.
- Analista de Sistemas Senior.
- Desarrollador Backend Senior Java/Spring Boot.
- Desarrollador Frontend Senior React/TypeScript.
- Especialista en PostgreSQL.
- Especialista en aplicaciones PWA Offline-First.
- Especialista en ciberseguridad.
- Ingeniero DevOps.
- QA Automation Engineer.
- Diseñador UI/UX Mobile First.
- Technical Writer.

Todos con más de 10 años de experiencia.

Necesito que analices, diseñes, documentes, desarrolles, pruebes y dejes FUNCIONAL un sistema completo para una empresa dedicada a la distribución y venta de agua pura.

Este archivo es la fuente canónica de requisitos. Toda decisión, plan, caso de uso, módulo, prueba y documentación debe derivarse de este documento. No crear fases paralelas, módulos duplicados ni implementaciones distintas para una misma capacidad.

NO quiero únicamente ejemplos.

NO quiero únicamente una maqueta.

NO quiero únicamente código demostrativo.

NO quiero pseudocódigo como solución final.

Quiero un PROYECTO REAL, FUNCIONAL, DOCUMENTADO, PROBADO, DOCKERIZADO y listo para ejecutarse localmente.

Debes desarrollar el proyecto PASO A PASO.

No continúes a una fase posterior dejando errores conocidos en una fase anterior.

---

# 1. PROBLEMA QUE DEBE RESOLVER EL SISTEMA

Actualmente la empresa distribuye agua pura mediante:

- vendedores;
- rutas;
- vehículos;
- clientes;
- productos;
- diferentes presentaciones;
- ventas al detalle;
- ventas al mayoreo.

Existe riesgo de fuga de dinero y producto.

Ejemplo:

Un vendedor realmente vende:

Q600.00

pero reporta únicamente:

Q400.00

y entrega solamente Q400.00.

El propietario necesita determinar de manera independiente cuánto producto recibió el vendedor, cuánto vendió, cuánto regresó y cuánto dinero debería entregar.

El sistema NO debe confiar únicamente en la declaración del vendedor.

Debe realizar conciliación mediante:

CARGA
+
VENTAS
+
PAGOS
+
DEVOLUCIONES
+
MERMAS APROBADAS
+
INVENTARIO
+
LIQUIDACIÓN.

---

# 2. OBJETIVO GENERAL

Desarrollar una aplicación web empresarial PWA que permita controlar completamente:

- vendedores;
- usuarios;
- permisos;
- rutas;
- clientes;
- clientes ocasionales;
- clientes provisionales;
- productos;
- presentaciones;
- inventario;
- cargas de ruta;
- precios;
- precios mayoristas;
- precios especiales;
- ventas;
- pagos;
- efectivo;
- transferencias;
- créditos;
- devoluciones;
- mermas;
- incidencias;
- autorizaciones;
- anulaciones;
- liquidaciones;
- auditoría;
- sincronización offline;
- comprobantes digitales;
- configuración empresarial;
- facturación FEL opcional;
- reportes;
- dashboard.

El sistema administrará una sola empresa purificadora de agua.

NO implementar multitenencia.

La identidad empresarial debe ser configurable y nunca quedar escrita directamente en el código.

---

# 3. RESTRICCIÓN: SISTEMA 100 % DIGITAL

NO utilizar:

- papel;
- talonarios;
- hojas de liquidación;
- formularios impresos;
- impresoras;
- comprobantes físicos.

Todo debe permanecer digital.

El comprobante para el cliente será:

PDF DIGITAL.

El PDF debe poder compartirse principalmente mediante:

WHATSAPP.

No depender de una impresora.

---

# 4. PWA

El frontend obligatoriamente debe desarrollarse como:

Progressive Web App — PWA.

Debe ser:

- Responsive.
- Mobile First.
- Instalable.
- Compatible con teléfono.
- Compatible con tablet.
- Compatible con computadora.
- Utilizable desde navegador.
- Preparada para Android.
- Preparada para iPhone/iOS según capacidades permitidas por navegador.
- Capaz de trabajar sin conexión.

La experiencia principal del vendedor será desde su teléfono.

---

# 5. TECNOLOGÍAS OBLIGATORIAS

## BACKEND

Utilizar:

- Java.
- Spring Boot.
- Spring Security.
- JWT.
- Spring Validation / Jakarta Bean Validation.
- JPA/Hibernate.
- PostgreSQL.
- Flyway.
- Maven.
- OpenAPI/Swagger.
- Docker.

Utilizar versiones estables y mantenidas.

Nunca utilizar versiones obsoletas solamente porque aparecen en ejemplos antiguos.

## FRONTEND

Utilizar:

- React.
- TypeScript.
- PWA.
- Service Worker.
- IndexedDB.
- Mobile First.
- Responsive Design.
- TanStack Query o alternativa profesional.
- React Hook Form o equivalente profesional.
- Zod o esquema equivalente para validaciones.
- Cliente HTTP centralizado.
- Gestión profesional de errores.
- Gestión del estado de conexión.
- Gestión de sincronización offline.

## INFRAESTRUCTURA

Utilizar:

- Docker.
- Docker Compose.
- PostgreSQL en contenedor para desarrollo local.

---

# 6. ESTRUCTURA GENERAL

Separar completamente:

```text
proyecto/
│
├── backend/
│
├── frontend/
│
├── docs/
│
├── diagrams/
│
├── docker-compose.yml
├── .env.example
├── README.md
└── .gitignore
```

---

# 7. CLEAN ARCHITECTURE BACKEND

Utilizar exactamente como base:

```text
src/main/java/<paquete_base>/
│
├── domain/
│   ├── entities/
│   ├── enums/
│   ├── interfaces/
│   ├── exceptions/
│   └── valueobjects/
│
├── application/
│   ├── services/
│   ├── usecases/
│   ├── dto/
│   ├── commands/
│   └── queries/
│
├── infrastructure/
│   ├── database/
│   ├── repositories/
│   ├── security/
│   ├── configuration/
│   ├── synchronization/
│   ├── storage/
│   └── pdf/
│
└── presentation/
    ├── controllers/
    ├── validators/
    └── advice/
```

Respetar responsabilidades.

DOMAIN:

reglas fundamentales del negocio.

APPLICATION:

casos de uso.

INFRASTRUCTURE:

implementaciones externas.

PRESENTATION:

API REST.

No colocar lógica de negocio importante en Controllers.

Implementar el backend como un MONOLITO MODULAR desplegable en una sola aplicación Spring Boot.

NO dividir en microservicios.

Dentro de cada capa, separar los módulos por capacidad de negocio.

Una regla de negocio debe tener una única implementación autoritativa y reutilizable.

---

# 8. FRONTEND ORGANIZADO

Crear estructura profesional.

Ejemplo conceptual:

```text
src/
│
├── app/
├── components/
├── features/
│   ├── auth/
│   ├── company-configuration/
│   ├── users/
│   ├── products/
│   ├── prices/
│   ├── customers/
│   ├── routes/
│   ├── inventory/
│   ├── sales/
│   ├── waste/
│   ├── settlements/
│   ├── synchronization/
│   └── reports/
│
├── hooks/
├── services/
├── storage/
├── sync/
├── validation/
├── types/
├── utils/
└── pwa/
```

No crear componentes gigantes.

Diseñar la experiencia por rol:

- vendedor: navegación Mobile First orientada a ruta, venta y sincronización;
- bodega: formularios táctiles para carga, recepción, devoluciones y mermas;
- administrador/supervisor: navegación adaptable para dashboard, catálogos, revisiones, reportes y configuración.

Los datos de identidad empresarial deben editarse en un único formulario y consumirse desde una única fuente de estado/API.

---

# 9. ROLES

Implementar RBAC.

Como mínimo:

ADMINISTRADOR / PROPIETARIO

BODEGA

VENDEDOR

SUPERVISOR

---

# 10. ADMINISTRADOR / PROPIETARIO

Puede:

- configurar los datos e identidad de la empresa;
- administrar la configuración FEL opcional;
- administrar usuarios;
- vendedores;
- productos;
- presentaciones;
- precios;
- reglas de mayoreo;
- precios especiales;
- rutas;
- clientes;
- crédito;
- inventario;
- vendedores por ruta;
- validar clientes provisionales;
- verificar transferencias;
- revisar mermas;
- aprobar operaciones cuando corresponda;
- revisar diferencias;
- revisar liquidaciones;
- consultar dashboard;
- consultar auditoría;
- generar reportes;
- desactivar usuarios;
- revocar dispositivos.

---

# 11. BODEGA

Puede:

- preparar carga;
- entregar carga;
- registrar producto entregado;
- confirmar producto devuelto;
- recibir sobrantes;
- verificar productos dañados;
- revisar mermas;
- aprobar mermas dentro del límite permitido por política;
- aprobar parcialmente;
- rechazar mermas;
- realizar conciliación física.

No debe poder cambiar precios.

No debe poder alterar ventas.

---

# 12. VENDEDOR

Puede:

- consultar su ruta;
- consultar clientes de su ruta;
- consultar inventario de ruta;
- confirmar carga;
- iniciar ruta;
- registrar ventas;
- registrar cliente ocasional;
- crear cliente provisional;
- registrar pagos;
- registrar mermas;
- registrar devoluciones permitidas;
- consultar ventas propias;
- consultar sincronización;
- finalizar recorrido.

NO puede:

- modificar precios;
- definir descuentos;
- aprobar descuentos;
- aprobar mermas;
- eliminar ventas;
- modificar liquidaciones;
- cambiar ventas de otros vendedores;
- acceder a rutas ajenas;
- conceder crédito no autorizado;
- validar transferencias;
- convertir una merma pendiente en aprobada.

---

# 13. AUTORIZACIÓN A NIVEL DE OBJETO

No basta verificar:

ROLE_VENDOR.

También verificar propiedad del recurso.

Ejemplo:

Vendedor A:

GET /sales/venta-vendedor-B

debe responder:

403 Forbidden.

Aplicar protección contra:

BOLA / IDOR.

---

# 14. SEGURIDAD

Aplicar seguridad desde el diseño.

Tomar como referencia:

OWASP ASVS.

OWASP Top 10.

OWASP API Security Top 10.

Implementar como mínimo:

- Spring Security.
- JWT de corta duración.
- Refresh tokens.
- Rotación de refresh tokens.
- Revocación.
- RBAC.
- autorización a nivel recurso.
- rate limiting.
- protección fuerza bruta.
- bloqueo temporal por intentos.
- HTTPS obligatorio en producción.
- HSTS.
- CSP.
- headers de seguridad.
- CORS con allowlist.
- validación Content-Type.
- protección XSS.
- prevención SQL Injection.
- prevención Mass Assignment.
- límites de request.
- límites para archivos.
- sanitización donde aplique.
- logs de seguridad.
- auditoría.

Nunca confiar en datos calculados por frontend.

---

# 15. CONTRASEÑAS

Nunca guardar en texto plano.

Utilizar Argon2id mediante un PasswordEncoder compatible con Spring Security.

Ajustar sus parámetros al entorno para que la verificación sea deliberadamente costosa sin provocar denegación de servicio.

Documentar el algoritmo y permitir migración futura mediante DelegatingPasswordEncoder o mecanismo equivalente.

Nunca almacenar password en:

- localStorage;
- IndexedDB;
- logs.

Nunca devolver hashes al frontend.

---

# 16. TOKENS

NO almacenar refresh token inseguramente en localStorage.

El access token debe ser corto y mantenerse solamente en memoria del frontend.

El refresh token debe ser opaco, rotativo, almacenado como hash en servidor y asociado a usuario, sesión y dispositivo.

Si arquitectura web lo permite, utilizar:

Secure
HttpOnly
SameSite

para refresh session.

JWT Access Token debe ser corto.

Implementar revocación.

Detectar reutilización de refresh token y revocar la familia de sesión comprometida.

Proteger los endpoints que usan cookie mediante validación de origen y protección CSRF apropiada.

---

# 17. VALIDACIÓN EN CADA CAMPO

TODOS los datos deben validarse en:

1. frontend;
2. DTO backend;
3. dominio;
4. base de datos.

Para cada campo establecer:

- requerido;
- opcional;
- longitud mínima;
- longitud máxima;
- tipo;
- formato;
- rango;
- caracteres permitidos;
- reglas de negocio.

Nunca confiar únicamente en:

required HTML.

---

# 18. DINERO

PROHIBIDO utilizar:

float
double

para dinero.

Backend:

BigDecimal.

PostgreSQL:

NUMERIC / DECIMAL.

Definir correctamente precisión y escala.

---

# 19. IDENTIFICADORES

Preferiblemente utilizar:

UUID.

Especialmente para:

- ventas;
- clientes;
- operaciones offline;
- mermas;
- pagos;
- dispositivos;
- sincronización.

---

# 20. PRODUCTOS

Producto:

- UUID;
- código;
- nombre;
- descripción;
- unidad base;
- activo;
- controla inventario;
- timestamps.

No hacer DELETE físico de productos con historial.

Utilizar activo/inactivo.

---

# 21. PRESENTACIONES

Este requisito es obligatorio debido a las mermas.

Separar:

PRODUCTO

de:

PRESENTACIÓN.

Ejemplo:

Producto:

Agua pura 600 ml.

Unidad base:

BOTELLA.

Presentaciones:

Unidad = 1 botella.

Fardo x12 = 12 botellas.

Fardo x24 = 24 botellas.

Crear conceptos:

PRODUCT
UNIT_OF_MEASURE
PRODUCT_PRESENTATION
PRESENTATION_CONVERSION

Las conversiones deben poder utilizarse para:

- inventario;
- ventas;
- carga;
- devoluciones;
- mermas;
- reportes.

---

# 22. PRECIOS

Los vendedores NUNCA escriben directamente precios.

Crear:

PRICE_LIST

PRICE_VERSION

PRICE_TIER

CUSTOMER_SPECIAL_PRICE

o diseño equivalente.

Ejemplo:

1–5 unidades = Q12.

6–10 = Q11.

11–20 = Q10.

21+ = Q9.

La PWA puede calcular para experiencia de usuario.

Pero el backend SIEMPRE vuelve a calcular.

---

# 23. VERSIONADO DE PRECIOS

Una modificación futura de precios NO puede modificar ventas anteriores.

Cada venta debe almacenar:

- precio utilizado;
- versión;
- regla;
- fecha;
- cantidad.

---

# 24. PRECIOS ESPECIALES

Cliente determinado puede tener precio especial.

Debe configurarlo usuario autorizado.

Vendedor no lo puede modificar.

Offline:

la PWA utiliza únicamente precios especiales previamente descargados y vigentes.

---

# 25. DESCUENTOS EXTRAORDINARIOS

Crear flujo:

REQUESTED
APPROVED
REJECTED
EXPIRED

Registrar:

- solicitante;
- cliente;
- producto;
- precio normal;
- descuento;
- motivo;
- aprobador;
- fecha.

Si está OFFLINE:

NO permitir nuevos descuentos que requieran autorización en tiempo real.

---

# 26. CLIENTES

Datos mínimos:

- UUID;
- código;
- nombre/nombre comercial;
- contacto;
- teléfono;
- WhatsApp;
- referencia/dirección;
- tipo;
- ruta;
- estado;
- crédito permitido;
- límite;
- saldo;
- timestamps.

Aplicar minimización de datos.

---

# 27. CLIENTE OCASIONAL

El vendedor puede encontrarse durante ruta con una persona que solamente desea comprar.

Ejemplo:

“Véndame un fardo de agua.”

No obligar a convertirlo en cliente permanente.

Permitir:

CLIENTE OCASIONAL.

Solicitar únicamente información necesaria.

Si desea PDF por WhatsApp:

solicitar número.

No otorgar crédito.

No precio especial.

Precio normal/mayoreo automático.

---

# 28. CLIENTE PROVISIONAL OFFLINE

Si desea convertirse en cliente:

permitir crear CLIENTE PROVISIONAL incluso sin Internet.

Generar:

localCustomerUuid.

Guardar:

- nombre;
- teléfono;
- WhatsApp;
- referencia;
- vendedor actual;
- ruta actual;
- dispositivo;
- timestamp.

Estado:

PROVISIONAL_LOCAL.

Puede comprar inmediatamente.

---

# 29. RESTRICCIONES CLIENTE PROVISIONAL

Puede:

- comprar;
- recibir precio normal;
- recibir precio de mayoreo automático;
- pagar efectivo.

Transferencia:

PENDING_VERIFICATION.

NO puede:

- comprar crédito;
- recibir precio personalizado nuevo;
- recibir descuento manual;
- saltarse reglas comerciales.

---

# 30. SINCRONIZACIÓN CLIENTE PROVISIONAL

Flujo:

PROVISIONAL_LOCAL
↓
PENDING_SYNC
↓
PENDING_REVIEW
↓
ADMINISTRADOR
↓
ACTIVE / MERGED / REJECTED_FOR_REGISTRATION

Una venta realizada nunca debe desaparecer aunque no se apruebe posteriormente el alta permanente.

---

# 31. DUPLICADOS DE CLIENTES

Detectar potenciales duplicados.

Utilizar:

- teléfono normalizado;
- WhatsApp;
- nombre normalizado;
- otras reglas razonables.

No fusionar registros dudosos automáticamente.

Crear proceso:

MERGE CUSTOMER.

Registrar auditoría.

---

# 32. RUTAS

RUTA:

- UUID;
- código;
- nombre;
- descripción;
- estado.

Crear historial de asignación:

ROUTE_ASSIGNMENT.

Nunca sobrescribir historial.

---

# 33. CARGA DE RUTA

Antes de salir:

Bodega registra producto.

Ejemplo:

Carlos.

Ruta 03.

Garrafones: 100.

Fardos: 30.

Crear:

ROUTE_LOAD.

ROUTE_LOAD_ITEM.

---

# 34. DOBLE CONFIRMACIÓN DE CARGA

Bodega:

CONFIRMAR ENTREGA.

Vendedor:

CONFIRMAR RECEPCIÓN.

Guardar:

- usuario;
- fecha/hora servidor;
- dispositivo;
- cantidades.

Una vez iniciada ruta, no permitir editar silenciosamente la carga.

Cualquier corrección necesita transacción compensatoria/auditoría.

---

# 35. PWA OFFLINE-FIRST

Antes de iniciar ruta descargar:

- clientes;
- ruta;
- productos;
- presentaciones;
- inventario asignado;
- precios;
- versiones;
- reglas de mayoreo;
- precios especiales vigentes;
- límites de crédito autorizados;
- configuración.

Guardar datos de negocio en:

IndexedDB.

---

# 36. NO DESCARGAR INFORMACIÓN INNECESARIA

Un vendedor no debe obtener:

- clientes de otro vendedor;
- rutas ajenas;
- información administrativa;
- ventas de otros vendedores.

Aplicar principio de mínimo privilegio.

---

# 37. ESTADO DE CONEXIÓN

No depender exclusivamente de:

navigator.onLine.

Crear:

ConnectionManager.

Estados:

UNKNOWN
CHECKING
OFFLINE
DEGRADED
ONLINE.

Implementar endpoint backend:

GET /api/connectivity

o equivalente.

Respuesta pequeña.

Cache-Control: no-store.

Utilizar timeout.

---

# 38. NETWORK INFORMATION API

Si está disponible puede utilizarse únicamente como información auxiliar.

NO hacerla obligatoria.

No basar reglas críticas en “barras de señal”.

---

# 39. CUÁNDO COMPROBAR CONEXIÓN

Como mínimo:

- al iniciar PWA;
- al volver al foreground;
- evento online;
- antes de sync;
- después de error;
- reintentos controlados;
- botón manual.

No realizar polling excesivo.

---

# 40. SYNC ENGINE

Crear componente independiente:

SyncEngine.

IndexedDB:

OUTBOX.

Cada operación:

clientOperationId UUID.

Campos conceptuales:

clientOperationId
deviceId
entityType
operationType
payload
createdAtLocal
status
retryCount
lastError
dependencies

Guardar el cambio de negocio local y su entrada OUTBOX dentro de una única transacción IndexedDB.

No permitir una operación local persistida sin su evento de sincronización correspondiente.

---

# 41. ESTADOS DE SINCRONIZACIÓN

PENDING

SYNCING

SYNCED

FAILED_RETRYABLE

CONFLICT

REJECTED

Mostrar en UI.

---

# 42. IDEMPOTENCIA

OBLIGATORIO.

Todo evento crítico offline debe tener:

clientOperationId.

Backend debe tener una restricción única equivalente a:

device_id + client_operation_id.

Ejemplo:

teléfono manda venta.

Servidor guarda venta.

Respuesta se pierde.

Teléfono reenvía.

Resultado:

NO DUPLICAR.

Backend devuelve la operación existente.

El backend debe almacenar el resultado original de la operación idempotente y devolverlo en reintentos sin repetir efectos secundarios.

---

# 43. SINCRONIZACIÓN POR BATCH

Crear endpoint similar:

POST /api/sync/batch.

Enviar lotes pequeños.

Resultado individual:

ACCEPTED
ALREADY_PROCESSED
REJECTED
CONFLICT
RETRY.

No considerar todo batch exitoso si existen fallos parciales.

---

# 44. ORDEN DE SINCRONIZACIÓN

Respetar dependencias.

Ejemplo:

CREATE_PROVISIONAL_CUSTOMER
↓
CREATE_SALE
↓
CREATE_PAYMENT.

Utilizar UUID para mantener referencias.

---

# 45. REINTENTOS

Utilizar:

Exponential Backoff + Jitter.

Reintentar:

- evento online;
- abrir aplicación;
- foreground;
- botón sync;
- Background Sync si está soportado.

Background Sync debe ser mejora progresiva, no dependencia obligatoria.

---

# 46. VENTAS

Flujo:

Cliente.
↓
Producto.
↓
Presentación.
↓
Cantidad.
↓
Precio automático.
↓
Pago.
↓
Confirmación.
↓
UUID.
↓
Persistencia local/servidor.

---

# 47. VENTA INMUTABLE

Después de confirmar una venta:

NO permitir modificar directamente.

Para errores:

SOLICITAR ANULACIÓN / CORRECCIÓN.

Registrar auditoría.

No hacer DELETE.

---

# 48. PAGOS

Soportar:

EFECTIVO.

TRANSFERENCIA.

CRÉDITO.

---

# 49. TRANSFERENCIAS

Estados:

PENDING_VERIFICATION
VERIFIED
REJECTED.

Registrar:

- monto;
- referencia;
- banco si aplica;
- evidencia opcional.

El vendedor no puede validar su transferencia.

---

# 50. CRÉDITO

Solo para clientes previamente autorizados.

Controlar:

- límite;
- saldo;
- disponible.

Cliente provisional:

CRÉDITO PROHIBIDO.

---

# 51. INVENTARIO DE RUTA

Ejemplo:

Carga:

100.

Venta:

10.

Disponible:

90.

No permitir vender:

100 adicionales.

Frontend valida.

Backend vuelve a validar.

---

# 52. MERMAS

REQUISITO CRÍTICO DE SEGURIDAD.

Una merma es pérdida FÍSICA de producto.

Ejemplos:

- garrafón quebrado;
- botella dañada;
- fardo reventado;
- bolsa rota;
- derrame;
- producto contaminado;
- daño durante transporte.

Una merma NUNCA representa dinero.

---

# 53. MERMA NO PUEDE TAPAR FALTANTES DE DINERO

Regla obligatoria:

Una merma NO debe:

- descontar efectivo esperado;
- alterar una venta registrada;
- reducir ventas;
- cambiar Q600 a Q400;
- eliminar diferencias monetarias.

Merma afecta únicamente:

CONCILIACIÓN FÍSICA.

---

# 54. FLUJO DE MERMA

PRODUCTO DAÑADO
↓
VENDEDOR REPORTA
↓
PENDING
↓
SINCRONIZAR
↓
PENDING_REVIEW
↓
BODEGA REVISA
↓
APPROVED / PARTIALLY_APPROVED / REJECTED.

El vendedor nunca aprueba su propia merma.

---

# 55. MERMAS OFFLINE

Si no hay Internet:

permitir registrar.

Guardar:

- UUID;
- ruta;
- vendedor;
- producto;
- presentación;
- unidades afectadas;
- motivo;
- fotografía;
- timestamp local;
- dispositivo.

Estado:

LOCAL_PENDING.

Después sync:

PENDING_REVIEW.

Nunca APPROVED automáticamente.

---

# 56. EVIDENCIA DE MERMA

Permitir fotografías.

Definir según tipo de merma si la evidencia es:

- requerida;
- recomendada;
- no requerida.

Bodega revisa posteriormente.

No permitir foto como único mecanismo automático de aprobación.

---

# 57. MERMA TOTAL Y PARCIAL

Ejemplo:

Fardo contiene 24 botellas.

Se rompe fardo.

Solo 3 botellas están dañadas.

Entonces:

unidades afectadas = 3.

NO:

24 automáticamente.

Registrar:

Presentación afectada: fardo x24.

Unidades dañadas: 3.

Unidades recuperables: 21.

---

# 58. APROBACIÓN PARCIAL

Ejemplo:

Vendedor reporta:

5 botellas.

Bodega aprueba:

2.

Resultado:

Merma aprobada = 2.

Diferencia física pendiente = 3.

No desaparecer las otras 3.

---

# 59. MERMA PENDIENTE NO CUADRA

Una merma reportada pero no aprobada NO puede utilizarse para cerrar inventario.

Ejemplo:

Carga 100.

Ventas 60.

Devueltos 35.

Merma reportada 5.

Merma aprobada 0.

Mostrar:

Diferencia provisional = 5.

No:

“Cuadrado”.

---

# 60. CONTROL DE MERMAS SOSPECHOSAS

Crear indicadores:

- merma por vendedor;
- porcentaje de merma;
- merma por ruta;
- merma por producto;
- merma por presentación;
- merma por vehículo;
- frecuencia;
- valor estimado;
- tipos recurrentes.

Crear alertas configurables.

Ejemplo:

más de X mermas diarias.

más del X % de carga.

múltiples mermas consecutivas.

No concluir automáticamente fraude.

Crear alerta para investigación.

---

# 61. SEGREGACIÓN DE FUNCIONES EN MERMAS

Permitir configurar niveles.

Ejemplo:

Merma pequeña:

Bodega.

Merma media:

Bodega + Supervisor.

Merma extraordinaria:

Bodega + Administrador.

Nunca vendedor + vendedor.

---

# 62. CATÁLOGO DE MERMAS

Crear:

WASTE_TYPE.

Configurable.

Ejemplos:

GARRAFON_QUEBRADO.

FARDO_REVENTADO.

BOTELLA_DAÑADA.

DERRAME.

ENVASE_PERFORADO.

BOLSA_ROTA.

CONTAMINACION.

DAÑO_TRANSPORTE.

OTRO.

---

# 63. EVIDENCIAS

No guardar archivos grandes directamente en tablas PostgreSQL salvo justificación técnica.

Utilizar abstracción de storage.

En desarrollo local puede existir almacenamiento local compatible.

Preparar arquitectura para Object Storage en producción.

Validar:

- MIME real;
- tamaño;
- extensión permitida;
- nombre generado;
- permisos;
- acceso.

---

# 64. DEVOLUCIONES

Separar conceptualmente:

PRODUCTO NO VENDIDO.

DEVOLUCIÓN DE CLIENTE.

MERMA.

FALTANTE.

No mezclar.

---

# 65. CONCILIACIÓN FÍSICA

La fórmula central será:

CARGA INICIAL
-
UNIDADES VENDIDAS
-
PRODUCTO BUENO DEVUELTO
-
MERMA APROBADA
=
DIFERENCIA FÍSICA.

Ideal:

0.

---

# 66. CONCILIACIÓN FINANCIERA

Separada completamente:

VENTAS EN EFECTIVO
-
EFECTIVO ENTREGADO
=
DIFERENCIA MONETARIA.

Además considerar:

- transferencias verificadas;
- créditos autorizados;
- otros medios válidos.

---

# 67. EJEMPLO ANTIFRAUDE

Ventas registradas:

Q600 efectivo.

Efectivo entregado:

Q400.

Aunque tenga una merma legítima:

DIFERENCIA MONETARIA:

-Q200.

La merma NO elimina esos Q200.

---

# 68. LIQUIDACIÓN

Crear:

SETTLEMENT.

Estados:

PENDING
READY
WITH_DIFFERENCE
BALANCED
CLOSED.

Mostrar:

- ventas;
- efectivo esperado;
- efectivo entregado;
- transferencias;
- créditos;
- carga;
- devoluciones;
- mermas aprobadas;
- diferencia física;
- diferencia monetaria.

---

# 69. NO CERRAR CON OPERACIONES OFFLINE

Si existen:

ventas pendientes;

pagos pendientes;

clientes pendientes de enviar;

mermas pendientes de enviar;

devoluciones pendientes;

no permitir cierre DEFINITIVO.

Mostrar:

“Existen operaciones pendientes de sincronización.”

---

# 70. COMPROBANTE DIGITAL

Crear un único menú:

CONFIGURACIÓN
→
DATOS DE LA EMPRESA.

El formulario debe incluir:

- nombre comercial;
- razón social;
- NIT;
- dirección;
- teléfonos;
- WhatsApp;
- correo electrónico;
- logotipo;
- moneda;
- zona horaria;
- prefijos y numeraciones de comprobantes internos;
- información adicional autorizada para documentos.

Estos datos constituyen la única fuente de verdad para la identidad mostrada por el sistema y para todos los comprobantes.

NO crear otro formulario separado con datos duplicados para comprobantes.

Después de venta sincronizada generar:

PDF.

Debe contener:

- empresa;
- número venta;
- fecha;
- cliente;
- vendedor;
- productos;
- presentación;
- cantidad;
- precio;
- subtotal;
- descuentos autorizados;
- total;
- método pago;
- estado.

El PDF generado sin certificación FEL es un COMPROBANTE INTERNO y no debe presentarse como Documento Tributario Electrónico certificado.

## FEL OPCIONAL

Contemplar Factura Electrónica en Línea de Guatemala como integración opcional.

La configuración FEL debe estar en un apartado independiente debido a sus permisos, credenciales y reglas propias, pero debe reutilizar directamente los datos de la empresa.

Mientras no exista un certificador seleccionado:

- FEL permanece desactivado;
- no permitir activarlo;
- no simular certificación;
- no utilizar un proveedor ficticio;
- los comprobantes internos PDF continúan funcionando.

Cuando se seleccione un certificador autorizado:

- implementar un adaptador real contra su contrato oficial;
- validar credenciales antes de habilitar;
- registrar solicitud, respuesta, identificadores, estado y errores de certificación;
- conservar el DTE certificado y su trazabilidad;
- no exponer credenciales en frontend, logs, PDF ni auditoría.

Tomar como referencia normativa y técnica oficial:

- https://portal.sat.gob.gt/portal/efactura/
- https://portal.sat.gob.gt/portal/emisor-de-dte/
- https://portal.sat.gob.gt/portal/certificador-de-dte/
- https://portal.sat.gob.gt/portal/documentacion-tecnica-del-regimen-fel

---

# 71. WHATSAPP

Objetivo:

COMPARTIR PDF POR WHATSAPP.

Utilizar Web Share API cuando exista soporte.

Implementar fallback apropiado.

No utilizar APIs privadas/no oficiales.

Si está offline:

guardar comprobante como pendiente.

Una vez vuelva Internet:

permitir generar/obtener comprobante oficial y compartir.

---

# 72. NUMERACIÓN DE VENTAS

Offline:

UUID/local reference.

Después sync:

número oficial asignado por servidor.

Ejemplo:

Local:

7f513...

Oficial:

V-2026-000123.

Mantener ambos para trazabilidad.

La numeración configurable corresponde a comprobantes internos.

Para FEL, utilizar exclusivamente los identificadores y autorizaciones devueltos por el proceso real de certificación. Nunca fabricar una autorización fiscal mediante una secuencia local.

---

# 73. DISPOSITIVOS

Registrar:

DEVICE.

Campos:

UUID.

userId.

nombre amigable.

firstSeen.

lastSeen.

status.

appVersion.

Estados:

PENDING
ACTIVE
REVOKED.

Permitir revocar.

---

# 74. AUDITORÍA

Crear:

AUDIT_LOG.

Registrar:

- usuario;
- acción;
- entidad;
- entityId;
- before;
- after;
- fecha servidor;
- dispositivo;
- correlationId;
- IP cuando corresponda.

No registrar secretos.

---

# 75. EVENTOS A AUDITAR

Como mínimo:

LOGIN.

LOGIN_FAILED.

LOGOUT.

CREATE_USER.

ROLE_CHANGE.

PRICE_CHANGE.

CREATE_ROUTE_LOAD.

CONFIRM_ROUTE_LOAD.

CREATE_SALE.

ANNULMENT_REQUEST.

ANNULMENT_APPROVED.

CREATE_WASTE.

APPROVE_WASTE.

PARTIAL_WASTE_APPROVAL.

REJECT_WASTE.

SETTLEMENT_CLOSE.

CUSTOMER_MERGE.

DEVICE_REVOKED.

SYNC.

---

# 76. FECHAS

Servidor utiliza:

UTC.

Frontend muestra zona configurada.

Para offline guardar:

createdAtLocal.

Servidor:

receivedAtServer.

syncedAtServer.

No confiar únicamente en hora del teléfono.

---

# 77. BASE DE DATOS

Diseñar profesionalmente.

Analizar como mínimo:

USER
ROLE
USER_ROLE
REFRESH_SESSION
DEVICE

COMPANY_CONFIGURATION
FEL_CONFIGURATION
FEL_DOCUMENT

SELLER

ROUTE
ROUTE_ASSIGNMENT

CUSTOMER
CUSTOMER_ROUTE
CUSTOMER_SPECIAL_PRICE

PRODUCT
UNIT_OF_MEASURE
PRODUCT_PRESENTATION
PRESENTATION_CONVERSION

PRICE_LIST
PRICE_VERSION
PRICE_TIER

INVENTORY
INVENTORY_MOVEMENT

ROUTE_LOAD
ROUTE_LOAD_ITEM

SALE
SALE_ITEM

PAYMENT

CREDIT_ACCOUNT
CREDIT_MOVEMENT

RETURN
RETURN_ITEM

WASTE
WASTE_ITEM
WASTE_TYPE
WASTE_EVIDENCE
WASTE_REVIEW

SETTLEMENT

INCIDENT

AUTHORIZATION

ANNULMENT_REQUEST

SYNC_OPERATION

AUDIT_LOG.

Revisar si alguna entidad debe dividirse o unificarse.

No crear tablas solamente porque aparecen en esta lista si técnicamente existe un mejor diseño.

Documentar decisión.

---

# 78. INTEGRIDAD BASE DE DATOS

Aplicar:

PRIMARY KEY.

FOREIGN KEY.

NOT NULL.

UNIQUE.

CHECK.

INDEX.

Optimizar índices según consultas reales.

No agregar índices indiscriminadamente.

---

# 79. TRANSACCIONES ACID

Operaciones críticas deben ejecutarse dentro de transacciones.

Ejemplo:

venta
+
detalles
+
pago
+
movimientos inventario.

Si falla:

ROLLBACK.

---

# 80. CONCURRENCIA

Controlar:

- inventario;
- crédito;
- liquidaciones;
- aprobaciones;
- sincronización;
- precios.

Utilizar:

optimistic locking / pessimistic locking

según corresponda.

Documentar decisión.

---

# 81. SOFT DELETE / INMUTABILIDAD

Información financiera o histórica no debe eliminarse físicamente.

Utilizar estados.

No permitir borrar:

- ventas;
- liquidaciones;
- pagos;
- mermas;
- movimientos inventario;
- auditoría.

---

# 82. DASHBOARD

Administrador debe ver como mínimo:

VENTAS DE HOY.

EFECTIVO ESPERADO.

EFECTIVO ENTREGADO.

TRANSFERENCIAS.

CRÉDITO.

DIFERENCIAS MONETARIAS.

DIFERENCIAS DE INVENTARIO.

MERMAS.

MERMAS PENDIENTES.

CLIENTES PROVISIONALES.

TRANSFERENCIAS PENDIENTES.

RUTAS ACTIVAS.

RUTAS FINALIZADAS.

OPERACIONES OFFLINE PENDIENTES.

---

# 83. REPORTES

Crear reportes por:

- vendedor;
- ruta;
- cliente;
- producto;
- presentación;
- fecha;
- forma de pago;
- merma;
- diferencia;
- crédito;
- transferencia.

Filtros:

hoy.

semana.

mes.

rango personalizado.

---

# 84. ALERTAS

Crear alertas para:

- faltante efectivo;
- faltante inventario;
- merma elevada;
- merma recurrente;
- demasiadas anulaciones;
- descuentos frecuentes;
- transferencia pendiente;
- sync pendiente demasiado tiempo;
- ruta sin cerrar;
- conflicto offline;
- intento de acceso prohibido.

---

# 85. MANEJO GLOBAL DE ERRORES

Crear GlobalExceptionHandler.

Formato consistente:

code

message

correlationId

timestamp.

fieldErrors cuando existan errores por campo.

No devolver stacktrace al cliente.

---

# 86. LOGGING

Logs estructurados.

Correlation ID.

No registrar:

- passwords;
- access tokens;
- refresh tokens;
- secretos;
- datos sensibles innecesarios.

---

# 87. FLYWAY

TODOS los cambios BD:

Flyway.

No utilizar:

ddl-auto=create

en producción.

---

# 88. SWAGGER / OPENAPI

Documentar:

- endpoints;
- request;
- response;
- seguridad;
- roles;
- códigos HTTP;
- errores;
- idempotency;
- paginación.

---

# 89. DOCKER

Crear:

Dockerfile backend.

Dockerfile frontend.

docker-compose.yml.

Servicios:

postgres.

backend.

frontend.

El frontend debe servirse mediante Nginx o servidor web equivalente preparado para PWA y fallback de rutas SPA.

Agregar:

healthcheck.

Volúmenes.

Networks.

Variables entorno.

---

# 90. .ENV

Crear:

.env.example.

Nunca subir secretos reales.

Documentar cada variable.

---

# 91. PRUEBAS BACKEND

Crear Unit Tests.

Como mínimo:

- cálculo precio;
- mayoreo;
- precio especial;
- stock;
- venta;
- liquidación;
- merma;
- aprobación parcial;
- crédito;
- cliente provisional;
- idempotencia;
- autorización.

---

# 92. TESTCONTAINERS

Para integración PostgreSQL utilizar Testcontainers cuando corresponda.

No usar únicamente H2 si oculta diferencias reales con PostgreSQL.

---

# 93. PRUEBAS FRONTEND

Crear:

component tests.

validation tests.

hooks tests.

sync tests.

IndexedDB/Outbox tests.

company configuration tests.

receipt data source tests.

---

# 94. PRUEBAS E2E

Crear flujo completo.

Escenario:

1. Administrador inicia sesión.
2. Crea productos.
3. Configura presentaciones.
4. Configura precios.
5. Crea vendedor.
6. Crea ruta.
7. Asigna clientes.
8. Bodega crea carga.
9. Vendedor confirma.
10. Inicia ruta.
11. Registra venta.
12. Pierde Internet.
13. Registra venta offline.
14. Crea cliente provisional.
15. Registra venta a cliente provisional.
16. Registra merma offline.
17. Cierra/reabre PWA.
18. Datos continúan.
19. Regresa Internet.
20. Sincronización.
21. No existen duplicados.
22. Admin revisa cliente.
23. Bodega revisa merma.
24. Registra devolución.
25. Liquida.
26. Comprueba diferencias.
27. Genera PDF.
28. Comparte comprobante.

Además comprobar:

- el administrador configura los datos de la empresa una sola vez;
- la interfaz y el PDF utilizan esa misma configuración;
- el PDF interno no se identifica como DTE certificado;
- FEL no puede activarse sin un adaptador real y credenciales válidas.

---

# 95. PRUEBA ANTIFRAUDE

Escenario obligatorio:

Carga:

100 unidades.

Ventas físicas registradas correctamente.

Ventas efectivas:

Q600.

Efectivo entregado:

Q400.

El vendedor registra merma.

Resultado esperado:

Merma afecta únicamente inventario.

DIFERENCIA MONETARIA:

Q200 FALTANTE.

La merma NO puede eliminarla.

---

# 96. PRUEBA MERMA FALSA

Vendedor reporta:

5 unidades dañadas.

Bodega solamente aprueba:

2.

Resultado:

Merma válida:

2.

Diferencia física:

3.

No desaparecer inventario.

---

# 97. PRUEBA DE IDEMPOTENCIA

Enviar la misma venta 5 veces con mismo:

clientOperationId.

Resultado:

una única venta.

un único movimiento inventario.

un único pago.

---

# 98. PRUEBA DE SEGURIDAD

Probar:

SQL Injection.

XSS.

BOLA/IDOR.

Mass Assignment.

JWT inválido.

JWT expirado.

Refresh reutilizado.

Manipulación de precio.

Manipulación de total.

Manipulación del campo role.

Manipulación estado merma.

Cantidad negativa.

Stock negativo.

UUID duplicado.

Request enorme.

Rate Limit.

---

# 99. DIAGRAMAS OBLIGATORIOS

Crear carpeta:

docs/diagrams/

Generar los siguientes diagramas.

Utilizar Mermaid, PlantUML o formato equivalente mantenible en texto.

Además exportar a PNG/SVG cuando sea práctico.

---

# 100. DIAGRAMA DE CONTEXTO

Mostrar:

Sistema.

Propietario.

Administrador.

Vendedor.

Bodega.

Supervisor.

Cliente.

WhatsApp/dispositivo.

Base de datos.

Servicios externos cuando corresponda.

---

# 101. DIAGRAMA DE CASOS DE USO

Crear casos de uso separados por actor.

ADMINISTRADOR.

BODEGA.

VENDEDOR.

SUPERVISOR.

CLIENTE cuando corresponda.

---

# 102. CASOS DE USO DOCUMENTADOS

No solamente el dibujo.

Crear documento para cada caso importante:

CU-001 Iniciar sesión.

CU-002 Preparar carga.

CU-003 Confirmar carga.

CU-004 Iniciar ruta.

CU-005 Registrar venta.

CU-006 Registrar venta offline.

CU-007 Crear cliente provisional.

CU-008 Registrar cliente ocasional.

CU-009 Registrar merma.

CU-010 Revisar merma.

CU-011 Registrar devolución.

CU-012 Sincronizar.

CU-013 Liquidar ruta.

CU-014 Compartir comprobante.

CU-015 Autorizar descuento.

CU-016 Validar transferencia.

CU-017 Anular venta.

CU-018 Fusionar cliente.

Agregar los que sean necesarios.

Cada caso debe contener:

- ID.
- Nombre.
- Actor.
- Objetivo.
- Precondiciones.
- Flujo principal.
- Flujos alternos.
- Excepciones.
- Postcondiciones.
- Reglas negocio.
- Seguridad.
- Validaciones.

---

# 103. DIAGRAMA DE ARQUITECTURA

Mostrar:

Frontend PWA.

Backend REST.

PostgreSQL.

IndexedDB.

Service Worker.

Sync Engine.

Storage.

PDF.

Seguridad.

Docker.

---

# 104. DIAGRAMA CLEAN ARCHITECTURE

Mostrar claramente:

Presentation
↓
Application
↓
Domain.

Infrastructure implementando contratos del dominio/aplicación.

Indicar regla de dependencias.

---

# 105. DIAGRAMA DE COMPONENTES

Incluir:

Company Configuration.

Auth.

Users.

Customers.

Routes.

Products.

Pricing.

Inventory.

Sales.

Payments.

Credits.

Waste/Mermas.

Settlements.

Synchronization.

Auditing.

Reports.

PDF.

FEL Adapter.

---

# 106. DIAGRAMA ENTIDAD RELACIÓN

Generar ERD completo PostgreSQL.

Mostrar:

PK.

FK.

cardinalidades.

relaciones.

No omitir tablas importantes.

---

# 107. DIAGRAMA DE CLASES / DOMINIO

Mostrar principales agregados y relaciones.

No limitarse a clases JPA.

Representar dominio real.

---

# 108. DIAGRAMA DE SECUENCIA — VENTA ONLINE

Vendedor
→ PWA
→ API
→ Pricing
→ Inventory
→ Sale
→ Payment
→ Database.

---

# 109. DIAGRAMA DE SECUENCIA — VENTA OFFLINE

Vendedor
→ PWA
→ IndexedDB
→ Outbox
→ ConnectionManager
→ SyncEngine
→ Backend
→ PostgreSQL.

Mostrar idempotencia.

---

# 110. DIAGRAMA DE SECUENCIA — CLIENTE PROVISIONAL

Crear offline.

Venta.

Sync cliente.

Sync venta.

Admin valida.

---

# 111. DIAGRAMA DE SECUENCIA — MERMA

Vendedor registra.

Offline/online.

Sync.

Bodega revisa.

Aprueba parcial/total/rechaza.

Conciliación.

---

# 112. DIAGRAMA DE SECUENCIA — LIQUIDACIÓN

Carga.

Ventas.

Devoluciones.

Mermas.

Pagos.

Cálculos.

Resultado.

Cierre.

---

# 113. DIAGRAMA DE ACTIVIDAD — RUTA

Desde preparación hasta liquidación.

---

# 114. DIAGRAMA DE ESTADO — VENTA

LOCAL_PENDING.

SYNCING.

SYNCED.

ANNULMENT_REQUESTED.

ANNULLED.

etc.

---

# 115. DIAGRAMA DE ESTADO — MERMA

LOCAL_PENDING.

PENDING_SYNC.

PENDING_REVIEW.

APPROVED.

PARTIALLY_APPROVED.

REJECTED.

---

# 116. DIAGRAMA DE ESTADO — CLIENTE PROVISIONAL

PROVISIONAL_LOCAL.

PENDING_SYNC.

PENDING_REVIEW.

ACTIVE.

MERGED.

REJECTED.

---

# 117. DIAGRAMA DE ESTADO — LIQUIDACIÓN

PENDING.

READY.

WITH_DIFFERENCE.

BALANCED.

CLOSED.

---

# 118. DIAGRAMA DE DESPLIEGUE

Mostrar desarrollo local:

Navegador/PWA.

Frontend container.

Backend container.

PostgreSQL container.

Docker Network.

Volumes.

---

# 119. DIAGRAMA DE FLUJO DE SINCRONIZACIÓN

Explicar:

Outbox.

Conexión.

Batch.

Idempotencia.

ACK.

Retry.

Conflict.

---

# 120. MATRIZ DE PERMISOS

Crear tabla:

ROL vs OPERACIÓN.

Ejemplo:

| Operación | Admin | Bodega | Vendedor | Supervisor |
|---|---|---|---|---|
| Crear venta | Sí | No | Sí | No |
| Cambiar precio | Sí | No | No | No |
| Reportar merma | Sí | Sí | Sí | Sí |
| Aprobar merma | Sí | Sí* | No | Sí* |

Documentar restricciones.

---

# 121. MATRIZ DE REQUISITOS

Crear:

RF-001...

Requisitos funcionales.

RNF-001...

Requisitos no funcionales.

RB-001...

Reglas del negocio.

SEC-001...

Requisitos de seguridad.

---

# 122. REQUISITOS NO FUNCIONALES

Documentar:

Seguridad.

Disponibilidad.

Rendimiento.

Usabilidad.

Mobile First.

Offline.

Escalabilidad.

Mantenibilidad.

Auditabilidad.

Integridad.

Recuperación.

Compatibilidad.

---

# 123. MANUAL DE USUARIO

Crear:

docs/MANUAL_USUARIO.md

y preferentemente versión PDF final.

Debe ser entendible para persona no técnica.

Incluir:

1. Introducción.
2. Acceso al sistema.
3. Instalar PWA.
4. Iniciar sesión.
5. Perfil Administrador y configuración de datos de la empresa.
6. Crear vendedor.
7. Crear usuario.
8. Crear producto.
9. Crear presentación.
10. Crear precios.
11. Crear ruta.
12. Registrar cliente.
13. Asignar cliente.
14. Crear carga.
15. Confirmar carga.
16. Iniciar ruta.
17. Registrar venta.
18. Registrar cliente ocasional.
19. Registrar cliente provisional.
20. Venta sin Internet.
21. Interpretar estado conexión.
22. Sincronización.
23. Registrar merma.
24. Tomar evidencia.
25. Revisar merma.
26. Registrar devolución.
27. Liquidar ruta.
28. Interpretar faltantes.
29. Generar comprobante.
30. Compartir PDF por WhatsApp.
31. Validar transferencia.
32. Crédito.
33. Reportes.
34. Auditoría.
35. Cerrar sesión.
36. Preguntas frecuentes.
37. Errores comunes.
38. FEL opcional y diferencia entre comprobante interno y DTE certificado.

Utilizar capturas cuando el sistema esté terminado.

---

# 124. MANUAL TÉCNICO

Crear:

docs/MANUAL_TECNICO.md

Debe incluir:

- arquitectura;
- tecnologías;
- módulos;
- configuración empresarial;
- comprobantes internos y FEL opcional;
- seguridad;
- base de datos;
- API;
- PWA;
- IndexedDB;
- Service Worker;
- sincronización;
- idempotencia;
- Docker;
- testing;
- migraciones;
- backups;
- logging;
- monitoreo;
- troubleshooting.

---

# 125. MANUAL PARA LEVANTAR EL SISTEMA POR PRIMERA VEZ LOCALMENTE

Crear:

docs/INSTALACION_LOCAL_PRIMERA_VEZ.md

Debe explicar PASO A PASO desde una computadora nueva.

Orientar principalmente a:

Windows 10/11.

También indicar diferencias básicas para Linux/macOS si corresponde.

---

# 126. PRERREQUISITOS PARA INSTALACIÓN LOCAL

Documentar instalación/verificación de:

Git.

Docker Desktop.

Docker Compose.

Navegador moderno.

Opcionalmente:

Java JDK.

Maven.

Node.js.

npm.

Explicar cuáles son obligatorios si se utiliza Docker y cuáles solamente se necesitan para desarrollo fuera de contenedores.

---

# 127. COMANDOS DE VERIFICACIÓN

Ejemplos:

```bash
git --version
docker --version
docker compose version
java -version
mvn -version
node --version
npm --version
```

No asumir que están instalados.

---

# 128. CLONAR PROYECTO

Documentar:

```bash
git clone <URL>
cd <PROYECTO>
```

---

# 129. VARIABLES ENTORNO

Explicar:

copiar:

.env.example

a:

.env.

Indicar todas las variables.

NO incluir secretos reales.

Las credenciales FEL solamente deben configurarse cuando exista un proveedor real.

No guardar credenciales FEL en variables expuestas al frontend ni documentar valores reales.

---

# 130. LEVANTAR PRIMERA VEZ

Debe poder realizarse idealmente con:

```bash
docker compose up -d --build
```

Documentar exactamente:

1. abrir Docker Desktop;
2. verificar Docker;
3. clonar;
4. entrar carpeta;
5. copiar .env;
6. configurar variables;
7. ejecutar Docker Compose;
8. esperar healthchecks;
9. consultar logs;
10. comprobar PostgreSQL;
11. comprobar backend;
12. comprobar frontend;
13. abrir navegador.

---

# 131. MIGRACIONES PRIMERA VEZ

Flyway debe ejecutar migraciones automáticamente al iniciar backend.

Documentar cómo comprobar versión.

---

# 132. USUARIO ADMINISTRADOR INICIAL

Implementar mecanismo seguro.

NO hardcodear contraseña conocida universalmente.

Utilizar variables entorno, bootstrap controlado o mecanismo equivalente.

Documentar:

cómo crear primer administrador.

Obligar a cambiar contraseña inicial cuando sea apropiado.

---

# 133. URLS LOCALES

Documentar claramente.

Ejemplo conceptual:

Frontend:

http://localhost:<puerto>

Backend:

http://localhost:<puerto>

Swagger:

http://localhost:<puerto>/swagger-ui/...

PostgreSQL:

localhost:<puerto>.

Utilizar los puertos reales que se configuren.

---

# 134. VERIFICACIÓN POST-INSTALACIÓN

Crear checklist:

- [ ] PostgreSQL healthy.
- [ ] Backend healthy.
- [ ] Frontend disponible.
- [ ] Login administrador.
- [ ] Migraciones aplicadas.
- [ ] Crear producto prueba.
- [ ] Crear vendedor prueba.
- [ ] Crear ruta prueba.
- [ ] Crear venta prueba.

---

# 135. COMANDOS DOCKER ÚTILES

Documentar:

```bash
docker compose ps
docker compose logs
docker compose logs -f backend
docker compose restart backend
docker compose down
docker compose up -d
```

Diferenciar claramente:

docker compose down

de acciones destructivas como eliminar volúmenes.

Advertir antes de comandos que borren información.

---

# 136. BACKUP

Crear:

docs/BACKUP_RESTORE.md.

Explicar:

backup PostgreSQL.

restore PostgreSQL.

Backup no debe depender solamente del volumen Docker.

---

# 137. RESTAURACIÓN

Documentar paso a paso.

Probar si es posible.

---

# 138. MANUAL DESARROLLADOR

Crear:

docs/DEVELOPER_GUIDE.md.

Incluir:

- convenciones;
- branch strategy;
- commits;
- estructura;
- añadir endpoint;
- añadir migración;
- añadir caso uso;
- añadir módulo frontend;
- añadir prueba;
- ejecutar tests;
- debugging;
- seguridad.

---

# 139. DOCUMENTACIÓN DE API

OpenAPI.

Además crear:

docs/API.md.

Explicar autenticación.

Refresh.

Idempotency.

Errores.

Ejemplos.

---

# 140. README PRINCIPAL

README debe permitir que una persona entienda en menos de 10 minutos:

- qué hace sistema;
- alcance de una sola empresa;
- configuración empresarial y estado de FEL;
- arquitectura;
- tecnologías;
- cómo levantar;
- documentación;
- tests;
- estructura;
- seguridad;
- licencia si aplica.

---

# 141. PLAN DE DESARROLLO OBLIGATORIO

Trabajar en estas fases:

FASE 0
Análisis del repositorio.

FASE 1
Requisitos y reglas negocio.

FASE 2
Diagramas iniciales.

FASE 3
Arquitectura monolítica modular y estructura.

FASE 4
Docker.

FASE 5
Base datos + Flyway.

FASE 6
Seguridad/Auth.

FASE 7
Usuarios/Roles/Devices/Configuración empresarial.

FASE 8
Productos/Presentaciones.

FASE 9
Precios/Mayoreo.

FASE 10
Clientes/Rutas.

FASE 11
Inventario.

FASE 12
Carga de ruta.

FASE 13
Ventas online.

FASE 14
Pagos/Transferencias/Crédito.

FASE 15
PWA.

FASE 16
IndexedDB.

FASE 17
ConnectionManager.

FASE 18
SyncEngine.

FASE 19
Idempotencia.

FASE 20
Cliente ocasional/provisional.

FASE 21
Mermas.

FASE 22
Devoluciones.

FASE 23
Liquidaciones.

FASE 24
Autorizaciones/Incidencias.

FASE 25
Anulaciones.

FASE 26
Comprobantes PDF + FEL opcional, habilitable únicamente con proveedor real.

FASE 27
Compartir WhatsApp.

FASE 28
Dashboard.

FASE 29
Reportes.

FASE 30
Auditoría.

FASE 31
Hardening seguridad.

FASE 32
Pruebas E2E.

FASE 33
Diagramas finales actualizados.

FASE 34
Manual usuario.

FASE 35
Manual técnico.

FASE 36
Manual instalación local.

FASE 37
Backup/Restore.

FASE 38
Documentación final.

FASE 39
Verificación completa.

---

# 142. PROCEDIMIENTO DE CADA FASE

Para cada fase:

1. Analizar.
2. Explicar objetivo brevemente.
3. Identificar archivos.
4. Implementar.
5. Crear pruebas.
6. Ejecutar pruebas.
7. Revisar errores.
8. Corregir.
9. Ejecutar nuevamente.
10. Revisar seguridad.
11. Actualizar documentación.
12. Actualizar diagramas si corresponde.
13. Continuar.

---

# 143. NO DEJAR FUNCIONALIDADES FALSAS

No utilizar:

TODO.

FIXME.

stub.

mock permanente.

fake API.

botón sin funcionalidad.

datos hardcodeados como solución definitiva.

Si existe algo pendiente, solucionarlo antes de declarar proyecto terminado.

---

# 144. VERIFICACIÓN FINAL

Ejecutar:

backend tests.

frontend tests.

integration tests.

E2E.

security validations.

Docker build.

docker compose.

Verificar logs.

---

# 145. ESCENARIO FINAL DE ACEPTACIÓN 1

Bodega carga:

100 garrafones.

Vendedor vende:

60.

Regresa:

40.

Resultado:

Inventario cuadra.

---

# 146. ESCENARIO FINAL DE ACEPTACIÓN 2

Venta:

Q600 efectivo.

Entrega:

Q400.

Resultado:

FALTANTE Q200.

---

# 147. ESCENARIO FINAL DE ACEPTACIÓN 3

Carga:

100.

Ventas:

60.

Devolución:

38.

Merma aprobada:

2.

Resultado:

100 = 60 + 38 + 2.

Diferencia física:

0.

---

# 148. ESCENARIO FINAL DE ACEPTACIÓN 4

Merma reportada:

5.

Merma aprobada:

2.

Resultado:

3 unidades continúan como diferencia.

---

# 149. ESCENARIO FINAL DE ACEPTACIÓN 5

Sin Internet:

crear 3 ventas.

Cerrar PWA.

Abrir PWA.

Ventas continúan.

Volver Internet.

Sincronizar.

Resultado:

exactamente 3 ventas.

---

# 150. ESCENARIO FINAL DE ACEPTACIÓN 6

Cliente nuevo aparece sin señal.

Crear provisional.

Registrar compra.

Volver Internet.

Sync.

Admin revisa.

Venta no se pierde.

---

# 151. ESCENARIO FINAL DE ACEPTACIÓN 7

Mismo request enviado repetidamente.

Resultado:

una operación.

---

# 152. ESCENARIO FINAL DE ACEPTACIÓN 8

Vendedor manipula desde DevTools:

precio = Q1.

Backend:

rechaza/ignora.

Calcula precio correcto.

---

# 153. ESCENARIO FINAL DE ACEPTACIÓN 9

Vendedor intenta:

estadoMerma = APPROVED.

Backend:

403/400 según diseño.

Merma continúa pendiente.

---

# 154. ESCENARIO FINAL DE ACEPTACIÓN 10

Vendedor A solicita venta vendedor B.

Resultado:

403.

---

# 155. ESCENARIO FINAL DE ACEPTACIÓN 11

Existen operaciones pendientes offline.

Resultado:

liquidación no puede cerrarse definitivamente.

---

# 156. ESCENARIO FINAL DE ACEPTACIÓN 12

Venta completada y sincronizada.

Generar PDF.

Compartir por WhatsApp desde teléfono.

---

# 157. CRITERIOS DE TERMINADO

NO afirmar:

“sistema terminado”

hasta que:

- compile;
- backend inicie;
- frontend inicie;
- PostgreSQL funcione;
- migraciones funcionen;
- Docker funcione;
- login funcione;
- permisos funcionen;
- ventas funcionen;
- offline funcione;
- sincronización funcione;
- mermas funcionen;
- liquidaciones funcionen;
- PDF funcione;
- los datos de empresa sean configurables desde un único formulario;
- la interfaz y los comprobantes utilicen la misma configuración empresarial;
- FEL permanezca bloqueado sin proveedor o certifique mediante un proveedor real cuando esté configurado;
- tests pasen;
- diagramas existan;
- manuales existan;
- instalación local haya sido documentada.

---

# 158. RESULTADO QUE ESPERO

Al finalizar quiero recibir un repositorio profesional con:

```text
proyecto/
│
├── backend/
│
├── frontend/
│
├── docs/
│   ├── REQUISITOS.md
│   ├── REGLAS_NEGOCIO.md
│   ├── CASOS_DE_USO.md
│   ├── ARQUITECTURA.md
│   ├── API.md
│   ├── MANUAL_USUARIO.md
│   ├── MANUAL_TECNICO.md
│   ├── INSTALACION_LOCAL_PRIMERA_VEZ.md
│   ├── DEVELOPER_GUIDE.md
│   ├── BACKUP_RESTORE.md
│   └── SECURITY.md
│
├── diagrams/
│   ├── context/
│   ├── use-cases/
│   ├── architecture/
│   ├── erd/
│   ├── sequences/
│   ├── activities/
│   ├── states/
│   ├── components/
│   ├── deployment/
│   └── synchronization/
│
├── docker-compose.yml
├── .env.example
├── README.md
└── .gitignore
```

---

# 159. PRINCIPIOS INNEGOCIABLES

SERVER IS AUTHORITATIVE.

OFFLINE DOES NOT MEAN UNCONTROLLED.

NO PAPER.

NO PRINTER.

NO TRUST IN CLIENT INPUT.

NO HARD DELETE OF FINANCIAL HISTORY.

EVERY IMPORTANT ACTION IS AUDITABLE.

EVERY OFFLINE OPERATION HAS A UUID.

EVERY CRITICAL SYNC IS IDEMPOTENT.

EVERY PRICE IS VALIDATED BY BACKEND.

EVERY PERMISSION IS VALIDATED BY BACKEND.

EVERY MERMA REQUIRES CONTROL.

A SELLER NEVER APPROVES THEIR OWN WASTE/MERMA.

A MERMA NEVER REDUCES AN EXISTING FINANCIAL SHORTAGE.

EVERY MONEY VALUE USES BIGDECIMAL/NUMERIC.

EVERY DATABASE CHANGE USES MIGRATIONS.

EVERY IMPORTANT FEATURE HAS TESTS.

EVERY RELEASE MUST BE VERIFIABLE.

ONE COMPANY CONFIGURATION IS THE SINGLE SOURCE OF TRUTH.

AN INTERNAL RECEIPT IS NEVER PRESENTED AS A CERTIFIED FEL DOCUMENT.

---

# 160. INSTRUCCIÓN FINAL AL AGENTE

Empieza inspeccionando completamente el repositorio actual.

Si ya existe código:

NO lo destruyas innecesariamente.

Analiza:

- qué existe;
- qué funciona;
- qué se puede reutilizar;
- qué rompe los requisitos;
- qué necesita refactorización.

Antes de modificar, genera:

docs/ANALISIS_INICIAL.md.

Después crea:

docs/PLAN_IMPLEMENTACION.md.

Luego ejecuta las fases en orden.

El plan de implementación debe mapear exactamente las FASES 0 a 39 de este documento.

NO crear una segunda secuencia de fases.

NO implementar dos módulos, servicios o pantallas que resuelvan la misma función.

No me entregues solamente instrucciones para que yo programe.

TÚ debes crear y modificar los archivos reales del proyecto.

TÚ debes ejecutar los comandos disponibles.

TÚ debes ejecutar las pruebas.

TÚ debes corregir los errores encontrados.

TÚ debes actualizar documentación y diagramas conforme avance el desarrollo.

Nunca declares una funcionalidad terminada solamente porque escribiste código.

Debes comprobarla.

Cuando termines una fase muestra resumidamente:

FASE COMPLETADA: X

Archivos creados/modificados:

Pruebas ejecutadas:

Resultado:

Pendientes:

Siguiente fase:

Continúa hasta obtener el sistema completo.

El objetivo final es que una persona pueda descargar/clonar el repositorio en una computadora nueva, seguir:

docs/INSTALACION_LOCAL_PRIMERA_VEZ.md

y levantar todo el sistema localmente, preferiblemente mediante:

```bash
docker compose up -d --build
```

sin tener que adivinar configuraciones ni pasos faltantes.

El sistema final debe estar COMPLETO, SEGURO, DOCUMENTADO, PROBADO, DOCKERIZADO y LISTO PARA UTILIZARSE.
