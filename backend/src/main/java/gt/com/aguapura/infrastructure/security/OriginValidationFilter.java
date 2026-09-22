package gt.com.aguapura.infrastructure.security;

import gt.com.aguapura.infrastructure.configuration.SecurityProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 5)
public class OriginValidationFilter extends OncePerRequestFilter {

    private final SecurityProperties properties;

    public OriginValidationFilter(SecurityProperties properties) {
        this.properties = properties;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        boolean cookieAuthMutation = HttpMethod.POST.matches(request.getMethod())
                && (request.getRequestURI().equals("/api/auth/refresh") || request.getRequestURI().equals("/api/auth/logout"));
        if (cookieAuthMutation) {
            String fetchSite = request.getHeader("Sec-Fetch-Site");
            String origin = request.getHeader("Origin");
            boolean crossSite = "cross-site".equalsIgnoreCase(fetchSite);
            boolean foreignOrigin = origin == null ? crossSite : !properties.allowedOrigins().contains(origin);
            if (foreignOrigin) {
                response.sendError(HttpServletResponse.SC_FORBIDDEN);
                return;
            }
        }
        filterChain.doFilter(request, response);
    }
}
