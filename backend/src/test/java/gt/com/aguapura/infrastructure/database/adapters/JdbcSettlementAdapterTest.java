package gt.com.aguapura.infrastructure.database.adapters;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertTrue;

class JdbcSettlementAdapterTest {
    @Test
    void closeLocksTheCurrentStartedInitialLoadBeforeChangingSettlement() {
        String sql = JdbcSettlementAdapter.CURRENT_STARTED_INITIAL_LOAD_LOCK_SQL;

        assertTrue(sql.contains("id=:id"));
        assertTrue(sql.contains("load_type='INITIAL'"));
        assertTrue(sql.contains("status='STARTED'"));
        assertTrue(sql.contains("FOR UPDATE"));
    }
}
