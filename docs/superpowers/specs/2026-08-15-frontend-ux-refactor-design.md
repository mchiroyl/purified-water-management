# Refactor de UX del frontend — Diseño

## Objetivo

Simplificar la navegación y mejorar la accesibilidad del frontend React sin modificar los contratos del backend, la gestión de sesión, los permisos ni el flujo de datos existente.

## Alcance

- Reorganizar visualmente las opciones existentes del `AppShell` en grupos de tarea.
- Mantener cada ruta, etiqueta funcional y regla de visibilidad por rol.
- Mejorar el diálogo móvil: desplazamiento, cierre por teclado/fondo y foco.
- Añadir un patrón presentacional reutilizable para encabezados de página.
- Normalizar estados visuales de carga, error y vacío sin cambiar mensajes ni consultas.
- Aplicar foco visible, relaciones ARIA y semántica de formularios en las superficies que se toquen.
- Mantener la paleta actual, sin librerías nuevas ni endpoints nuevos.

## Fuera de alcance

- Migración o cambios al backend (el repositorio actual usa Spring Boot y el frontend conserva sus endpoints actuales).
- Cambios en `apiClient`, `SessionContext`, modelos, permisos, consultas, mutaciones u operaciones offline.
- Nuevas funciones de negocio, filtros, reportes o flujos operativos.
- Instalación de dependencias.

## Arquitectura propuesta

1. `AppShell` tendrá un arreglo de grupos de navegación, cada uno con sus enlaces ya existentes. El filtrado se hará una sola vez y se reutilizará en escritorio y móvil.
2. El menú móvil usará un diálogo nativo semántico con `aria-labelledby`, foco inicial al abrir, `Escape`, clic en el fondo y restauración del foco al disparador.
3. `PageHeader` será una pieza presentacional pequeña para evitar repetir la estructura de encabezado; no recibirá datos del servidor ni ejecutará eventos.
4. `StatusPanel` será presentacional y se usará solo donde ya existe carga/error/vacío; no hará reintentos ni cambiará el estado de React Query.
5. `styles.css` concentrará los tokens de foco, grupos de navegación, encabezados y estados.

## Flujo de datos

No cambia. Las páginas seguirán usando los hooks de React Query y `apiRequest` existentes. La refactorización solo mueve JSX visual y clases CSS.

## Accesibilidad

- Un solo `h1` por página.
- `aria-labelledby` para el diálogo móvil.
- `role="status"` para cargas y estados informativos; `role="alert"` para errores.
- `:focus-visible` con contraste suficiente.
- Los enlaces mantienen `NavLink` y su estado activo.
- El botón de cierre de sesión conserva su evento actual.

## Verificación

- Pruebas existentes de `AppShell`, páginas y sesión.
- TypeScript (`tsc -b`).
- Vitest con el cargador nativo requerido por este entorno.
- Build de producción con el mismo cargador.
- `git diff --check`.
