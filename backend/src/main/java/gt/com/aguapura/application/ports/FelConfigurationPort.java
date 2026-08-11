package gt.com.aguapura.application.ports;

import java.time.Instant;
import java.util.UUID;

public interface FelConfigurationPort {
    Configuration get();
    Configuration update(Update update);

    record Update(boolean enabled, String providerCode, String environment, String establishmentCode,
                  long version, UUID actorId, UUID deviceId) {
    }

    record Configuration(UUID id, boolean enabled, String providerCode, boolean credentialsConfigured,
                         String environment, String establishmentCode, long version, Instant updatedAt) {
    }
}
