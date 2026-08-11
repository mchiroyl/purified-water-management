package gt.com.aguapura.domain.authorization;

import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class IncidentResolutionPolicyTest {
    @Test
    void separateReviewerCanResolveOpenIncident() {
        assertThat(IncidentResolutionPolicy.transition("OPEN", UUID.randomUUID(), UUID.randomUUID(), "RESOLVE"))
                .isEqualTo("RESOLVED");
    }

    @Test
    void reporterCannotResolveOwnIncident() {
        UUID reporter = UUID.randomUUID();
        assertThatThrownBy(() -> IncidentResolutionPolicy.transition("OPEN", reporter, reporter, "RESOLVE"))
                .isInstanceOf(BusinessException.class);
    }
}
