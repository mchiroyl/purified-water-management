package gt.com.aguapura.presentation.advice;

import gt.com.aguapura.infrastructure.configuration.TrafficSecurityProperties;
import gt.com.aguapura.infrastructure.security.SlidingWindowRateLimiter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class RequestGuardFilter extends OncePerRequestFilter {

    private static final Duration WINDOW = Duration.ofMinutes(1);
    private final TrafficSecurityProperties properties;
    private final SlidingWindowRateLimiter limiter;

    public RequestGuardFilter(TrafficSecurityProperties properties, SlidingWindowRateLimiter limiter) {
        this.properties = properties;
        this.limiter = limiter;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (!properties.enabled() || !request.getRequestURI().startsWith("/api/")) {
            filterChain.doFilter(request, response);
            return;
        }
        long contentLength = request.getContentLengthLong();
        String contentType = request.getContentType();
        if (contentLength > properties.maxJsonBytes() && contentType != null
                && contentType.toLowerCase(java.util.Locale.ROOT).startsWith(MediaType.APPLICATION_JSON_VALUE)) {
            reject(response, HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE, "REQUEST_TOO_LARGE",
                    "El cuerpo JSON supera el limite permitido.", request);
            return;
        }
        Instant now = Instant.now();
        String remoteAddress = request.getRemoteAddr();
        if (!limiter.tryAcquire("api:" + remoteAddress, properties.apiRequestsPerMinute(), WINDOW, now)) {
            rejectRate(response, request);
            return;
        }
        if ("/api/auth/login".equals(request.getRequestURI())
                && !limiter.tryAcquire("login:" + remoteAddress, properties.loginRequestsPerMinute(), WINDOW, now)) {
            rejectRate(response, request);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private void rejectRate(HttpServletResponse response, HttpServletRequest request) throws IOException {
        response.setHeader("Retry-After", "60");
        reject(response, 429, "RATE_LIMIT_EXCEEDED",
                "Demasiadas solicitudes. Intente nuevamente en un minuto.", request);
    }

    private void reject(HttpServletResponse response, int status, String code, String message,
                        HttpServletRequest request) throws IOException {
        Object correlation = request.getAttribute(CorrelationIdFilter.ATTRIBUTE);
        response.setStatus(status);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().write("{\"code\":\"" + code + "\",\"message\":\"" + message
                + "\",\"correlationId\":\"" + (correlation == null ? "unknown" : correlation) + "\"}");
    }
}
