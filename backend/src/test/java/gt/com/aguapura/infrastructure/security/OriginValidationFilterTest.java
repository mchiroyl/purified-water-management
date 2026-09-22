package gt.com.aguapura.infrastructure.security;

import gt.com.aguapura.infrastructure.configuration.SecurityProperties;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OriginValidationFilterTest {

    private final OriginValidationFilter filter = new OriginValidationFilter(new SecurityProperties(
            "issuer", "secret", 15, 7, false, List.of("http://localhost:3000")));

    @Test
    void rejectsCrossSiteRefresh() throws Exception {
        var request = new MockHttpServletRequest("POST", "/api/auth/refresh");
        request.addHeader("Origin", "https://attacker.invalid");
        request.addHeader("Sec-Fetch-Site", "cross-site");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(403);
    }

    @Test
    void allowsConfiguredOrigin() throws Exception {
        var request = new MockHttpServletRequest("POST", "/api/auth/refresh");
        request.addHeader("Origin", "http://localhost:3000");
        request.addHeader("Sec-Fetch-Site", "same-site");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void allowsConfiguredOriginWhenCrossSite() throws Exception {
        var request = new MockHttpServletRequest("POST", "/api/auth/refresh");
        request.addHeader("Origin", "http://localhost:3000");
        request.addHeader("Sec-Fetch-Site", "cross-site");
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(200);
    }
}
