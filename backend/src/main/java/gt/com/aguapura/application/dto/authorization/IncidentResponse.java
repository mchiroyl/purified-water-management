package gt.com.aguapura.application.dto.authorization;

import java.time.Instant;
import java.util.UUID;

public record IncidentResponse(UUID id, UUID routeId, String routeCode, String routeName,
                               UUID settlementId, String referenceType, UUID referenceId,
                               String incidentType, String severity, String status, String description,
                               UUID reportedBy, String reportedByUsername, UUID handledBy,
                               String handledByUsername, String resolutionNotes, Instant createdAt,
                               Instant handledAt) {
}
