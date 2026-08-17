# Frontend UX Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Simplify navigation, responsive behavior and visual hierarchy in the React frontend while preserving every existing API, session and data-flow contract.

**Architecture:** Keep page business logic in place. Add two small presentational components for repeated page headers and async status panels, and refactor `AppShell` to derive grouped navigation once and render it in desktop and mobile contexts. Use existing CSS tokens and no new dependencies.

**Tech Stack:** React 19, TypeScript, React Router, TanStack Query, Vite, Vitest, existing vanilla CSS.

## Global Constraints

- Do not change backend code, API endpoints, request payloads, session behavior, role rules or offline behavior.
- Do not install third-party libraries.
- Keep all route paths and visible menu labels.
- Preserve the existing teal/cyan visual identity.
- Every modified component must remain keyboard accessible and keep a minimum 44px touch target.

---

### Task 1: Add presentational UI primitives

**Files:**
- Create: `frontend/src/app/PageHeader.tsx`
- Create: `frontend/src/app/StatusPanel.tsx`
- Test: `frontend/src/app/PageHeader.test.tsx`
- Test: `frontend/src/app/StatusPanel.test.tsx`

**Interfaces:**
- `PageHeader` consumes `{ eyebrow?: string; title: string; description?: string; actions?: ReactNode }` and renders only semantic heading content.
- `StatusPanel` consumes `{ tone: 'loading' | 'error' | 'info' | 'success'; children: ReactNode }` and maps tone to `role="status"` or `role="alert"`.

- [x] **Step 1: Write tests for heading and status semantics**

```tsx
it('renders one labelled page heading and optional actions', () => {
  render(<PageHeader eyebrow="Catálogo" title="Productos" description="Administra el catálogo" actions={<button>Nuevo</button>} />);
  expect(screen.getByRole('heading', { level: 1, name: 'Productos' })).toBeInTheDocument();
  expect(screen.getByText('Administra el catálogo')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Nuevo' })).toBeInTheDocument();
});

it('marks errors as alerts and other states as status', () => {
  const { rerender } = render(<StatusPanel tone="loading">Cargando…</StatusPanel>);
  expect(screen.getByRole('status')).toHaveTextContent('Cargando…');
  rerender(<StatusPanel tone="error">No fue posible</StatusPanel>);
  expect(screen.getByRole('alert')).toHaveTextContent('No fue posible');
});
```

- [x] **Step 2: Run the focused tests and confirm they fail before implementation**

Run: `frontend/node_modules/.bin/vitest.cmd run src/app/PageHeader.test.tsx src/app/StatusPanel.test.tsx --pool=threads --maxWorkers=1 --configLoader native`
Expected: FAIL because the components do not exist.

- [x] **Step 3: Implement the two presentational components**

Use semantic `<header>`, `<p className="eyebrow">`, `<h1>`, `<p className="muted">`, and `<div className="page-header-actions">`; `StatusPanel` must never fetch or mutate data.

- [x] **Step 4: Run focused tests**

Run the same command. Expected: PASS.

### Task 2: Refactor grouped navigation and mobile dialog behavior

**Files:**
- Modify: `frontend/src/app/AppShell.tsx`
- Modify: `frontend/src/app/AppShell.test.tsx`
- Modify: `frontend/src/styles.css`

**Interfaces:**
- Existing `useSession`, `logout`, `useQuery`, `apiRequest`, `NavLink` and `Outlet` calls remain unchanged.
- The grouped navigation model renders the same `{ to, label, visible }` items, only nested under visual group headings.

- [x] **Step 1: Add regression tests for grouped labels, keyboard close and logout**

Assert the mobile dialog contains group headings, all existing admin links, closes on `Escape`, and still calls `logout` once.

- [x] **Step 2: Implement grouped navigation without changing route data**

Create a static `navigationGroups` array from the existing item definitions. Filter each group by `visible`, omit empty groups, and render the same links in both desktop and mobile. Keep `NavLink` and `onClick` close behavior.

- [x] **Step 3: Implement focus-safe mobile dialog behavior**

Track the trigger ref and panel ref. On open, focus the close button; on `Escape` or backdrop click, close; on close, restore focus to the trigger. Do not introduce a dependency or alter logout behavior.

- [x] **Step 4: Style grouped navigation and focus states**

Add `.nav-group`, `.nav-group-title`, `.page-header`, `.page-header-actions`, dialog backdrop cursor behavior and `:focus-visible`. Preserve existing breakpoints and mobile scrolling.

- [x] **Step 5: Run `AppShell` tests**

Run: `frontend/node_modules/.bin/vitest.cmd run src/app/AppShell.test.tsx --pool=threads --maxWorkers=1 --configLoader native`
Expected: all tests pass.

### Task 3: Apply shared visual patterns to representative pages

**Files:**
- Modify: `frontend/src/app/DashboardPage.tsx`
- Modify: `frontend/src/features/reports/ReportsPage.tsx`
- Modify: `frontend/src/features/routes/CustomersPage.tsx`
- Modify: `frontend/src/features/routes/RoutesPage.tsx`
- Modify: `frontend/src/features/loading/RouteLoadsPage.tsx`
- Modify: `frontend/src/features/administration/AdministrationPage.tsx`

**Interfaces:**
- All existing query keys, request URLs, mutation calls, form values and event handlers stay byte-for-byte equivalent where possible.

- [x] **Step 1: Replace repeated page intro JSX with `PageHeader`**

Pass the current eyebrow/title/description text; keep page `<main>` and all data-driven sections.

- [x] **Step 2: Replace only visual loading/error blocks with `StatusPanel`**

Keep the existing conditional expressions and messages. Do not alter query retry or mutation behavior.

- [x] **Step 3: Add `fieldset`/`legend` only around existing related controls**

Do not rename inputs or change their `name`, `value`, `onChange`, validation or submit handler.

- [x] **Step 4: Run the affected page tests**

Run: `frontend/node_modules/.bin/vitest.cmd run src/app/DashboardPage.test.tsx src/features/reports/ReportsPage.test.tsx src/features/routes/CustomersPage.test.tsx src/features/loading/RouteLoadsPage.test.tsx src/features/administration/AdministrationPage.test.tsx --pool=threads --maxWorkers=1 --configLoader native`
Expected: all tests pass.

### Task 4: Full verification and diff review

**Files:**
- Modify only files listed in Tasks 1–3.

- [x] **Step 1: Run TypeScript build**

Run: `frontend/node_modules/.bin/tsc.cmd -b frontend/tsconfig.json --pretty false`
Expected: exit code 0.

- [x] **Step 2: Run the full frontend test suite**

Run: `frontend/node_modules/.bin/vitest.cmd run src --pool=threads --maxWorkers=1 --configLoader native`
Expected: all existing tests pass.

- [x] **Step 3: Build production bundle**

Run: `npm run build -- --configLoader native`
Expected: exit code 0; a chunk-size warning is acceptable if no build error occurs.

- [x] **Step 4: Check the diff**

Run: `git diff --check` and `git diff --stat`.
Expected: no whitespace errors and no backend/API files changed by this refactor.

