# Fresh Water · Sistema de Diseño B2B (Impeccable Standard)

## Overview
Sistema de diseño empresarial para Fresh Water (ERP & POS Logístico de Purificadora de Agua). Prioriza alta legibilidad bajo luz solar en ruta, densidad de datos para operaciones rápidas, y una estética sobria y profesional inspirada en herramientas B2B de alto nivel (Linear, Stripe, Odoo).

## Tokens de Color
- **Fondo Base (`--bg`):** `#f8fafc` (Slate 50 neutro limpio).
- **Superficie de Tarjeta/Panel (`--surface`):** `#ffffff`.
- **Borde Primario (`--border`):** `#e2e8f0` (Slate 200).
- **Borde Sutil (`--border-subtle`):** `#f1f5f9` (Slate 100).
- **Texto Principal (`--text`):** `#0f172a` (Slate 900 alto contraste).
- **Texto Secundario/Muted (`--muted`):** `#64748b` (Slate 500).
- **Marca / Acción Primaria (`--primary`):** `#0f172a` (Pizarra profunda ejecutiva) con acento activo `#0284c7` (Azul agua/cian profesional).
- **Estados Semánticos:**
  - **Éxito / Confirmado / Stock:** `#047857` (Esmeralda 700), Fondo `#ecfdf5`, Borde `#a7f3d0`.
  - **Alerta / Poco Stock / Pendiente:** `#b45309` (Ámbar 700), Fondo `#fffbeb`, Borde `#fde68a`.
  - **Peligro / Anulado / Diferencia:** `#b91c1c` (Rojo 700), Fondo `#fef2f2`, Borde `#fecaca`.

## Tipografía y Cifras Numéricas
- **Fuente Principal:** Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif.
- **Cifras Contables y Monetarias:** Obligatorio `font-feature-settings: 'tnum', 'zero'` para alineación contable perfecta en tablas y arqueos.
- **Escala de Tamaños:**
  - H1 de Pantalla: `1.45rem` - `1.65rem` (peso 700, tracking `-0.025em`).
  - H2 de Sección: `1.05rem` - `1.15rem` (peso 700, tracking `-0.015em`).
  - Subtítulos / Meta: `0.8rem` - `0.85rem` (peso 400-500, color `slate-500`).
  - Cifras Clave (KPIs): `1.6rem` - `1.85rem` (peso 800, tabular).

## Iconografía (Regla Impeccable Estricta)
- **Prohibido:** Emojis Unicode (`🚚`, `🧴`, `📦`, `💵`, `💰`, `⚡`, `📍`, `📊`) en navegación, encabezados y métricas.
- **Estándar:** Iconos vectoriales SVG de trazo lineal uniforme de la biblioteca `lucide-react` con `strokeWidth={1.75}` o `{2}`, tamaño `14px` a `20px`.

## Responsividad Multidispositivo
1. **Teléfonos Móviles (< 640px):**
   - Vistas operativas y tablas con desplazamiento horizontal suave (`overflow-x: auto`) o apilamiento limpio.
   - Botones de acción táctiles con altura mínima de `44px` para interacción con pulgar en ruta.
   - Barra de navegación inferior fija o menú lateral desplegable accesible.
2. **Tablets (640px - 1024px):**
   - Cuadrícula de 2 a 3 columnas para KPIs y resúmenes de existencias.
   - Menú lateral compacto o colapsable.
3. **Escritorio (> 1024px):**
   - Barra lateral fija con agrupaciones claras.
   - Tablas completas con columnas de auditoría, filtros en línea y paneles divididos.
