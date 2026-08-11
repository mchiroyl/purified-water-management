package gt.com.aguapura.infrastructure.repositories;

import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Lock;

import static org.assertj.core.api.Assertions.assertThat;

class RefreshSessionJpaRepositorySecurityTest {

    @Test
    void refreshTokenLookupLocksTheSessionForSingleUseRotation() throws Exception {
        var method = RefreshSessionJpaRepository.class.getMethod("findByTokenHash", String.class);

        assertThat(method.getAnnotation(Lock.class))
                .isNotNull()
                .extracting(Lock::value)
                .isEqualTo(LockModeType.PESSIMISTIC_WRITE);
    }
}
