package gt.com.aguapura.domain.inventory;

import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class InventoryStockPolicyTest {

    @Test
    void appliesEntriesAndExitsInBaseUnits() {
        assertThat(InventoryStockPolicy.balanceAfter(new BigDecimal("10"), new BigDecimal("5")))
                .isEqualByComparingTo("15");
        assertThat(InventoryStockPolicy.balanceAfter(new BigDecimal("15"), new BigDecimal("-4.5")))
                .isEqualByComparingTo("10.5");
    }

    @Test
    void rejectsMovementsThatWouldLeaveNegativeStock() {
        assertThatThrownBy(() -> InventoryStockPolicy.balanceAfter(
                new BigDecimal("3"), new BigDecimal("-3.0001")))
                .isInstanceOf(BusinessException.class)
                .extracting("code").isEqualTo("INSUFFICIENT_STOCK");
    }

    @Test
    void rejectsZeroQuantityMovements() {
        assertThatThrownBy(() -> InventoryStockPolicy.balanceAfter(BigDecimal.TEN, BigDecimal.ZERO))
                .isInstanceOf(BusinessException.class)
                .extracting("code").isEqualTo("INVENTORY_ZERO_MOVEMENT");
    }
}
