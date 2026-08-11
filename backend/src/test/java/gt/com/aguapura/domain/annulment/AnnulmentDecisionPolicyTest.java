package gt.com.aguapura.domain.annulment;

import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AnnulmentDecisionPolicyTest {
    @Test
    void independentReviewerCanApproveRequestedAnnulment() {
        assertThat(AnnulmentDecisionPolicy.decide("REQUESTED", UUID.randomUUID(), UUID.randomUUID(), "APPROVE"))
                .isEqualTo("APPROVED");
    }

    @Test
    void requesterCannotApproveOwnAnnulment() {
        UUID actor=UUID.randomUUID();
        assertThatThrownBy(() -> AnnulmentDecisionPolicy.decide("REQUESTED", actor, actor, "APPROVE"))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void approvedAnnulmentCannotApplyTwice() {
        assertThatThrownBy(() -> AnnulmentDecisionPolicy.decide("APPROVED", UUID.randomUUID(), UUID.randomUUID(), "APPROVE"))
                .isInstanceOf(BusinessException.class);
    }
}
