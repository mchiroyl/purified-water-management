package gt.com.aguapura.infrastructure.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.bootstrap")
public record BootstrapProperties(
        String username,
        String email,
        String password,
        boolean forcePasswordChange
) {
}
