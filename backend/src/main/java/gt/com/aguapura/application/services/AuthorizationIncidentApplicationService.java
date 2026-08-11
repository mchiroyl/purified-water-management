package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.authorization.AuthorizationDecisionRequest;
import gt.com.aguapura.application.dto.authorization.AuthorizationResponse;
import gt.com.aguapura.application.dto.authorization.CreateAuthorizationRequest;
import gt.com.aguapura.application.dto.authorization.CreateIncidentRequest;
import gt.com.aguapura.application.dto.authorization.IncidentActionRequest;
import gt.com.aguapura.application.dto.authorization.IncidentResponse;
import gt.com.aguapura.application.ports.AuthorizationIncidentPort;
import gt.com.aguapura.domain.authorization.AuthorizationDecisionPolicy;
import gt.com.aguapura.domain.authorization.IncidentResolutionPolicy;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthorizationIncidentApplicationService {
    private final AuthorizationIncidentPort persistence;

    public AuthorizationIncidentApplicationService(AuthorizationIncidentPort persistence) {
        this.persistence = persistence;
    }

    @Transactional
    public AuthorizationResponse request(CreateAuthorizationRequest request, UUID actorId, UUID deviceId,
                                         boolean restrictedToSeller) {
        if (request.expiresAt().isAfter(Instant.now().plus(Duration.ofDays(7)))) throw validation(
                "AUTHORIZATION_EXPIRY_LIMIT", "La autorización no puede tener vigencia mayor a siete días.");
        if (!persistence.resourceExists(request.entityType(), request.entityId())) throw validation(
                "AUTHORIZATION_RESOURCE_INVALID", "El recurso solicitado no existe.");
        if (restrictedToSeller && !persistence.sellerOwnsResource(actorId, request.entityType(), request.entityId())) {
            throw forbidden("AUTHORIZATION_RESOURCE_FORBIDDEN", "El recurso no pertenece al vendedor.");
        }
        return response(persistence.createAuthorization(new AuthorizationIncidentPort.NewAuthorization(
                UUID.randomUUID(), request.authorizationType(), request.entityType(), request.entityId(), actorId,
                deviceId, request.reason().trim(), request.expiresAt())));
    }

    @Transactional
    public AuthorizationResponse decide(UUID id, AuthorizationDecisionRequest request, UUID actorId, UUID deviceId) {
        var item = persistence.findAuthorization(id);
        String status = AuthorizationDecisionPolicy.decide(item.status(), item.requestedBy(), actorId,
                item.expiresAt(), Instant.now(), request.decision());
        return response("EXPIRED".equals(status) ? persistence.expireAuthorization(id)
                : persistence.decideAuthorization(id, status, actorId, deviceId, request.notes().trim()));
    }

    @Transactional
    public List<AuthorizationResponse> findAuthorizations(UUID actorId, boolean restrictedToSeller) {
        persistence.expirePending();
        return persistence.findAuthorizations(restrictedToSeller ? Optional.of(actorId) : Optional.empty())
                .stream().map(this::response).toList();
    }

    @Transactional
    public IncidentResponse reportIncident(CreateIncidentRequest request, UUID actorId, UUID deviceId,
                                           boolean restrictedToSeller) {
        if ((request.referenceType() == null) != (request.referenceId() == null)) throw validation(
                "INCIDENT_REFERENCE_PAIR", "La referencia debe incluir tipo e identificador.");
        if (request.routeId() == null && request.settlementId() == null && request.referenceId() == null) {
            throw validation("INCIDENT_CONTEXT_REQUIRED", "La incidencia requiere una ruta, liquidación o referencia.");
        }
        if (request.routeId() != null && restrictedToSeller && !persistence.sellerOwnsRoute(actorId, request.routeId())) {
            throw forbidden("INCIDENT_ROUTE_FORBIDDEN", "La ruta no pertenece al vendedor.");
        }
        if (request.settlementId() != null && restrictedToSeller
                && !persistence.sellerOwnsResource(actorId, "SETTLEMENT", request.settlementId())) {
            throw forbidden("INCIDENT_SETTLEMENT_FORBIDDEN", "La liquidación no pertenece al vendedor.");
        }
        if (request.settlementId() != null && request.routeId() != null
                && !persistence.settlementBelongsToRoute(request.settlementId(), request.routeId())) {
            throw validation("INCIDENT_SETTLEMENT_ROUTE", "La liquidación no corresponde a la ruta.");
        }
        String referenceType = blankToNull(request.referenceType());
        if (referenceType != null && !persistence.resourceExists(referenceType, request.referenceId())) {
            throw validation("INCIDENT_REFERENCE_INVALID", "La referencia de la incidencia no existe o no es válida.");
        }
        if (referenceType != null && restrictedToSeller
                && !persistence.sellerOwnsResource(actorId, referenceType, request.referenceId())) {
            throw forbidden("INCIDENT_REFERENCE_FORBIDDEN", "La referencia no pertenece al vendedor.");
        }
        return incident(persistence.createIncident(new AuthorizationIncidentPort.NewIncident(UUID.randomUUID(),
                request.routeId(), request.settlementId(), referenceType, request.referenceId(),
                request.incidentType(), request.severity(), request.description().trim(), actorId, deviceId)));
    }

    @Transactional
    public IncidentResponse actOnIncident(UUID id, IncidentActionRequest request, UUID actorId, UUID deviceId) {
        var item = persistence.findIncident(id);
        String status = IncidentResolutionPolicy.transition(item.status(), item.reportedBy(), actorId, request.action());
        String notes = request.notes() == null ? "" : request.notes().trim();
        if (("RESOLVED".equals(status) || "DISMISSED".equals(status)) && notes.isEmpty()) throw validation(
                "INCIDENT_RESOLUTION_NOTES", "Resolver o descartar requiere notas.");
        return incident(persistence.actOnIncident(id, status, actorId, deviceId, notes));
    }

    @Transactional(readOnly = true)
    public List<IncidentResponse> findIncidents(UUID actorId, boolean restrictedToSeller) {
        return persistence.findIncidents(restrictedToSeller ? Optional.of(actorId) : Optional.empty())
                .stream().map(this::incident).toList();
    }

    private AuthorizationResponse response(AuthorizationIncidentPort.AuthorizationView item) {
        return new AuthorizationResponse(item.id(), item.authorizationType(), item.entityType(), item.entityId(),
                item.requestedBy(), item.requestedByUsername(), item.reason(), item.status(), item.expiresAt(),
                item.decidedBy(), item.decidedByUsername(), item.decisionNotes(), item.decidedAt(), item.createdAt());
    }
    private IncidentResponse incident(AuthorizationIncidentPort.IncidentView item) {
        return new IncidentResponse(item.id(), item.routeId(), item.routeCode(), item.routeName(), item.settlementId(),
                item.referenceType(), item.referenceId(), item.incidentType(), item.severity(), item.status(),
                item.description(), item.reportedBy(), item.reportedByUsername(), item.handledBy(),
                item.handledByUsername(), item.resolutionNotes(), item.createdAt(), item.handledAt());
    }
    private String blankToNull(String value) { return value == null || value.isBlank() ? null : value.trim().toUpperCase(); }
    private BusinessException validation(String code, String message) { return new BusinessException(code, message, ErrorCategory.VALIDATION); }
    private BusinessException forbidden(String code, String message) { return new BusinessException(code, message, ErrorCategory.FORBIDDEN); }
}
