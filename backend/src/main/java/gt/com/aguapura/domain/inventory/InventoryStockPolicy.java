package gt.com.aguapura.domain.inventory;

import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;

import java.math.BigDecimal;

public final class InventoryStockPolicy {
    private InventoryStockPolicy() {
    }

    public static BigDecimal balanceAfter(BigDecimal currentBalance, BigDecimal quantityDelta) {
        if (currentBalance == null || currentBalance.signum() < 0) {
            throw new IllegalArgumentException("El saldo actual no puede ser negativo.");
        }
        if (quantityDelta == null || quantityDelta.signum() == 0) {
            throw new BusinessException("INVENTORY_ZERO_MOVEMENT",
                    "El movimiento de inventario debe tener una cantidad distinta de cero.", ErrorCategory.VALIDATION);
        }
        BigDecimal result = currentBalance.add(quantityDelta);
        if (result.signum() < 0) {
            throw new BusinessException("INSUFFICIENT_STOCK",
                    "La operación dejaría existencias negativas.", ErrorCategory.CONFLICT);
        }
        return result.stripTrailingZeros();
    }
}
