package gt.com.aguapura.domain.sales;

import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SaleLineCalculatorTest {
    @Test
    void calculatesBaseUnitsAndMoneyFromServerValues() {
        var result = SaleLineCalculator.calculate(new BigDecimal("3"), new BigDecimal("12"),
                new BigDecimal("8.333333"));
        assertThat(result.quantityBaseUnits()).isEqualByComparingTo("36");
        assertThat(result.lineTotal()).isEqualByComparingTo("25.00");
    }

    @Test
    void rejectsNonPositiveQuantity() {
        assertThatThrownBy(() -> SaleLineCalculator.calculate(BigDecimal.ZERO, BigDecimal.ONE, BigDecimal.TEN))
                .isInstanceOf(BusinessException.class)
                .extracting("code").isEqualTo("SALE_QUANTITY_INVALID");
    }
}
