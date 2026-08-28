package gt.com.aguapura.application.dto.identity;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record DeviceEnrollmentInvitationResponse(
        UUID id, UUID userId, String username, String status, Instant createdAt, Instant expiresAt,
        String token, String payload
) {}
