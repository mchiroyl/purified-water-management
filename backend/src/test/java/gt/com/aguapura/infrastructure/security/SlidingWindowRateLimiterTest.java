package gt.com.aguapura.infrastructure.security;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class SlidingWindowRateLimiterTest {

    @Test
    void rejectsRequestsBeyondTheBudgetAndRecoversAfterTheWindow() {
        var limiter = new SlidingWindowRateLimiter();
        Instant start = Instant.parse("2026-08-11T10:00:00Z");

        assertThat(limiter.tryAcquire("login:127.0.0.1", 2, Duration.ofMinutes(1), start)).isTrue();
        assertThat(limiter.tryAcquire("login:127.0.0.1", 2, Duration.ofMinutes(1), start.plusSeconds(1))).isTrue();
        assertThat(limiter.tryAcquire("login:127.0.0.1", 2, Duration.ofMinutes(1), start.plusSeconds(2))).isFalse();
        assertThat(limiter.tryAcquire("login:127.0.0.1", 2, Duration.ofMinutes(1), start.plusSeconds(61))).isTrue();
    }
}
