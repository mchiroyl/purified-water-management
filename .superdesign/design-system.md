# Sistema Agua Pura UI design system

## Product context
Operational control for a single water-purification company. Users include administrators, warehouse staff, sellers and supervisors. The interface must support desktop back-office work and mobile route operations.

## Direction
Conservative usability refactor. Preserve the existing teal/cyan palette, content language, route paths, role visibility and API/session behavior. Improve hierarchy, grouping, focus visibility, touch targets and responsive navigation without adding product capabilities.

## Tokens
- Font: Inter/system sans-serif.
- Colors: background `#f4fbfc`, surface `#ffffff`, primary `#087e8b`, primary dark `#05626c`, text `#17343a`, muted `#607b80`, line `#cfe3e6`, danger `#b42318`, success `#067647`.
- Controls: minimum height `44px`, rounded controls, teal primary actions, pale secondary actions.
- Layout: centered content max width `1180px`; sidebar at `800px+`; bottom mobile menu below `800px`.

## UX rules
- Group existing links by user task, never remove or rename a route.
- Keep logout reachable on desktop and mobile.
- Use semantic headings, `fieldset`/`legend` for related form controls, visible keyboard focus and live regions for async state.
- No new endpoints, dependencies or business actions.
