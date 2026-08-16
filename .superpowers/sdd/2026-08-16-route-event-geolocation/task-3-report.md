# Task 3 report — Capture a point atomically with each confirmed sale

## Scope delivered

- `CreateSaleRequest` now requires a nested, validated `GeoLocationRequest` named `location`.
- `SalesPort.SaleContext` carries the active `routeLoadId`; `JdbcSalesAdapter` obtains it from the route's currently `STARTED` load.
- `SalesApplicationService` records the confirmed-sale point immediately after `createSale` and before inventory consumption and audit. The existing `@Transactional` boundary therefore includes the tracking insert.
- The sale response contract was deliberately left unchanged.
- Added focused service and offline-sync tests for sale tracking, validation, and JSON location forwarding.

## TDD record

1. Added the focused tests before editing production code.
2. Attempted the required red command:

   ```powershell
   mvn -f backend/pom.xml '-Dtest=SalesApplicationServiceTest,OfflineSaleSyncHandlerTest' test
   ```

   It could not execute because `mvn` is not installed or on `PATH`; the repository has no Maven wrapper. Consequently, neither the intended red compilation failure nor the green test run could be observed in this environment.
3. Implemented the minimal contract and transaction-flow changes described above.
4. Ran `git diff --check` on all Task 3 source and test files; it reported no whitespace errors.

## Verification required in an environment with Maven

```powershell
mvn -f backend/pom.xml '-Dtest=SalesApplicationServiceTest,OfflineSaleSyncHandlerTest' test
```

The normal Maven command shown in the task brief needs quoting around `-Dtest=...,...` when executed from PowerShell so its comma is not parsed as an argument separator.
