package gt.com.aguapura.presentation.advice;

import gt.com.aguapura.infrastructure.configuration.TrafficSecurityProperties;
import gt.com.aguapura.infrastructure.security.SlidingWindowRateLimiter;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class RequestGuardFilterTest {

    @Test
    void rejectsOversizedJsonBeforeParsingIt() throws Exception {
        var properties = new TrafficSecurityProperties(true, 10, 600, 100);
        var filter = new RequestGuardFilter(properties, new SlidingWindowRateLimiter());
        var request = new MockHttpServletRequest("POST", "/api/sales");
        request.setContentType("application/json");
        request.setContent(new byte[101]);
        var response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(413);
        assertThat(response.getContentAsString()).contains("REQUEST_TOO_LARGE");
    }

    @Test
    void limitsRepeatedLoginAttemptsByRemoteAddress() throws Exception {
        var properties = new TrafficSecurityProperties(true, 1, 600, 1_000);
        var filter = new RequestGuardFilter(properties, new SlidingWindowRateLimiter());
        var first = loginRequest();
        var second = loginRequest();
        filter.doFilter(first, new MockHttpServletResponse(), new MockFilterChain());
        var response = new MockHttpServletResponse();

        filter.doFilter(second, response, new MockFilterChain());

        assertThat(response.getStatus()).isEqualTo(429);
        assertThat(response.getContentAsString()).contains("RATE_LIMIT_EXCEEDED");
    }

    private MockHttpServletRequest loginRequest() {
        var request = new MockHttpServletRequest("POST", "/api/auth/login");
        request.setRemoteAddr("127.0.0.1");
        request.setContentType("application/json");
        request.setContent("{}".getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return request;
    }
}
