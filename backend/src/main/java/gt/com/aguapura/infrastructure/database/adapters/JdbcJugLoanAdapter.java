package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.dto.jugs.JugBalanceResponse;
import gt.com.aguapura.application.dto.jugs.JugEventRequest;
import gt.com.aguapura.application.dto.jugs.JugEventResponse;
import gt.com.aguapura.application.dto.jugs.JugHistoryResponse;
import gt.com.aguapura.application.dto.jugs.JugRouteSummaryResponse;
import gt.com.aguapura.application.ports.JugLoanPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Repository
public class JdbcJugLoanAdapter implements JugLoanPort {
    private static final Set<String> VALID_EVENT_TYPES = Set.of("LENT", "RETURNED", "CHARGED_LOSS", "CHARGED_DAMAGE");
    private final JdbcClient jdbc;

    public JdbcJugLoanAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional
    public JugEventResponse recordEvent(JugEventRequest request, UUID actorId, UUID deviceId) {
        String eventType = request.eventType().trim().toUpperCase();
        if (!VALID_EVENT_TYPES.contains(eventType)) {
            throw new BusinessException("INVALID_EVENT_TYPE", "Tipo de evento de garrafón no válido: " + request.eventType(), ErrorCategory.VALIDATION);
        }

        BigDecimal unitPrice = null;
        if (eventType.startsWith("CHARGED")) {
            if (request.unitPrice() == null || request.unitPrice().compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessException("UNIT_PRICE_REQUIRED", "El precio unitario es obligatorio para cobros de garrafones.", ErrorCategory.VALIDATION);
            }
            unitPrice = request.unitPrice();
        }

        // Verificar existencia de cliente
        var customer = jdbc.sql("SELECT id, name FROM customer WHERE id = :id")
                .param("id", request.customerId())
                .query((rs, rowNum) -> rs.getString("name"))
                .optional()
                .orElseThrow(() -> new BusinessException("CUSTOMER_NOT_FOUND", "Cliente no encontrado.", ErrorCategory.NOT_FOUND));

        // Verificar existencia de ruta
        var routeName = jdbc.sql("SELECT name FROM route WHERE id = :id")
                .param("id", request.routeId())
                .query((rs, rowNum) -> rs.getString("name"))
                .optional()
                .orElseThrow(() -> new BusinessException("ROUTE_NOT_FOUND", "Ruta no encontrada.", ErrorCategory.NOT_FOUND));

        // Validar saldo actual si es devolución o cobro
        if (!"LENT".equals(eventType)) {
            Integer currentOutstanding = jdbc.sql("""
                    SELECT COALESCE(SUM(CASE
                        WHEN event_type = 'LENT' THEN quantity
                        WHEN event_type IN ('RETURNED','CHARGED_LOSS','CHARGED_DAMAGE') THEN -quantity
                        ELSE 0
                    END), 0) FROM jug_loan_event WHERE customer_id = :customerId
                    """)
                    .param("customerId", request.customerId())
                    .query(Integer.class)
                    .single();

            if (currentOutstanding < request.quantity()) {
                throw new BusinessException("EXCEEDS_JUG_BALANCE",
                        "La cantidad (" + request.quantity() + ") excede los garrafones pendientes del cliente (" + currentOutstanding + ").",
                        ErrorCategory.VALIDATION);
            }
        }

        UUID eventId = UUID.randomUUID();
        String notes = request.notes() == null ? "" : request.notes().trim();

        jdbc.sql("""
                INSERT INTO jug_loan_event (
                    id, customer_id, route_id, route_load_id, sale_id,
                    event_type, quantity, unit_price, notes,
                    registered_by, device_id
                ) VALUES (
                    :id, :customerId, :routeId, :routeLoadId, :saleId,
                    :eventType, :quantity, :unitPrice, :notes,
                    :registeredBy, :deviceId
                )
                """)
                .param("id", eventId)
                .param("customerId", request.customerId())
                .param("routeId", request.routeId())
                .param("routeLoadId", request.routeLoadId())
                .param("saleId", request.saleId())
                .param("eventType", eventType)
                .param("quantity", request.quantity())
                .param("unitPrice", unitPrice)
                .param("notes", notes)
                .param("registeredBy", actorId)
                .param("deviceId", deviceId)
                .update();

        var registeredByName = jdbc.sql("SELECT username FROM app_user WHERE id = :id")
                .param("id", actorId)
                .query((rs, rowNum) -> rs.getString("username"))
                .optional()
                .orElse("Desconocido");

        var eventRow = jdbc.sql("SELECT created_at FROM jug_loan_event WHERE id = :id")
                .param("id", eventId)
                .query((rs, rowNum) -> rs.getTimestamp("created_at").toInstant())
                .single();

        return new JugEventResponse(
                eventId,
                request.customerId(),
                customer,
                request.routeId(),
                routeName,
                request.routeLoadId(),
                request.saleId(),
                eventType,
                request.quantity(),
                unitPrice,
                notes,
                actorId,
                registeredByName,
                deviceId,
                eventRow
        );
    }

    @Override
    public JugBalanceResponse getCustomerBalance(UUID customerId) {
        var customerData = jdbc.sql("""
                SELECT c.id, c.name, COALESCE(r.id, '00000000-0000-0000-0000-000000000000'::uuid) as route_id,
                       COALESCE(r.name, 'Sin ruta') as route_name
                FROM customer c
                LEFT JOIN customer_route cr ON cr.customer_id = c.id AND cr.valid_to IS NULL
                LEFT JOIN route r ON r.id = cr.route_id
                WHERE c.id = :customerId
                ORDER BY cr.created_at DESC LIMIT 1
                """)
                .param("customerId", customerId)
                .query((rs, rowNum) -> new Object[]{
                        rs.getObject("id", UUID.class),
                        rs.getString("name"),
                        rs.getObject("route_id", UUID.class),
                        rs.getString("route_name")
                })
                .optional()
                .orElseThrow(() -> new BusinessException("CUSTOMER_NOT_FOUND", "Cliente no encontrado.", ErrorCategory.NOT_FOUND));

        int outstanding = jdbc.sql("""
                SELECT COALESCE(SUM(CASE
                    WHEN event_type = 'LENT' THEN quantity
                    WHEN event_type IN ('RETURNED','CHARGED_LOSS','CHARGED_DAMAGE') THEN -quantity
                    ELSE 0
                END), 0) FROM jug_loan_event WHERE customer_id = :customerId
                """)
                .param("customerId", customerId)
                .query(Integer.class)
                .single();

        return new JugBalanceResponse(
                (UUID) customerData[0],
                (String) customerData[1],
                (UUID) customerData[2],
                (String) customerData[3],
                outstanding
        );
    }

    @Override
    public JugHistoryResponse getCustomerHistory(UUID customerId) {
        var balance = getCustomerBalance(customerId);

        List<JugEventResponse> events = jdbc.sql("""
                SELECT jle.id, jle.customer_id, c.name as customer_name,
                       jle.route_id, r.name as route_name,
                       jle.route_load_id, jle.sale_id,
                       jle.event_type, jle.quantity, jle.unit_price, jle.notes,
                       jle.registered_by, u.username as registered_by_name,
                       jle.device_id, jle.created_at
                FROM jug_loan_event jle
                JOIN customer c ON c.id = jle.customer_id
                JOIN route r ON r.id = jle.route_id
                JOIN app_user u ON u.id = jle.registered_by
                WHERE jle.customer_id = :customerId
                ORDER BY jle.created_at DESC
                """)
                .param("customerId", customerId)
                .query(this::mapEventRow)
                .list();

        return new JugHistoryResponse(customerId, balance.customerName(), balance.jugsOutstanding(), events);
    }

    @Override
    public JugRouteSummaryResponse getRouteSummary(UUID routeId) {
        var routeName = jdbc.sql("SELECT name FROM route WHERE id = :id")
                .param("id", routeId)
                .query((rs, rowNum) -> rs.getString("name"))
                .optional()
                .orElseThrow(() -> new BusinessException("ROUTE_NOT_FOUND", "Ruta no encontrada.", ErrorCategory.NOT_FOUND));

        List<JugBalanceResponse> balances = jdbc.sql("""
                SELECT jle.customer_id, c.name as customer_name,
                       jle.route_id, r.name as route_name,
                       SUM(CASE
                           WHEN jle.event_type = 'LENT' THEN jle.quantity
                           WHEN jle.event_type IN ('RETURNED','CHARGED_LOSS','CHARGED_DAMAGE') THEN -jle.quantity
                           ELSE 0
                       END) as jugs_outstanding
                FROM jug_loan_event jle
                JOIN customer c ON c.id = jle.customer_id
                JOIN route r ON r.id = jle.route_id
                WHERE jle.route_id = :routeId
                GROUP BY jle.customer_id, c.name, jle.route_id, r.name
                HAVING SUM(CASE
                    WHEN jle.event_type = 'LENT' THEN jle.quantity
                    WHEN jle.event_type IN ('RETURNED','CHARGED_LOSS','CHARGED_DAMAGE') THEN -jle.quantity
                    ELSE 0
                END) > 0
                ORDER BY jugs_outstanding DESC, c.name ASC
                """)
                .param("routeId", routeId)
                .query((rs, rowNum) -> new JugBalanceResponse(
                        rs.getObject("customer_id", UUID.class),
                        rs.getString("customer_name"),
                        rs.getObject("route_id", UUID.class),
                        rs.getString("route_name"),
                        rs.getInt("jugs_outstanding")
                ))
                .list();

        int totalCustomers = balances.size();
        int totalJugs = balances.stream().mapToInt(JugBalanceResponse::jugsOutstanding).sum();

        return new JugRouteSummaryResponse(routeId, routeName, totalCustomers, totalJugs, balances);
    }

    private JugEventResponse mapEventRow(ResultSet rs, int rowNum) throws SQLException {
        return new JugEventResponse(
                rs.getObject("id", UUID.class),
                rs.getObject("customer_id", UUID.class),
                rs.getString("customer_name"),
                rs.getObject("route_id", UUID.class),
                rs.getString("route_name"),
                rs.getObject("route_load_id", UUID.class),
                rs.getObject("sale_id", UUID.class),
                rs.getString("event_type"),
                rs.getInt("quantity"),
                rs.getBigDecimal("unit_price"),
                rs.getString("notes"),
                rs.getObject("registered_by", UUID.class),
                rs.getString("registered_by_name"),
                rs.getObject("device_id", UUID.class),
                rs.getTimestamp("created_at").toInstant()
        );
    }
}
