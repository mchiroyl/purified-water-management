package gt.com.aguapura.domain.inventory;

import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;

import java.math.BigDecimal;

public final class InventoryStockPolicy {
    private InventoryStockPolicy() {
    }

    public static BigDecimal balanceAfter(BigDecimal currentBalance, BigDecimal quantityDelta) {
        return balanceAfter(currentBalance, quantityDelta, null, null);
    }

    public static BigDecimal balanceAfter(BigDecimal currentBalance, BigDecimal quantityDelta,
                                          String productName, String unitCode) {
        if (currentBalance == null || currentBalance.signum() < 0) {
            throw new IllegalArgumentException("El saldo actual no puede ser negativo.");
        }
        if (quantityDelta == null || quantityDelta.signum() == 0) {
            throw new BusinessException("INVENTORY_ZERO_MOVEMENT",
                    "El movimiento de inventario debe tener una cantidad distinta de cero.", ErrorCategory.VALIDATION);
        }
        BigDecimal result = currentBalance.add(quantityDelta);
        if (result.signum() < 0) {
            String message;
            if (productName != null && !productName.isBlank()) {
                BigDecimal required = quantityDelta.abs().stripTrailingZeros();
                BigDecimal available = currentBalance.stripTrailingZeros();
                String unit = (unitCode != null && !unitCode.isBlank()) ? " " + unitCode : "";
                message = String.format("Stock insuficiente para %s: se requieren %s%s pero solo hay %s%s en bodega.",
                        productName, required.toPlainString(), unit, available.toPlainString(), unit);
            } else {
                message = "La operación dejaría existencias negativas.";
            }
            throw new BusinessException("INSUFFICIENT_STOCK", message, ErrorCategory.CONFLICT);
        }
        return result.stripTrailingZeros();
    }
}
