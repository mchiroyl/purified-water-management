package gt.com.aguapura.infrastructure.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class MustChangePasswordFilterTest {

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void blocksOperationalRequestsUntilPasswordIsChanged() throws Exception {
        authenticate(true);
        var request = new MockHttpServletRequest("POST", "/api/sales");
        var response = new MockHttpServletResponse();

        new MustChangePasswordFilter().doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(403);
        assertThat(response.getContentAsString()).contains("PASSWORD_CHANGE_REQUIRED");
    }

    @Test
    void allowsThePasswordChangeEndpoint() throws Exception {
        authenticate(true);
        var request = new MockHttpServletRequest("POST", "/api/auth/change-password");
        var response = new MockHttpServletResponse();

        new MustChangePasswordFilter().doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(200);
    }

    private void authenticate(boolean mustChange) {
        Instant now = Instant.now();
        Jwt jwt = Jwt.withTokenValue("token").header("alg", "HS256").subject("user")
                .issuedAt(now).expiresAt(now.plusSeconds(60)).claim("mustChangePassword", mustChange).build();
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(jwt));
    }
}
