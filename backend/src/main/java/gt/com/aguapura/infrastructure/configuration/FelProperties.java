package gt.com.aguapura.infrastructure.configuration;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.fel")
public record FelProperties(
        boolean enabled,
        String providerCode,
        String credentialSecretRef
) {
    public boolean validForActivation() {
        return enabled
                && providerCode != null && !providerCode.isBlank()
                && credentialSecretRef != null && !credentialSecretRef.isBlank();
    }
}
