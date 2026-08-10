package gt.com.aguapura.domain.catalog;

import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class PresentationConversion {

    private static final int QUANTITY_SCALE = 6;
    private final BigDecimal factor;

    public PresentationConversion(BigDecimal factor) {
        if (factor == null || factor.signum() <= 0) {
            throw new BusinessException("INVALID_CONVERSION_FACTOR",
                    "El factor de conversión debe ser mayor que cero.", ErrorCategory.VALIDATION);
        }
        this.factor = factor.setScale(QUANTITY_SCALE, RoundingMode.UNNECESSARY);
    }

    public BigDecimal factor() {
        return factor;
    }

    public BigDecimal toBaseUnits(BigDecimal presentationQuantity) {
        if (presentationQuantity == null || presentationQuantity.signum() < 0) {
            throw new BusinessException("INVALID_QUANTITY",
                    "La cantidad no puede ser negativa.", ErrorCategory.VALIDATION);
        }
        return presentationQuantity.multiply(factor).setScale(QUANTITY_SCALE, RoundingMode.UNNECESSARY);
    }
}
