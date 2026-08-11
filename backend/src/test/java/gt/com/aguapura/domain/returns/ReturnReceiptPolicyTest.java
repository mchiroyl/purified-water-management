package gt.com.aguapura.domain.returns;

import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReturnReceiptPolicyTest {
    @Test
    void sellerCannotConfirmWarehouseReceipt() {
        assertThatThrownBy(() -> ReturnReceiptPolicy.confirm("PENDING_RECEIPT", "VENDEDOR",
                new BigDecimal("10"), new BigDecimal("10")))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void partialReceiptPreservesPhysicalDifference() {
        var result = ReturnReceiptPolicy.confirm("PENDING_RECEIPT", "BODEGA",
                new BigDecimal("10"), new BigDecimal("8"));

        assertThat(result.status()).isEqualTo("PARTIALLY_RECEIVED");
        assertThat(result.receivedBaseUnits()).isEqualByComparingTo("8");
        assertThat(result.pendingDifferenceBaseUnits()).isEqualByComparingTo("2");
    }

    @Test
    void zeroReceiptRejectsAndExcessIsInvalid() {
        assertThat(ReturnReceiptPolicy.confirm("PENDING_RECEIPT", "BODEGA",
                new BigDecimal("10"), BigDecimal.ZERO).status()).isEqualTo("REJECTED");
        assertThatThrownBy(() -> ReturnReceiptPolicy.confirm("PENDING_RECEIPT", "BODEGA",
                new BigDecimal("10"), new BigDecimal("11"))).isInstanceOf(BusinessException.class);
    }
}
