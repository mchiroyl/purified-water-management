package gt.com.aguapura.domain.settlement;

import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SettlementClosePolicyTest {
    @Test
    void blocksCloseWhenLocalOrServerOperationsRemain() {
        assertThatThrownBy(() -> SettlementClosePolicy.validate("STARTED", "ADMINISTRADOR", 2,
                List.of("RETURN_PENDING"), "Diferencia investigada"))
                .isInstanceOf(BusinessException.class).hasMessageContaining("sincronización");
    }

    @Test
    void sellerCannotCloseOwnSettlement() {
        assertThatThrownBy(() -> SettlementClosePolicy.validate("STARTED", "VENDEDOR", 0,
                List.of(), "Liquidación revisada"))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void allowsSupervisorToCloseBalancedOrDifferentSnapshotWithoutPendingOperations() {
        SettlementClosePolicy.validate("STARTED", "SUPERVISOR", 0, List.of(), "Diferencia documentada");
    }
}
