package gt.com.aguapura.infrastructure.database.entities;

import gt.com.aguapura.domain.enums.UserStatus;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class UserJpaEntitySecurityTest {

    @Test
    void failedLoginsNeverReactivateAnAdministrativelyInactiveUser() throws Exception {
        var user = new UserJpaEntity("inactive", "inactive@example.invalid", "hash", false);
        Field status = UserJpaEntity.class.getDeclaredField("status");
        status.setAccessible(true);
        status.set(user, UserStatus.INACTIVE);

        Instant lockUntil = Instant.parse("2026-08-11T10:15:00Z");
        for (int attempt = 0; attempt < 5; attempt++) user.registerFailedAttempt(5, lockUntil);
        user.unlockIfExpired(lockUntil.plusSeconds(1));

        assertThat(user.getStatus()).isEqualTo(UserStatus.INACTIVE);
        assertThat(user.getLockedUntil()).isNull();
    }
}
