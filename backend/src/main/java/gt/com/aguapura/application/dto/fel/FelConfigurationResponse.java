package gt.com.aguapura.application.dto.fel;

import java.time.Instant;
import java.util.UUID;

public record FelConfigurationResponse(
        UUID id,
        boolean enabled,
        String providerCode,
        String environment,
        String establishmentCode,
        boolean providerAdapterInstalled,
        boolean credentialsConfigured,
        boolean activationAvailable,
        String statusMessage,
        long version,
        Instant updatedAt
) {
}
