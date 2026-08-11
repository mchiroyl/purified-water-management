package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.WastePort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcWasteAdapter implements WastePort {
    private final JdbcClient jdbc;

    public JdbcWasteAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean sellerAssignedToRoute(UUID userId, UUID routeId) {
        return Boolean.TRUE.equals(jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM route_assignment ra JOIN seller s ON s.id=ra.seller_id
                WHERE ra.route_id=:routeId AND s.user_id=:userId AND s.status='ACTIVE'
                  AND ra.valid_from<=current_date AND (ra.valid_to IS NULL OR ra.valid_to>=current_date))
                """).param("routeId", routeId).param("userId", userId).query(Boolean.class).single());
    }

    @Override
    public Optional<RouteContext> findRouteContext(UUID routeId) {
        return jdbc.sql("""
                SELECT r.id route_id,r.code route_code,r.name route_name,il.id inventory_location_id,
                       s.id seller_id,s.display_name seller_name
                FROM route r JOIN inventory_location il ON il.route_id=r.id AND il.active
                JOIN LATERAL (
                    SELECT ra.seller_id FROM route_assignment ra WHERE ra.route_id=r.id
                      AND ra.valid_from<=current_date AND (ra.valid_to IS NULL OR ra.valid_to>=current_date)
                    ORDER BY ra.valid_from DESC LIMIT 1
                ) current_assignment ON true
                JOIN seller s ON s.id=current_assignment.seller_id AND s.status='ACTIVE'
                WHERE r.id=:id AND r.status='ACTIVE'
                """).param("id", routeId).query((rs, row) -> new RouteContext(
                rs.getObject("route_id", UUID.class), rs.getString("route_code"), rs.getString("route_name"),
                rs.getObject("inventory_location_id", UUID.class), rs.getObject("seller_id", UUID.class),
                rs.getString("seller_name"))).optional();
    }

    @Override
    public Optional<PresentationView> findPresentation(UUID presentationId) {
        return jdbc.sql("""
                SELECT pp.id presentation_id,pp.code presentation_code,pp.name presentation_name,
                       p.id product_id,p.code product_code,p.name product_name,pc.conversion_factor
                FROM product_presentation pp JOIN product p ON p.id=pp.product_id
                JOIN presentation_conversion pc ON pc.presentation_id=pp.id AND pc.valid_to IS NULL
                WHERE pp.id=:id AND pp.active AND p.active AND p.controls_inventory
                """).param("id", presentationId).query((rs, row) -> new PresentationView(
                rs.getObject("presentation_id", UUID.class), rs.getString("presentation_code"),
                rs.getString("presentation_name"), rs.getObject("product_id", UUID.class),
                rs.getString("product_code"), rs.getString("product_name"),
                rs.getBigDecimal("conversion_factor"))).optional();
    }

    @Override
    public Optional<WasteTypeView> findWasteType(UUID id) {
        return jdbc.sql(wasteTypeSelect() + " WHERE id=:id").param("id", id)
                .query((rs, row) -> wasteTypeRow(rs)).optional();
    }

    @Override
    public WasteView create(NewWaste item) {
        jdbc.sql("""
                INSERT INTO waste(id,client_reference,route_id,inventory_location_id,seller_id,reported_by,
                    device_id,status,reason,occurred_at_local)
                VALUES (:id,:clientReference,:routeId,:locationId,:sellerId,:reportedBy,:deviceId,
                    'PENDING_REVIEW',:reason,:occurredAt)
                """).param("id", item.id()).param("clientReference", item.clientReference())
                .param("routeId", item.route().routeId()).param("locationId", item.route().inventoryLocationId())
                .param("sellerId", item.route().sellerId()).param("reportedBy", item.reportedBy())
                .param("deviceId", item.deviceId()).param("reason", item.reason())
                .param("occurredAt", databaseTimestamp(item.occurredAtLocal())).update();
        for (var row : item.items()) {
            jdbc.sql("""
                    INSERT INTO waste_item(id,waste_id,waste_type_id,presentation_id,product_id,
                        presentation_quantity,reported_base_units,recoverable_base_units)
                    VALUES (:id,:wasteId,:typeId,:presentationId,:productId,:presentationQuantity,
                        :reported,:recoverable)
                    """).param("id", row.id()).param("wasteId", item.id())
                    .param("typeId", row.wasteType().id()).param("presentationId", row.presentation().presentationId())
                    .param("productId", row.presentation().productId())
                    .param("presentationQuantity", row.presentationQuantity())
                    .param("reported", row.reportedBaseUnits()).param("recoverable", row.recoverableBaseUnits())
                    .update();
        }
        for (var row : item.evidence()) {
            jdbc.sql("""
                    INSERT INTO waste_evidence(id,waste_id,storage_reference,media_type,sha256,
                        captured_device_id,captured_at_local)
                    VALUES (:id,:wasteId,:reference,:mediaType,:sha256,:deviceId,:capturedAt)
                    """).param("id", row.id()).param("wasteId", item.id())
                    .param("reference", row.storageReference()).param("mediaType", row.mediaType())
                    .param("sha256", row.sha256()).param("deviceId", item.deviceId())
                    .param("capturedAt", databaseTimestamp(row.capturedAtLocal())).update();
        }
        createSuspicionAlerts(item);
        return findWaste(item.id());
    }

    @Override
    public WasteView findForReview(UUID id) {
        var base = jdbc.sql(wasteSelect() + " AND w.id=:id FOR UPDATE OF w").param("id", id)
                .query((rs, row) -> wasteRow(rs)).optional().orElseThrow(() -> notFound(
                        "WASTE_NOT_FOUND", "No se encontró la merma."));
        return withDetails(base);
    }

    @Override
    public WasteView review(NewReview item) {
        jdbc.sql("""
                INSERT INTO waste_review(id,waste_id,reviewer_id,reviewer_role,decision,
                    approved_base_units,notes)
                VALUES (:id,:wasteId,:reviewerId,:role,:decision,:approved,:notes)
                """).param("id", UUID.randomUUID()).param("wasteId", item.wasteId())
                .param("reviewerId", item.reviewerId()).param("role", item.reviewerRole())
                .param("decision", item.finalDecision() ? item.decision() : "ESCALATE")
                .param("approved", item.approvedBaseUnits()).param("notes", item.notes()).update();
        for (var approval : item.items()) {
            jdbc.sql(item.finalDecision() ? """
                    UPDATE waste_item SET proposed_approved_base_units=:approved,
                        approved_base_units=:approved WHERE id=:itemId AND waste_id=:wasteId
                    """ : """
                    UPDATE waste_item SET proposed_approved_base_units=:approved
                    WHERE id=:itemId AND waste_id=:wasteId
                    """).param("approved", approval.approvedBaseUnits()).param("itemId", approval.itemId())
                    .param("wasteId", item.wasteId()).update();
        }
        int changed = jdbc.sql("""
                UPDATE waste SET status=:status,required_role=:requiredRole
                WHERE id=:id AND status IN ('PENDING_REVIEW','PENDING_SECOND_APPROVAL')
                """).param("status", item.status()).param("requiredRole", item.requiredRole(), Types.VARCHAR)
                .param("id", item.wasteId()).update();
        if (changed != 1) throw new BusinessException("WASTE_CONCURRENT_REVIEW",
                "La merma cambió durante la revisión.", ErrorCategory.CONFLICT);
        return findWaste(item.wasteId());
    }

    @Override
    public List<WasteView> findWastes(Optional<UUID> sellerUserId) {
        String filter = sellerUserId.isPresent() ? " AND seller.user_id=:sellerUserId" : "";
        var statement = jdbc.sql(wasteSelect() + filter + " ORDER BY w.received_at_server DESC");
        if (sellerUserId.isPresent()) statement = statement.param("sellerUserId", sellerUserId.get());
        return statement.query((rs, row) -> wasteRow(rs)).list().stream().map(this::withDetails).toList();
    }

    @Override
    public List<WasteTypeView> findWasteTypes(boolean includeInactive) {
        return jdbc.sql(wasteTypeSelect() + (includeInactive ? "" : " WHERE active") + " ORDER BY name,code")
                .query((rs, row) -> wasteTypeRow(rs)).list();
    }

    @Override
    public WasteTypeView saveWasteType(WasteTypeDefinition item) {
        jdbc.sql("""
                INSERT INTO waste_type(id,code,name,evidence_policy,warehouse_approval_limit_base_units,
                    supervisor_approval_limit_base_units,daily_alert_threshold,active)
                VALUES (:id,:code,:name,:evidence,:warehouseLimit,:supervisorLimit,:dailyThreshold,:active)
                ON CONFLICT (id) DO UPDATE SET code=EXCLUDED.code,name=EXCLUDED.name,
                    evidence_policy=EXCLUDED.evidence_policy,
                    warehouse_approval_limit_base_units=EXCLUDED.warehouse_approval_limit_base_units,
                    supervisor_approval_limit_base_units=EXCLUDED.supervisor_approval_limit_base_units,
                    daily_alert_threshold=EXCLUDED.daily_alert_threshold,active=EXCLUDED.active,updated_at=now()
                """).param("id", item.id()).param("code", item.code()).param("name", item.name())
                .param("evidence", item.evidencePolicy()).param("warehouseLimit", item.warehouseApprovalLimitBaseUnits())
                .param("supervisorLimit", item.supervisorApprovalLimitBaseUnits())
                .param("dailyThreshold", item.dailyAlertThreshold()).param("active", item.active()).update();
        return findWasteType(item.id()).orElseThrow();
    }

    @Override
    public List<WasteIndicatorView> indicators() {
        return jdbc.sql("""
                SELECT w.seller_id,s.display_name seller_name,w.route_id,r.name route_name,wi.product_id,
                       p.name product_name,count(DISTINCT w.id) report_count,
                       sum(wi.reported_base_units) reported_base_units,
                       sum(wi.approved_base_units) approved_base_units,
                       count(DISTINCT a.id) FILTER (WHERE a.status IN ('OPEN','INVESTIGATING')) open_alerts
                FROM waste w JOIN seller s ON s.id=w.seller_id JOIN route r ON r.id=w.route_id
                JOIN waste_item wi ON wi.waste_id=w.id JOIN product p ON p.id=wi.product_id
                LEFT JOIN alert a ON a.reference_type='WASTE' AND a.reference_id=w.id
                GROUP BY w.seller_id,s.display_name,w.route_id,r.name,wi.product_id,p.name
                ORDER BY report_count DESC,reported_base_units DESC
                """).query((rs, row) -> new WasteIndicatorView(rs.getObject("seller_id", UUID.class),
                rs.getString("seller_name"), rs.getObject("route_id", UUID.class), rs.getString("route_name"),
                rs.getObject("product_id", UUID.class), rs.getString("product_name"),
                rs.getLong("report_count"), rs.getBigDecimal("reported_base_units"),
                rs.getBigDecimal("approved_base_units"), rs.getLong("open_alerts"))).list();
    }

    private void createSuspicionAlerts(NewWaste item) {
        for (var type : item.items().stream().map(NewWasteItem::wasteType).distinct().toList()) {
            long daily = jdbc.sql("""
                    SELECT count(DISTINCT w.id) FROM waste w JOIN waste_item wi ON wi.waste_id=w.id
                    WHERE w.seller_id=:sellerId AND wi.waste_type_id=:typeId
                      AND w.received_at_server>=date_trunc('day',now())
                    """).param("sellerId", item.route().sellerId()).param("typeId", type.id())
                    .query(Long.class).single();
            if (daily >= type.dailyAlertThreshold()) {
                String details = "{\"dailyCount\":" + daily + ",\"threshold\":" + type.dailyAlertThreshold()
                        + ",\"conclusion\":\"REQUIRES_HUMAN_INVESTIGATION\"}";
                jdbc.sql("""
                        INSERT INTO alert(id,alert_type,severity,reference_type,reference_id,title,details)
                        VALUES (:id,'WASTE_FREQUENCY','WARNING','WASTE',:wasteId,:title,CAST(:details AS jsonb))
                        ON CONFLICT (alert_type,reference_type,reference_id) DO NOTHING
                        """).param("id", UUID.randomUUID()).param("wasteId", item.id())
                        .param("title", "Frecuencia de merma requiere investigación")
                        .param("details", details).update();
            }
        }
    }

    private WasteView findWaste(UUID id) {
        var base = jdbc.sql(wasteSelect() + " AND w.id=:id").param("id", id)
                .query((rs, row) -> wasteRow(rs)).optional().orElseThrow(() -> notFound(
                        "WASTE_NOT_FOUND", "No se encontró la merma."));
        return withDetails(base);
    }

    private WasteView withDetails(WasteView waste) {
        var items = jdbc.sql("""
                SELECT wi.id,wi.waste_id,wi.waste_type_id,wt.code waste_type_code,wt.name waste_type_name,
                       wt.evidence_policy,wi.presentation_id,pp.code presentation_code,pp.name presentation_name,
                       wi.product_id,p.code product_code,p.name product_name,wi.presentation_quantity,
                       wi.reported_base_units,wi.recoverable_base_units,wi.approved_base_units,
                       wt.warehouse_approval_limit_base_units,wt.supervisor_approval_limit_base_units
                FROM waste_item wi JOIN waste_type wt ON wt.id=wi.waste_type_id
                JOIN product_presentation pp ON pp.id=wi.presentation_id JOIN product p ON p.id=wi.product_id
                WHERE wi.waste_id=:id ORDER BY p.name,pp.name,wt.name
                """).param("id", waste.id()).query((rs, row) -> new WasteItemView(
                rs.getObject("id", UUID.class), rs.getObject("waste_id", UUID.class),
                rs.getObject("waste_type_id", UUID.class), rs.getString("waste_type_code"),
                rs.getString("waste_type_name"), rs.getString("evidence_policy"),
                rs.getObject("presentation_id", UUID.class), rs.getString("presentation_code"),
                rs.getString("presentation_name"), rs.getObject("product_id", UUID.class),
                rs.getString("product_code"), rs.getString("product_name"),
                rs.getBigDecimal("presentation_quantity"), rs.getBigDecimal("reported_base_units"),
                rs.getBigDecimal("recoverable_base_units"), rs.getBigDecimal("approved_base_units"),
                rs.getBigDecimal("warehouse_approval_limit_base_units"),
                rs.getBigDecimal("supervisor_approval_limit_base_units"))).list();
        var evidence = jdbc.sql("""
                SELECT id,storage_reference,media_type,sha256,captured_device_id,captured_at_local
                FROM waste_evidence WHERE waste_id=:id ORDER BY captured_at_local,id
                """).param("id", waste.id()).query((rs, row) -> new EvidenceView(
                rs.getObject("id", UUID.class), rs.getString("storage_reference"), rs.getString("media_type"),
                rs.getString("sha256"), rs.getObject("captured_device_id", UUID.class),
                instant(rs, "captured_at_local"))).list();
        var reviews = jdbc.sql("""
                SELECT wr.id,wr.reviewer_id,u.username reviewer_username,wr.reviewer_role,wr.decision,
                       wr.approved_base_units,wr.notes,wr.reviewed_at
                FROM waste_review wr JOIN app_user u ON u.id=wr.reviewer_id
                WHERE wr.waste_id=:id ORDER BY wr.reviewed_at,wr.id
                """).param("id", waste.id()).query((rs, row) -> new ReviewView(
                rs.getObject("id", UUID.class), rs.getObject("reviewer_id", UUID.class),
                rs.getString("reviewer_username"), rs.getString("reviewer_role"), rs.getString("decision"),
                rs.getBigDecimal("approved_base_units"), rs.getString("notes"),
                instant(rs, "reviewed_at"))).list();
        return new WasteView(waste.id(), waste.clientReference(), waste.routeId(), waste.routeCode(),
                waste.routeName(), waste.inventoryLocationId(), waste.sellerId(), waste.sellerName(),
                waste.reportedBy(), waste.reportedByUsername(), waste.deviceId(), waste.status(),
                waste.requiredRole(), waste.reason(), waste.occurredAtLocal(), waste.receivedAtServer(),
                items, evidence, reviews);
    }

    private String wasteSelect() {
        return """
                SELECT w.id,w.client_reference,w.route_id,r.code route_code,r.name route_name,
                       w.inventory_location_id,w.seller_id,seller.display_name seller_name,w.reported_by,
                       reporter.username reported_by_username,w.device_id,w.status,w.required_role,w.reason,
                       w.occurred_at_local,w.received_at_server
                FROM waste w JOIN route r ON r.id=w.route_id JOIN seller ON seller.id=w.seller_id
                JOIN app_user reporter ON reporter.id=w.reported_by WHERE 1=1
                """;
    }

    private WasteView wasteRow(ResultSet rs) throws SQLException {
        return new WasteView(rs.getObject("id", UUID.class), rs.getObject("client_reference", UUID.class),
                rs.getObject("route_id", UUID.class), rs.getString("route_code"), rs.getString("route_name"),
                rs.getObject("inventory_location_id", UUID.class), rs.getObject("seller_id", UUID.class),
                rs.getString("seller_name"), rs.getObject("reported_by", UUID.class),
                rs.getString("reported_by_username"), rs.getObject("device_id", UUID.class),
                rs.getString("status"), rs.getString("required_role"), rs.getString("reason"),
                instant(rs, "occurred_at_local"), instant(rs, "received_at_server"), List.of(), List.of(), List.of());
    }

    private String wasteTypeSelect() {
        return """
                SELECT id,code,name,evidence_policy,warehouse_approval_limit_base_units,
                       supervisor_approval_limit_base_units,daily_alert_threshold,active FROM waste_type
                """;
    }

    private WasteTypeView wasteTypeRow(ResultSet rs) throws SQLException {
        return new WasteTypeView(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                rs.getString("evidence_policy"), rs.getBigDecimal("warehouse_approval_limit_base_units"),
                rs.getBigDecimal("supervisor_approval_limit_base_units"), rs.getInt("daily_alert_threshold"),
                rs.getBoolean("active"));
    }

    private Instant instant(ResultSet rs, String column) throws SQLException {
        var value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    static OffsetDateTime databaseTimestamp(Instant value) {
        return value == null ? null : value.atOffset(ZoneOffset.UTC);
    }

    private BusinessException notFound(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.NOT_FOUND);
    }
}
