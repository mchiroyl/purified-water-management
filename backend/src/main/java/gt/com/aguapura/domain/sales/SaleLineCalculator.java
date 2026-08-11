package gt.com.aguapura.domain.sales;

import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class SaleLineCalculator {
    private SaleLineCalculator() {
    }

    public static Result calculate(BigDecimal presentationQuantity, BigDecimal conversionFactor,
                                   BigDecimal serverUnitPrice) {
        if (presentationQuantity == null || presentationQuantity.signum() <= 0) {
            throw new BusinessException("SALE_QUANTITY_INVALID", "La cantidad vendida debe ser mayor que cero.",
                    ErrorCategory.VALIDATION);
        }
        if (conversionFactor == null || conversionFactor.signum() <= 0 || serverUnitPrice == null
                || serverUnitPrice.signum() < 0) {
            throw new IllegalArgumentException("Conversión y precio del servidor inválidos.");
        }
        BigDecimal baseUnits = presentationQuantity.multiply(conversionFactor).setScale(4, RoundingMode.HALF_UP)
                .stripTrailingZeros();
        BigDecimal lineTotal = presentationQuantity.multiply(serverUnitPrice).setScale(2, RoundingMode.HALF_UP);
        return new Result(baseUnits, lineTotal);
    }

    public record Result(BigDecimal quantityBaseUnits, BigDecimal lineTotal) {
    }
}
