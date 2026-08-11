package gt.com.aguapura.domain.authorization;

import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AuthorizationDecisionPolicyTest {
    private final UUID requester = UUID.randomUUID();
    private final UUID reviewer = UUID.randomUUID();

    @Test
    void approvesPendingRequestBeforeExpiryWithDifferentReviewer() {
        assertThat(AuthorizationDecisionPolicy.decide("REQUESTED", requester, reviewer,
                Instant.parse("2026-08-12T00:00:00Z"), Instant.parse("2026-08-11T00:00:00Z"), "APPROVE"))
                .isEqualTo("APPROVED");
    }

    @Test
    void requesterCannotApproveOwnRequest() {
        assertThatThrownBy(() -> AuthorizationDecisionPolicy.decide("REQUESTED", requester, requester,
                Instant.parse("2026-08-12T00:00:00Z"), Instant.parse("2026-08-11T00:00:00Z"), "APPROVE"))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void expiredRequestCannotBeApprovedAndBecomesExpired() {
        assertThat(AuthorizationDecisionPolicy.decide("REQUESTED", requester, reviewer,
                Instant.parse("2026-08-10T00:00:00Z"), Instant.parse("2026-08-11T00:00:00Z"), "APPROVE"))
                .isEqualTo("EXPIRED");
    }
}
