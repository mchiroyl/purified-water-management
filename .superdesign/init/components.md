# Shared UI components

The frontend does not use a third-party component library. Shared UI is implemented with semantic JSX and `frontend/src/styles.css`.

## AppShell
- Source: `frontend/src/app/AppShell.tsx`
- Description: authenticated application shell with header, desktop navigation, mobile menu and outlet.
- The full source is recorded in `layouts.md` because it is a layout component.

## Shared primitives
- `panel`, `form-grid`, `section-heading`, `status`, `alert`, `primary`, and `secondary` are CSS/semantic patterns rather than React components.
- Refactoring should preserve these class contracts while improving grouping and accessibility.
