package gt.com.aguapura.application.dto.authorization;

import java.time.Instant;
import java.util.UUID;

public record AuthorizationResponse(UUID id, String authorizationType, String entityType, UUID entityId,
                                    UUID requestedBy, String requestedByUsername, String reason, String status,
                                    Instant expiresAt, UUID decidedBy, String decidedByUsername,
                                    String decisionNotes, Instant decidedAt, Instant createdAt) {
}
