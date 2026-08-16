package gt.com.aguapura.infrastructure.database.adapters;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class JdbcRouteLoadAdapterTest {
    @Test
    void closedSettlementCheckOnlyTargetsTheCurrentStartedInitialLoad() {
        String sql = JdbcRouteLoadAdapter.CURRENT_INITIAL_LOAD_CLOSED_SETTLEMENT_SQL;

        assertTrue(sql.contains("JOIN settlement s ON s.route_load_id=rl.id"));
        assertTrue(sql.contains("rl.load_type='INITIAL'"));
        assertTrue(sql.contains("rl.status='STARTED'"));
        assertTrue(sql.contains("s.status='CLOSED'"));
    }
}
