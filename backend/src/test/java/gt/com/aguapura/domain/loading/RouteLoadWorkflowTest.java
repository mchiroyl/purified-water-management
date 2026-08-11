package gt.com.aguapura.domain.loading;

import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RouteLoadWorkflowTest {
    private final UUID warehouseActor = UUID.randomUUID();
    private final UUID sellerActor = UUID.randomUUID();

    @Test
    void requiresOrderedDoubleConfirmationBeforeStarting() {
        assertThat(RouteLoadWorkflow.confirmWarehouse("PREPARED")).isEqualTo("WAREHOUSE_CONFIRMED");
        assertThat(RouteLoadWorkflow.confirmReceipt("WAREHOUSE_CONFIRMED", warehouseActor, sellerActor))
                .isEqualTo("RECEIVED");
        assertThat(RouteLoadWorkflow.start("RECEIVED")).isEqualTo("STARTED");
    }

    @Test
    void rejectsSelfConfirmation() {
        assertThatThrownBy(() -> RouteLoadWorkflow.confirmReceipt(
                "WAREHOUSE_CONFIRMED", warehouseActor, warehouseActor))
                .isInstanceOf(BusinessException.class)
                .extracting("code").isEqualTo("LOAD_CONFIRMATION_ACTOR_CONFLICT");
    }

    @Test
    void rejectsSkippingWarehouseConfirmation() {
        assertThatThrownBy(() -> RouteLoadWorkflow.confirmReceipt("PREPARED", warehouseActor, sellerActor))
                .isInstanceOf(BusinessException.class)
                .extracting("code").isEqualTo("INVALID_LOAD_STATUS");
    }
}
