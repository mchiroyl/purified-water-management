package gt.com.aguapura.application.ports;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AuthorizationIncidentPort {
    boolean resourceExists(String entityType, UUID entityId);
    boolean sellerOwnsResource(UUID userId, String entityType, UUID entityId);
    AuthorizationView createAuthorization(NewAuthorization item);
    AuthorizationView findAuthorization(UUID id);
    AuthorizationView decideAuthorization(UUID id, String status, UUID actorId, UUID deviceId, String notes);
    AuthorizationView expireAuthorization(UUID id);
    void expirePending();
    List<AuthorizationView> findAuthorizations(Optional<UUID> requesterId);
    boolean sellerOwnsRoute(UUID userId, UUID routeId);
    boolean settlementBelongsToRoute(UUID settlementId, UUID routeId);
    IncidentView createIncident(NewIncident item);
    IncidentView findIncident(UUID id);
    IncidentView actOnIncident(UUID id, String status, UUID actorId, UUID deviceId, String notes);
    List<IncidentView> findIncidents(Optional<UUID> sellerUserId);

    record NewAuthorization(UUID id, String authorizationType, String entityType, UUID entityId,
                            UUID requestedBy, UUID deviceId, String reason, Instant expiresAt) {}
    record AuthorizationView(UUID id, String authorizationType, String entityType, UUID entityId,
                             UUID requestedBy, String requestedByUsername, String reason, String status,
                             Instant expiresAt, UUID decidedBy, String decidedByUsername,
                             String decisionNotes, Instant decidedAt, Instant createdAt) {}
    record NewIncident(UUID id, UUID routeId, UUID settlementId, String referenceType, UUID referenceId,
                       String incidentType, String severity, String description, UUID reportedBy,
                       UUID deviceId) {}
    record IncidentView(UUID id, UUID routeId, String routeCode, String routeName, UUID settlementId,
                        String referenceType, UUID referenceId, String incidentType, String severity,
                        String status, String description, UUID reportedBy, String reportedByUsername,
                        UUID handledBy, String handledByUsername, String resolutionNotes,
                        Instant createdAt, Instant handledAt) {}
}
