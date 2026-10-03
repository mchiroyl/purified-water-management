# Fresh Water · Sistema de Gestión de Purificadora de Agua

## Propósito del Producto
Fresh Water es un sistema ERP operativo, logístico y de punto de venta (POS) móvil y web para empresas purificadoras y distribuidoras de agua envasada (Garrafón y Fardos). Gestiona el ciclo completo de despacho de camiones, ventas en calle, control de envases retornables en préstamo, cartera de créditos, conciliación bancaria y liquidación de jornadas de ruta.

## Plataforma
- **Tipo:** Web / PWA Responsive (Mobile-First para vendedores en calle; Desktop para administradores y bodega).
- **Moneda:** Quetzales (GTQ - Q).
- **Zona Horaria:** `America/Guatemala` (GMT-6).

## Usuarios Principales y Entornos de Uso
1. **Vendedor en Ruta (Móvil en calle):**
   - **Contexto:** Teléfonos inteligentes en condiciones de alta luminosidad ambiental (luz solar directa), movimiento en cabina o paradas rápidas.
   - **Tareas clave:** Consulta inmediata del stock restante a bordo del camión (Cargado - Vendido), registro ultra-rápido de ventas (al contado, crédito o transferencia), alta rápida de clientes provisionales, cobro de abonos y control de garrafones vacíos recibidos.
   - **Requisito UX:** Botones táctiles grandes para el pulgar, contraste visual alto, densidad de información compacta sin scroll innecesario, cero elementos distractores o infantiles.

2. **Administrador y Supervisor (Desktop/Tablet):**
   - **Contexto:** Oficina o despacho central.
   - **Tareas clave:** Monitoreo global de rutas en vivo, arqueo y corte de caja por ruta/vendedor, aprobación de transferencias y mermas, auditoría de precios y saldos de clientes.
   - **Requisito UX:** Tablas de alta densidad con filtros rápidos, estados claros y métricas financieras de precisión.

3. **Bodega (Móvil/Tablet en planta):**
   - **Contexto:** Área de carga y descarga de garrafones y fardos.
   - **Tareas clave:** Preparación y confirmación de cargas iniciales, recargas en ruta y recepción física de sobrantes y envases al cierre del día.

## Principios de Diseño Visual (Impeccable Standard)
- **Cero emojis en navegación y métricas operativas:** Reemplazados por iconos vectoriales SVG limpios y consistentes (estilo Lucide / Heroicons).
- **Densidad de datos:** Los inventarios y cortes de caja deben presentarse en tablas o bloques compactos organizados para lectura rápida, eliminando tarjetas gigantescas con exceso de espacio en blanco.
- **Tipografía y números:** Uso estricto de números tabulares (`font-feature-settings: 'tnum'`) para cifras financieras y conteos de inventario para que las columnas alineen con precisión contable.
- **Paleta corporativa sobria:** Tonos pizarra y marinos profesionales (`slate-900`, `slate-700`, `slate-50`), con acentos en esmeralda/verde sutil exclusivamente para estados positivos/confirmados y ámbar/rojo para alertas.
