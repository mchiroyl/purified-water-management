package gt.com.aguapura.infrastructure.database.adapters;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class JdbcRouteLoadAdapterTest {
    @Test
    void currentInitialLoadLockAndSettlementCheckAreBoundToTheSameRun() {
        String lockSql = JdbcRouteLoadAdapter.CURRENT_STARTED_INITIAL_LOAD_LOCK_SQL;
        String sql = JdbcRouteLoadAdapter.CURRENT_INITIAL_LOAD_CLOSED_SETTLEMENT_SQL;

        assertTrue(lockSql.contains("route_id=:routeId"));
        assertTrue(lockSql.contains("load_type='INITIAL'"));
        assertTrue(lockSql.contains("status='STARTED'"));
        assertTrue(lockSql.contains("FOR UPDATE"));
        assertTrue(sql.contains("route_load_id=:routeLoadId"));
        assertTrue(sql.contains("status='CLOSED'"));
    }
}
