package gt.com.aguapura.domain.loading;

import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;

import java.util.UUID;

public final class RouteLoadWorkflow {
    private RouteLoadWorkflow() {
    }

    public static String confirmWarehouse(String currentStatus) {
        require(currentStatus, "PREPARED");
        return "WAREHOUSE_CONFIRMED";
    }

    public static String confirmReceipt(String currentStatus, UUID warehouseActor, UUID receivingActor) {
        require(currentStatus, "WAREHOUSE_CONFIRMED");
        if (warehouseActor != null && warehouseActor.equals(receivingActor)) {
            throw new BusinessException("LOAD_CONFIRMATION_ACTOR_CONFLICT",
                    "La recepción debe confirmarla un usuario distinto de quien entregó la carga.",
                    ErrorCategory.CONFLICT);
        }
        return "RECEIVED";
    }

    public static String start(String currentStatus) {
        require(currentStatus, "RECEIVED");
        return "STARTED";
    }

    private static void require(String currentStatus, String expectedStatus) {
        if (!expectedStatus.equals(currentStatus)) {
            throw new BusinessException("INVALID_LOAD_STATUS",
                    "La carga no se encuentra en el estado requerido para esta operación.", ErrorCategory.CONFLICT);
        }
    }
}
