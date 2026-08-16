# Task 1 report: route tracking point persistence

## Files changed

- `backend/src/test/java/gt/com/aguapura/application/dto/location/GeoLocationRequestTest.java`
- `backend/src/main/java/gt/com/aguapura/application/dto/location/GeoLocationRequest.java`
- `backend/src/main/java/gt/com/aguapura/application/ports/RouteTrackingPort.java`
- `backend/src/main/java/gt/com/aguapura/infrastructure/database/adapters/JdbcRouteTrackingAdapter.java`
- `backend/src/main/resources/db/migration/V20__route_tracking_points.sql`

The DTO is a Bean Validation record with required latitude/longitude/capturedAt, coordinate bounds, and optional non-negative accuracy. The port exposes start/sale recording operations and its `GeoLocation` value record. The JDBC adapter performs immutable inserts through the injected current-transaction `JdbcClient`. The migration creates the UUID-backed tracking table, foreign keys, coordinate/type/sale consistency checks, partial uniqueness rules, route/load timestamp indexes, and an update/delete rejection trigger.

## TDD and verification

1. Added the validation test first, covering a valid point, latitude 91, longitude -181, and negative accuracy with property-path assertions.
2. Attempted the mandated red command:

   `mvn -f backend/pom.xml -Dtest=GeoLocationRequestTest test`

   Result: unable to start because Maven is not installed in the environment (`mvn: The term 'mvn' is not recognized...`). Therefore compilation and the green test run could not be observed here.
3. `git diff --check` completed without whitespace errors (Git emitted unrelated existing LF/CRLF warnings).

## Concerns

- Maven/JDK build verification is unavailable from this shell because `mvn` is not on PATH and the repository has no Maven wrapper. Run the mandated command in a Maven-enabled environment before integration.
- Existing unrelated dirty changes were preserved and excluded from the commit.

## Review fix

The migration was corrected to prevent mismatched route/load and sale/route references. V20 now adds composite unique keys on `(id, route_id)` for `route_load` and `sale`, then uses composite foreign keys from tracking points. The existing direct `route_id` foreign key remains.

Checks after the fix:

- `git diff --check`: passed; only unrelated repository line-ending warnings were emitted.
- `mvn -f backend/pom.xml -Dtest=GeoLocationRequestTest test`: still unavailable because Maven is not installed (`mvn: The term 'mvn' is not recognized...`).
