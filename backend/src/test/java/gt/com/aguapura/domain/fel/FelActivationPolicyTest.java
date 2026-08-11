package gt.com.aguapura.domain.fel;

import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FelActivationPolicyTest {

    @Test
    void blocksActivationWithoutARealInstalledProvider() {
        assertThatThrownBy(() -> FelActivationPolicy.validate(true, "", false, false))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("certificador");
    }

    @Test
    void disabledFelNeverRequiresProviderOrCredentials() {
        FelActivationPolicy.validate(false, "", false, false);
    }
}
