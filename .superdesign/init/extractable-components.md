# Extractable UI components

## AppShell
- Source: `frontend/src/app/AppShell.tsx`
- Category: layout
- Description: authenticated header, role-filtered navigation, outlet and mobile menu.
- Extractable props: active route is supplied by `NavLink`; session user and logout are consumed from context.
- Hardcoded: menu labels, route paths, role rules, colors and button copy.

## PageHeader (candidate)
- Source: to be extracted from repeated page JSX only if approved.
- Category: basic
- Description: eyebrow, page title, supporting description and optional actions.
- Extractable props: `eyebrow`, `title`, `description`, `actions`.
- Hardcoded: visual tokens and spacing.

## PanelState (candidate)
- Source: to be extracted from repeated loading/error/empty JSX only if approved.
- Category: basic
- Description: consistent status panel with semantic live-region role.
- Extractable props: `tone`, `children`.
- Hardcoded: status surface styling.
