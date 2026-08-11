package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.ProvisionalCustomerPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public class JdbcProvisionalCustomerAdapter implements ProvisionalCustomerPort {
    private final JdbcClient jdbc;

    public JdbcProvisionalCustomerAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean sellerAssignedToRoute(UUID userId, UUID routeId) {
        return Boolean.TRUE.equals(jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM route_assignment ra
                JOIN seller s ON s.id=ra.seller_id AND s.status='ACTIVE'
                WHERE s.user_id=:userId AND ra.route_id=:routeId
                  AND ra.valid_from<=current_date AND (ra.valid_to IS NULL OR ra.valid_to>=current_date))
                """).param("userId", userId).param("routeId", routeId).query(Boolean.class).single());
    }

    @Override
    public CustomerView create(NewCustomer item) {
        ensureActiveRoute(item.routeId());
        jdbc.sql("""
                INSERT INTO customer(id,code,name,normalized_name,phone,normalized_phone,whatsapp,
                    normalized_whatsapp,address_reference,customer_type,status,credit_allowed,credit_limit,
                    current_balance,created_by,source_device_id,registration_state)
                VALUES (:id,:code,:name,:normalizedName,:phone,:normalizedPhone,:whatsapp,
                    :normalizedWhatsapp,:address,:type,'ACTIVE',false,0,0,:createdBy,:deviceId,:registrationState)
                """).param("id", item.id()).param("code", item.code()).param("name", item.name())
                .param("normalizedName", item.normalizedName()).param("phone", item.phone())
                .param("normalizedPhone", item.normalizedPhone()).param("whatsapp", item.whatsapp())
                .param("normalizedWhatsapp", item.normalizedWhatsapp()).param("address", item.addressReference())
                .param("type", item.customerType()).param("createdBy", item.createdBy())
                .param("deviceId", item.sourceDeviceId()).param("registrationState", item.registrationState())
                .update();
        jdbc.sql("""
                INSERT INTO customer_route(id,customer_id,route_id,valid_from,assigned_by)
                VALUES (:id,:customerId,:routeId,current_date,:assignedBy)
                """).param("id", UUID.randomUUID()).param("customerId", item.id())
                .param("routeId", item.routeId()).param("assignedBy", item.createdBy()).update();
        return findCustomer(item.id());
    }

    @Override
    public List<ReviewView> findPendingReviews() {
        return jdbc.sql(customerSelect() + """
                 WHERE c.customer_type='PROVISIONAL' AND c.registration_state='PENDING_REVIEW'
                 ORDER BY c.created_at
                """).query((rs, row) -> pendingRow(rs)).list().stream().map(pending ->
                new ReviewView(pending.customer(), findDuplicateCandidates(pending))).toList();
    }

    @Override
    public CustomerView decide(RegistrationDecision item) {
        var current = jdbc.sql("""
                SELECT customer_type,registration_state FROM customer WHERE id=:id FOR UPDATE
                """).param("id", item.customerId()).query((rs, row) ->
                new CurrentCustomer(rs.getString("customer_type"), rs.getString("registration_state"))).optional()
                .orElseThrow(() -> notFound("CUSTOMER_NOT_FOUND", "No se encontró el cliente provisional."));
        if (!"PROVISIONAL".equals(current.type()) || !"PENDING_REVIEW".equals(current.state())) {
            throw conflict("CUSTOMER_REVIEW_ALREADY_DECIDED", "El registro del cliente ya fue decidido.");
        }
        if ("MERGED".equals(item.decision())) ensureMergeTarget(item.targetCustomerId());

        switch (item.decision()) {
            case "APPROVED" -> jdbc.sql("""
                    UPDATE customer SET customer_type='PERMANENT',registration_state='ACTIVE',status='ACTIVE',
                        credit_allowed=false,credit_limit=0,updated_at=now() WHERE id=:id
                    """).param("id", item.customerId()).update();
            case "REJECTED" -> jdbc.sql("""
                    UPDATE customer SET registration_state='REJECTED_FOR_REGISTRATION',status='INACTIVE',
                        credit_allowed=false,credit_limit=0,updated_at=now() WHERE id=:id
                    """).param("id", item.customerId()).update();
            case "MERGED" -> {
                jdbc.sql("""
                        UPDATE customer SET registration_state='MERGED',status='INACTIVE',credit_allowed=false,
                            credit_limit=0,updated_at=now() WHERE id=:id
                        """).param("id", item.customerId()).update();
                jdbc.sql("""
                        INSERT INTO customer_merge(id,source_customer_id,target_customer_id,reason,merged_by)
                        VALUES (:id,:sourceId,:targetId,:reason,:actorId)
                        """).param("id", UUID.randomUUID()).param("sourceId", item.customerId())
                        .param("targetId", item.targetCustomerId()).param("reason", item.reason())
                        .param("actorId", item.reviewedBy()).update();
            }
            default -> throw new IllegalArgumentException("Decisión de cliente no permitida");
        }
        jdbc.sql("""
                INSERT INTO customer_registration_review(id,customer_id,decision,target_customer_id,reason,reviewed_by)
                VALUES (:id,:customerId,:decision,:targetId,:reason,:actorId)
                """).param("id", UUID.randomUUID()).param("customerId", item.customerId())
                .param("decision", item.decision()).param("targetId", item.targetCustomerId(), java.sql.Types.OTHER)
                .param("reason", item.reason()).param("actorId", item.reviewedBy()).update();
        return findCustomer(item.customerId());
    }

    private List<DuplicateCandidate> findDuplicateCandidates(PendingCustomer source) {
        return jdbc.sql("""
                SELECT id,code,name,phone,whatsapp FROM customer
                WHERE id<>:id AND customer_type='PERMANENT' AND status='ACTIVE' AND registration_state='ACTIVE'
                  AND (normalized_name=:name
                    OR (:phone<>'' AND normalized_phone=:phone)
                    OR (:whatsapp<>'' AND normalized_whatsapp=:whatsapp))
                ORDER BY name,code LIMIT 20
                """).param("id", source.customer().id()).param("name", source.normalizedName())
                .param("phone", source.normalizedPhone()).param("whatsapp", source.normalizedWhatsapp())
                .query((rs, row) -> new DuplicateCandidate(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getString("name"), rs.getString("phone"), rs.getString("whatsapp"))).list();
    }

    private CustomerView findCustomer(UUID id) {
        return jdbc.sql(customerSelect() + " WHERE c.id=:id").param("id", id)
                .query((rs, row) -> customerRow(rs)).optional()
                .orElseThrow(() -> notFound("CUSTOMER_NOT_FOUND", "No se encontró el cliente."));
    }

    private String customerSelect() {
        return """
                SELECT c.id,c.code,c.name,c.normalized_name,c.contact_name,c.phone,c.normalized_phone,
                       c.whatsapp,c.normalized_whatsapp,c.address_reference,c.customer_type,c.status,
                       c.credit_allowed,c.credit_limit,c.current_balance,c.registration_state,c.created_at,
                       r.id route_id,r.code route_code,r.name route_name,s.id seller_id,s.display_name seller_name
                FROM customer c
                LEFT JOIN LATERAL (
                    SELECT route_id FROM customer_route cr WHERE cr.customer_id=c.id
                      AND cr.valid_from<=current_date AND (cr.valid_to IS NULL OR cr.valid_to>=current_date)
                    ORDER BY cr.valid_from DESC LIMIT 1
                ) cr ON true
                LEFT JOIN route r ON r.id=cr.route_id
                LEFT JOIN LATERAL (
                    SELECT seller_id FROM route_assignment ra WHERE ra.route_id=r.id
                      AND ra.valid_from<=current_date AND (ra.valid_to IS NULL OR ra.valid_to>=current_date)
                    ORDER BY ra.valid_from DESC LIMIT 1
                ) ra ON true
                LEFT JOIN seller s ON s.id=ra.seller_id
                """;
    }

    private PendingCustomer pendingRow(ResultSet rs) throws SQLException {
        return new PendingCustomer(customerRow(rs), rs.getString("normalized_name"),
                rs.getString("normalized_phone"), rs.getString("normalized_whatsapp"));
    }

    private CustomerView customerRow(ResultSet rs) throws SQLException {
        return new CustomerView(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                rs.getString("contact_name"), rs.getString("phone"), rs.getString("whatsapp"),
                rs.getString("address_reference"), rs.getString("customer_type"), rs.getString("status"),
                rs.getBoolean("credit_allowed"), rs.getBigDecimal("credit_limit"), rs.getBigDecimal("current_balance"),
                rs.getObject("route_id", UUID.class), rs.getString("route_code"), rs.getString("route_name"),
                rs.getObject("seller_id", UUID.class), rs.getString("seller_name"),
                rs.getString("registration_state"), instant(rs, "created_at"));
    }

    private void ensureActiveRoute(UUID routeId) {
        boolean exists = Boolean.TRUE.equals(jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM route WHERE id=:id AND status='ACTIVE')
                """).param("id", routeId).query(Boolean.class).single());
        if (!exists) throw notFound("ROUTE_NOT_FOUND", "No se encontró la ruta activa.");
    }

    private void ensureMergeTarget(UUID targetId) {
        boolean valid = Boolean.TRUE.equals(jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM customer WHERE id=:id AND customer_type='PERMANENT'
                    AND status='ACTIVE' AND registration_state='ACTIVE')
                """).param("id", targetId).query(Boolean.class).single());
        if (!valid) throw new BusinessException("CUSTOMER_MERGE_TARGET_INVALID",
                "El cliente de destino debe ser permanente y estar activo.", ErrorCategory.VALIDATION);
    }

    private Instant instant(ResultSet rs, String column) throws SQLException {
        var value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private BusinessException notFound(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.NOT_FOUND);
    }

    private BusinessException conflict(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.CONFLICT);
    }

    private record CurrentCustomer(String type, String state) {
    }

    private record PendingCustomer(CustomerView customer, String normalizedName, String normalizedPhone,
                                   String normalizedWhatsapp) {
    }
}
