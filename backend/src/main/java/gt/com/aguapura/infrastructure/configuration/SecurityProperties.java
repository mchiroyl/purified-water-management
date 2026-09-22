package gt.com.aguapura.infrastructure.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;
import gt.com.aguapura.application.ports.SessionPolicy;

import java.time.Duration;
import java.util.List;

@ConfigurationProperties(prefix = "app.security")
public record SecurityProperties(
        String issuer,
        String secretBase64,
        long accessTokenMinutes,
        long refreshTokenDays,
        boolean cookieSecure,
        List<String> allowedOrigins
) implements SessionPolicy {
    public SecurityProperties {
        if (allowedOrigins != null) {
            allowedOrigins = allowedOrigins.stream().map(String::trim).toList();
        }
    }

    public Duration accessTokenDuration() {
        return Duration.ofMinutes(accessTokenMinutes);
    }

    public Duration refreshTokenDuration() {
        return Duration.ofDays(refreshTokenDays);
    }
}
