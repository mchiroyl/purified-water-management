package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.AuthorizationIncidentPort;
import gt.com.aguapura.application.ports.AuditMetadataPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcAuthorizationIncidentAdapter implements AuthorizationIncidentPort {
    private final JdbcClient jdbc;
    private final AuditMetadataPort auditMetadata;

    public JdbcAuthorizationIncidentAdapter(JdbcClient jdbc, AuditMetadataPort auditMetadata) {
        this.jdbc = jdbc; this.auditMetadata = auditMetadata;
    }

    @Override
    public boolean resourceExists(String entityType, UUID entityId) {
        String table = switch (entityType) {
            case "ROUTE_LOAD" -> "route_load";
            case "SETTLEMENT" -> "settlement";
            case "CUSTOMER" -> "customer";
            case "SALE" -> "sale";
            default -> null;
        };
        if (table == null) return false;
        return Boolean.TRUE.equals(jdbc.sql("SELECT EXISTS(SELECT 1 FROM " + table + " WHERE id=:id)")
                .param("id", entityId).query(Boolean.class).single());
    }

    @Override
    public boolean sellerOwnsResource(UUID userId, String entityType, UUID entityId) {
        String sql = switch (entityType) {
            case "ROUTE_LOAD" -> """
                    SELECT EXISTS(SELECT 1 FROM route_load rl JOIN route_assignment ra ON ra.route_id=rl.route_id
                    JOIN seller s ON s.id=ra.seller_id WHERE rl.id=:id AND s.user_id=:userId
                    AND ra.valid_from<=rl.planned_date AND (ra.valid_to IS NULL OR ra.valid_to>=rl.planned_date))
                    """;
            case "SETTLEMENT" -> """
                    SELECT EXISTS(SELECT 1 FROM settlement st JOIN route_assignment ra ON ra.route_id=st.route_id
                    JOIN seller s ON s.id=ra.seller_id WHERE st.id=:id AND s.user_id=:userId)
                    """;
            case "CUSTOMER" -> """
                    SELECT EXISTS(SELECT 1 FROM customer_route cr JOIN route_assignment ra ON ra.route_id=cr.route_id
                    JOIN seller s ON s.id=ra.seller_id WHERE cr.customer_id=:id AND s.user_id=:userId
                    AND cr.valid_to IS NULL AND ra.valid_to IS NULL)
                    """;
            case "SALE" -> """
                    SELECT EXISTS(SELECT 1 FROM sale sale JOIN seller s ON s.id=sale.seller_id
                    WHERE sale.id=:id AND s.user_id=:userId)
                    """;
            default -> "SELECT false";
        };
        return Boolean.TRUE.equals(jdbc.sql(sql).param("id", entityId).param("userId", userId)
                .query(Boolean.class).single());
    }

    @Override
    public AuthorizationView createAuthorization(NewAuthorization item) {
        jdbc.sql("""
                INSERT INTO authorization_request(id,authorization_type,entity_type,entity_id,requested_by,
                  requested_device_id,reason,expires_at) VALUES (:id,:type,:entityType,:entityId,:actor,:device,:reason,:expires)
                """).param("id", item.id()).param("type", item.authorizationType())
                .param("entityType", item.entityType()).param("entityId", item.entityId())
                .param("actor", item.requestedBy()).param("device", item.deviceId()).param("reason", item.reason())
                .param("expires", timestamp(item.expiresAt())).update();
        audit(item.requestedBy(), item.deviceId(), "AUTHORIZATION_REQUEST", "AUTHORIZATION", item.id(), "REQUESTED");
        return findAuthorization(item.id());
    }

    @Override
    public AuthorizationView findAuthorization(UUID id) {
        return jdbc.sql(authorizationSelect() + " WHERE ar.id=:id FOR UPDATE OF ar").param("id", id)
                .query((rs, row) -> authorizationRow(rs)).optional().orElseThrow(() -> notFound("AUTHORIZATION_NOT_FOUND"));
    }

    @Override
    public AuthorizationView decideAuthorization(UUID id, String status, UUID actorId, UUID deviceId, String notes) {
        int changed = jdbc.sql("""
                UPDATE authorization_request SET status=:status,decided_by=:actor,decided_device_id=:device,
                  decision_notes=:notes,decided_at=now() WHERE id=:id AND status='REQUESTED' AND expires_at>now()
                """).param("status", status).param("actor", actorId).param("device", deviceId)
                .param("notes", notes).param("id", id).update();
        if (changed != 1) throw conflict("AUTHORIZATION_CONCURRENT", "La solicitud cambió o expiró.");
        audit(actorId, deviceId, "AUTHORIZATION_" + status, "AUTHORIZATION", id, status);
        return findAuthorization(id);
    }

    @Override
    public AuthorizationView expireAuthorization(UUID id) {
        jdbc.sql("UPDATE authorization_request SET status='EXPIRED' WHERE id=:id AND status='REQUESTED'")
                .param("id", id).update();
        return findAuthorization(id);
    }

    @Override
    public void expirePending() {
        jdbc.sql("UPDATE authorization_request SET status='EXPIRED' WHERE status='REQUESTED' AND expires_at<=now()")
                .update();
    }

    @Override
    public List<AuthorizationView> findAuthorizations(Optional<UUID> requesterId) {
        String filter = requesterId.isPresent() ? " WHERE ar.requested_by=:userId" : "";
        var query = jdbc.sql(authorizationSelect() + filter + " ORDER BY ar.created_at DESC");
        if (requesterId.isPresent()) query = query.param("userId", requesterId.get());
        return query.query((rs, row) -> authorizationRow(rs)).list();
    }

    @Override
    public boolean sellerOwnsRoute(UUID userId, UUID routeId) {
        return Boolean.TRUE.equals(jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM route_assignment ra JOIN seller s ON s.id=ra.seller_id
                WHERE ra.route_id=:routeId AND s.user_id=:userId AND ra.valid_from<=current_date
                AND (ra.valid_to IS NULL OR ra.valid_to>=current_date))
                """).param("routeId", routeId).param("userId", userId).query(Boolean.class).single());
    }

    @Override
    public boolean settlementBelongsToRoute(UUID settlementId, UUID routeId) {
        return Boolean.TRUE.equals(jdbc.sql("SELECT EXISTS(SELECT 1 FROM settlement WHERE id=:id AND route_id=:routeId)")
                .param("id", settlementId).param("routeId", routeId).query(Boolean.class).single());
    }

    @Override
    public IncidentView createIncident(NewIncident item) {
        jdbc.sql("""
                INSERT INTO incident(id,route_id,settlement_id,reference_type,reference_id,incident_type,severity,
                  description,reported_by,reported_device_id)
                VALUES (:id,:routeId,:settlementId,:referenceType,:referenceId,:type,:severity,:description,:actor,:device)
                """).param("id", item.id()).param("routeId", item.routeId(), java.sql.Types.OTHER)
                .param("settlementId", item.settlementId(), java.sql.Types.OTHER)
                .param("referenceType", item.referenceType(), java.sql.Types.VARCHAR)
                .param("referenceId", item.referenceId(), java.sql.Types.OTHER).param("type", item.incidentType())
                .param("severity", item.severity()).param("description", item.description())
                .param("actor", item.reportedBy()).param("device", item.deviceId()).update();
        audit(item.reportedBy(), item.deviceId(), "INCIDENT_CREATE", "INCIDENT", item.id(), "OPEN");
        return findIncident(item.id());
    }

    @Override
    public IncidentView findIncident(UUID id) {
        return jdbc.sql(incidentSelect() + " WHERE i.id=:id FOR UPDATE OF i").param("id", id)
                .query((rs, row) -> incidentRow(rs)).optional().orElseThrow(() -> notFound("INCIDENT_NOT_FOUND"));
    }

    @Override
    public IncidentView actOnIncident(UUID id, String status, UUID actorId, UUID deviceId, String notes) {
        int changed = jdbc.sql("""
                UPDATE incident SET status=:status,handled_by=:actor,handled_device_id=:device,
                  resolution_notes=:notes,handled_at=now() WHERE id=:id AND status IN ('OPEN','INVESTIGATING')
                """).param("status", status).param("actor", actorId).param("device", deviceId)
                .param("notes", notes).param("id", id).update();
        if (changed != 1) throw conflict("INCIDENT_CONCURRENT", "La incidencia ya tiene estado final.");
        audit(actorId, deviceId, "INCIDENT_" + status, "INCIDENT", id, status);
        return findIncident(id);
    }

    @Override
    public List<IncidentView> findIncidents(Optional<UUID> sellerUserId) {
        String filter = sellerUserId.isPresent() ? " WHERE (i.reported_by=:userId OR EXISTS(SELECT 1 FROM route_assignment ra JOIN seller own ON own.id=ra.seller_id WHERE ra.route_id=i.route_id AND own.user_id=:userId))" : "";
        var query = jdbc.sql(incidentSelect() + filter + " ORDER BY i.created_at DESC");
        if (sellerUserId.isPresent()) query = query.param("userId", sellerUserId.get());
        return query.query((rs, row) -> incidentRow(rs)).list();
    }

    private String authorizationSelect() {
        return """
                SELECT ar.*,requester.username requested_by_username,decider.username decided_by_username
                FROM authorization_request ar JOIN app_user requester ON requester.id=ar.requested_by
                LEFT JOIN app_user decider ON decider.id=ar.decided_by
                """;
    }
    private AuthorizationView authorizationRow(ResultSet rs) throws SQLException {
        return new AuthorizationView(rs.getObject("id", UUID.class), rs.getString("authorization_type"),
                rs.getString("entity_type"), rs.getObject("entity_id", UUID.class),
                rs.getObject("requested_by", UUID.class), rs.getString("requested_by_username"),
                rs.getString("reason"), rs.getString("status"), instant(rs, "expires_at"),
                rs.getObject("decided_by", UUID.class), rs.getString("decided_by_username"),
                rs.getString("decision_notes"), instant(rs, "decided_at"), instant(rs, "created_at"));
    }
    private String incidentSelect() {
        return """
                SELECT i.*,r.code route_code,r.name route_name,reporter.username reported_by_username,
                  handler.username handled_by_username FROM incident i LEFT JOIN route r ON r.id=i.route_id
                JOIN app_user reporter ON reporter.id=i.reported_by LEFT JOIN app_user handler ON handler.id=i.handled_by
                """;
    }
    private IncidentView incidentRow(ResultSet rs) throws SQLException {
        return new IncidentView(rs.getObject("id", UUID.class), rs.getObject("route_id", UUID.class),
                rs.getString("route_code"), rs.getString("route_name"), rs.getObject("settlement_id", UUID.class),
                rs.getString("reference_type"), rs.getObject("reference_id", UUID.class), rs.getString("incident_type"),
                rs.getString("severity"), rs.getString("status"), rs.getString("description"),
                rs.getObject("reported_by", UUID.class), rs.getString("reported_by_username"),
                rs.getObject("handled_by", UUID.class), rs.getString("handled_by_username"),
                rs.getString("resolution_notes"), instant(rs, "created_at"), instant(rs, "handled_at"));
    }
    private void audit(UUID userId, UUID deviceId, String action, String entityType, UUID entityId, String status) {
        jdbc.sql("""
                INSERT INTO audit_log(user_id,device_id,action,entity_type,entity_id,after_data,correlation_id,ip_address)
                VALUES (:userId,:deviceId,:action,:entityType,:entityId,jsonb_build_object('status',:status),:correlation,:ip)
                """).param("userId", userId).param("deviceId", deviceId).param("action", action)
                .param("entityType", entityType).param("entityId", entityId).param("status", status)
                .param("correlation", auditMetadata.current().correlationId())
                .param("ip", auditMetadata.current().ipAddress()).update();
    }
    private Instant instant(ResultSet rs, String column) throws SQLException {
        var value=rs.getTimestamp(column); return value==null?null:value.toInstant();
    }
    static OffsetDateTime timestamp(Instant value) { return value==null?null:value.atOffset(ZoneOffset.UTC); }
    private BusinessException notFound(String code) { return new BusinessException(code, "No se encontró el registro.", ErrorCategory.NOT_FOUND); }
    private BusinessException conflict(String code, String message) { return new BusinessException(code, message, ErrorCategory.CONFLICT); }
}
