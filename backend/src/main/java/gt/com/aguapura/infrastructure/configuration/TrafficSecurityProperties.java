package gt.com.aguapura.infrastructure.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.traffic")
public record TrafficSecurityProperties(
        boolean enabled,
        int loginRequestsPerMinute,
        int apiRequestsPerMinute,
        long maxJsonBytes
) {
}
