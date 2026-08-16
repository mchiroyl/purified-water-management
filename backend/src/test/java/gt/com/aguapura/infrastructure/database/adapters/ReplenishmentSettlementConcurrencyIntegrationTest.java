package gt.com.aguapura.infrastructure.database.adapters;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.SimpleDriverDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import javax.sql.DataSource;
import java.sql.Driver;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Testcontainers(disabledWithoutDocker = true)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ReplenishmentSettlementConcurrencyIntegrationTest {
    private static final long TIMEOUT_SECONDS = 10;

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:18.4-alpine");

    private JdbcClient jdbc;
    private TransactionTemplate transaction;
    private JdbcRouteLoadAdapter routeLoads;
    private ExecutorService executor;

    @BeforeAll
    void createSchema() throws Exception {
        DataSource dataSource = new SimpleDriverDataSource(
                (Driver) Class.forName("org.postgresql.Driver").getDeclaredConstructor().newInstance(),
                POSTGRES.getJdbcUrl(), POSTGRES.getUsername(), POSTGRES.getPassword());
        jdbc = JdbcClient.create(dataSource);
        transaction = new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        routeLoads = new JdbcRouteLoadAdapter(jdbc);

        jdbc.sql("""
                CREATE TABLE route_load (
                    id UUID PRIMARY KEY,
                    route_id UUID NOT NULL,
                    load_type VARCHAR(20) NOT NULL,
                    status VARCHAR(20) NOT NULL
                )
                """).update();
        jdbc.sql("""
                CREATE TABLE settlement (
                    route_load_id UUID PRIMARY KEY REFERENCES route_load(id),
                    status VARCHAR(30) NOT NULL
                )
                """).update();
        jdbc.sql("""
                CREATE TABLE replenishment (
                    id UUID PRIMARY KEY,
                    initial_load_id UUID NOT NULL REFERENCES route_load(id)
                )
                """).update();
        jdbc.sql("""
                CREATE TABLE lifecycle_event (
                    id BIGSERIAL PRIMARY KEY,
                    event_type VARCHAR(30) NOT NULL
                )
                """).update();
    }

    @BeforeEach
    void resetState() {
        executor = Executors.newFixedThreadPool(2);
        jdbc.sql("DELETE FROM lifecycle_event").update();
        jdbc.sql("DELETE FROM replenishment").update();
        jdbc.sql("DELETE FROM settlement").update();
        jdbc.sql("DELETE FROM route_load").update();
    }

    @AfterEach
    void stopThreads() {
        executor.shutdownNow();
    }

    @Test
    void historicalClosedLoadDoesNotBlockReplenishmentForLaterStartedLoad() {
        UUID routeId = UUID.randomUUID();
        insertInitialLoad(routeId, "SETTLED", "CLOSED");
        UUID currentLoad = insertInitialLoad(routeId, "STARTED", "BALANCED");

        ReplenishmentOutcome outcome = createReplenishment(routeId, null, null);

        assertEquals(ReplenishmentOutcome.CREATED, outcome);
        assertEquals(1, count("SELECT count(*) FROM replenishment WHERE initial_load_id=:id", currentLoad));
    }

    @Test
    void settlementCloseWinningTheLoadLockPreventsReplenishment() throws Exception {
        UUID routeId = UUID.randomUUID();
        UUID currentLoad = insertInitialLoad(routeId, "STARTED", "BALANCED");
        CountDownLatch closeLockedLoad = new CountDownLatch(1);
        CountDownLatch allowClose = new CountDownLatch(1);

        Future<Void> closing = executor.submit(() -> {
            closeSettlement(currentLoad, null, closeLockedLoad, allowClose);
            return null;
        });
        await(closeLockedLoad);
        Future<ReplenishmentOutcome> replenishing = executor.submit(() -> createReplenishment(routeId, null, null));

        allowClose.countDown();
        closing.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);

        assertEquals(ReplenishmentOutcome.NOT_STARTED, replenishing.get(TIMEOUT_SECONDS, TimeUnit.SECONDS));
        assertEquals(0, count("SELECT count(*) FROM replenishment", null));
        assertEquals("SETTLED", jdbc.sql("SELECT status FROM route_load WHERE id=:id")
                .param("id", currentLoad).query(String.class).single());
    }

    @Test
    void replenishmentWinningTheLoadLockCommitsBeforeSettlementClose() throws Exception {
        UUID routeId = UUID.randomUUID();
        UUID currentLoad = insertInitialLoad(routeId, "STARTED", "BALANCED");
        CountDownLatch replenishmentLockedLoad = new CountDownLatch(1);
        CountDownLatch allowReplenishment = new CountDownLatch(1);
        CountDownLatch closeAttempted = new CountDownLatch(1);

        Future<ReplenishmentOutcome> replenishing = executor.submit(
                () -> createReplenishment(routeId, replenishmentLockedLoad, allowReplenishment));
        await(replenishmentLockedLoad);
        Future<Void> closing = executor.submit(() -> {
            closeSettlement(currentLoad, closeAttempted, null, null);
            return null;
        });
        await(closeAttempted);

        allowReplenishment.countDown();
        assertEquals(ReplenishmentOutcome.CREATED, replenishing.get(TIMEOUT_SECONDS, TimeUnit.SECONDS));
        closing.get(TIMEOUT_SECONDS, TimeUnit.SECONDS);

        assertEquals(List.of("REPLENISHMENT", "SETTLEMENT_CLOSED"), jdbc.sql("""
                SELECT event_type FROM lifecycle_event ORDER BY id
                """).query(String.class).list());
        assertEquals(1, count("SELECT count(*) FROM replenishment WHERE initial_load_id=:id", currentLoad));
    }

    private UUID insertInitialLoad(UUID routeId, String loadStatus, String settlementStatus) {
        UUID loadId = UUID.randomUUID();
        jdbc.sql("INSERT INTO route_load(id,route_id,load_type,status) VALUES (:id,:routeId,'INITIAL',:status)")
                .param("id", loadId).param("routeId", routeId).param("status", loadStatus).update();
        jdbc.sql("INSERT INTO settlement(route_load_id,status) VALUES (:id,:status)")
                .param("id", loadId).param("status", settlementStatus).update();
        return loadId;
    }

    private ReplenishmentOutcome createReplenishment(UUID routeId, CountDownLatch lockedLoad, CountDownLatch continueAfterLock) {
        return transaction.execute(status -> {
            UUID currentLoad = routeLoads.lockCurrentStartedInitialLoad(routeId).orElse(null);
            if (currentLoad == null) return ReplenishmentOutcome.NOT_STARTED;
            if (routeLoads.routeLoadHasClosedSettlement(currentLoad)) return ReplenishmentOutcome.SETTLED;
            if (lockedLoad != null) lockedLoad.countDown();
            if (continueAfterLock != null) await(continueAfterLock);
            jdbc.sql("INSERT INTO replenishment(id,initial_load_id) VALUES (:id,:loadId)")
                    .param("id", UUID.randomUUID()).param("loadId", currentLoad).update();
            jdbc.sql("INSERT INTO lifecycle_event(event_type) VALUES ('REPLENISHMENT')").update();
            return ReplenishmentOutcome.CREATED;
        });
    }

    private void closeSettlement(UUID routeLoadId, CountDownLatch beforeLockSignal,
                                 CountDownLatch afterLockSignal, CountDownLatch continueAfterLock) {
        if (beforeLockSignal != null) beforeLockSignal.countDown();
        transaction.executeWithoutResult(status -> {
            UUID lockedInitialLoad = jdbc.sql(JdbcSettlementAdapter.CURRENT_STARTED_INITIAL_LOAD_LOCK_SQL)
                    .param("id", routeLoadId).query(UUID.class).optional().orElseThrow();
            if (afterLockSignal != null) afterLockSignal.countDown();
            if (continueAfterLock != null) await(continueAfterLock);
            jdbc.sql("UPDATE settlement SET status='CLOSED' WHERE route_load_id=:id AND status='BALANCED'")
                    .param("id", lockedInitialLoad).update();
            jdbc.sql("UPDATE route_load SET status='SETTLED' WHERE id=:id AND status='STARTED'")
                    .param("id", lockedInitialLoad).update();
            jdbc.sql("INSERT INTO lifecycle_event(event_type) VALUES ('SETTLEMENT_CLOSED')").update();
        });
    }

    private int count(String sql, UUID loadId) {
        var statement = jdbc.sql(sql);
        if (loadId != null) statement.param("id", loadId);
        return statement.query(Integer.class).single();
    }

    private void await(CountDownLatch latch) {
        try {
            if (!latch.await(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                throw new IllegalStateException("Timed out waiting for concurrent transaction");
            }
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while waiting for concurrent transaction", exception);
        }
    }

    private enum ReplenishmentOutcome { CREATED, NOT_STARTED, SETTLED }
}
