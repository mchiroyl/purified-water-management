package gt.com.aguapura.infrastructure.security;

import gt.com.aguapura.application.ports.AccessPrincipalStatePort;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ActivePrincipalJwtValidatorTest {

    @Test
    void rejectsATokenAfterItsUserOrDeviceIsRevoked() {
        var state = mock(AccessPrincipalStatePort.class);
        UUID userId = UUID.randomUUID();
        UUID deviceId = UUID.randomUUID();
        when(state.matchesActivePrincipal(userId, deviceId, Set.of("VENDEDOR"))).thenReturn(false);
        var validator = new ActivePrincipalJwtValidator(state);
        Instant now = Instant.now();
        Jwt jwt = Jwt.withTokenValue("token").header("alg", "HS256").subject("seller")
                .issuedAt(now).expiresAt(now.plusSeconds(60))
                .claim("userId", userId.toString()).claim("deviceId", deviceId.toString())
                .claim("roles", List.of("VENDEDOR")).build();

        assertThat(validator.validate(jwt).hasErrors()).isTrue();
    }
}
