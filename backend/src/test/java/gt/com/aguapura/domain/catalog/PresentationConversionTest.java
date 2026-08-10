package gt.com.aguapura.domain.catalog;

import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PresentationConversionTest {

    @Test
    void convertsPresentationQuantityToBaseUnits() {
        var conversion = new PresentationConversion(new BigDecimal("12"));

        assertThat(conversion.toBaseUnits(new BigDecimal("3")))
                .isEqualByComparingTo("36");
    }

    @Test
    void rejectsNonPositiveConversionFactors() {
        assertThatThrownBy(() -> new PresentationConversion(BigDecimal.ZERO))
                .isInstanceOf(BusinessException.class)
                .extracting("code")
                .isEqualTo("INVALID_CONVERSION_FACTOR");
    }

    @Test
    void rejectsNegativeQuantities() {
        var conversion = new PresentationConversion(new BigDecimal("24"));

        assertThatThrownBy(() -> conversion.toBaseUnits(new BigDecimal("-1")))
                .isInstanceOf(BusinessException.class)
                .extracting("code")
                .isEqualTo("INVALID_QUANTITY");
    }
}
