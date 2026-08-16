## Task 2 report: route-start point on load receipt

### Changed files

- `backend/src/main/java/gt/com/aguapura/application/dto/loading/ConfirmRouteLoadReceiptRequest.java`: adds a validated receipt payload containing a required `GeoLocationRequest`.
- `backend/src/main/java/gt/com/aguapura/application/services/RouteLoadApplicationService.java`: accepts the receipt payload, converts its location to `RouteTrackingPort.GeoLocation`, and records an initial-load start after inventory transfer and persisted receipt confirmation. Replenishments do not record another start.
- `backend/src/main/java/gt/com/aguapura/presentation/controllers/RouteLoadController.java`: accepts and validates the receipt body while retaining location-free audit data.
- `backend/src/test/java/gt/com/aguapura/application/services/RouteLoadApplicationServiceTest.java`: Mockito coverage for initial-load recording and replenishment exclusion.
- `frontend/e2e/full-operational-flow.spec.ts`: supplies a deterministic receipt location and asserts the `RECEIVED` response.

### Commands and output

- `mvn -f backend/pom.xml -Dtest=RouteLoadApplicationServiceTest test` (red attempt): could not run because PowerShell reported `mvn` is not recognized; no Maven wrapper is present in the repository.
- `npm --prefix frontend test -- src/features/loading/RouteLoadsPage.test.tsx`: passed — 36 test files and 57 tests passed (exit 0).
- `git diff --check`: no whitespace errors; output included existing CRLF conversion warnings for the dirty working tree.
- `git diff --cached --check`: passed with no staged whitespace errors.
- `npm --prefix frontend test -- src/features/loading/RouteLoadsPage.test.tsx`: passed — 36 test files and 57 tests passed (exit 0).
- `mvn -f backend/pom.xml -Dtest=RouteLoadApplicationServiceTest test`: unavailable — Maven is not installed and no `backend/mvnw`/`backend/mvnw.cmd` wrapper exists.

### Concerns

- Backend compilation and the new service test could not be executed in this environment because Maven is unavailable. The test was written before production wiring, but its expected compilation failure could not be observed.
- The shared working tree already contains unrelated modifications, including adjacent route-load and E2E changes. The task commit stages only the Task 2 hunks and new files.

### Commit

- Commit: `feat: record route start location on receipt`
