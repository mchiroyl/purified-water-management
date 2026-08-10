package gt.com.aguapura.application.dto.identity;

import java.time.Instant;
import java.util.UUID;

public record DeviceAdministrationResponse(
        UUID id, UUID userId, String username, String friendlyName, String status, String appVersion,
        Instant firstSeenAt, Instant lastSeenAt, Instant revokedAt
) {}
