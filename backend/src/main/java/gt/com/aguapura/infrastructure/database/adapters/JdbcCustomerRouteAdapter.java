package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.CustomerRoutePort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcCustomerRouteAdapter implements CustomerRoutePort {
    private final JdbcClient jdbc;

    public JdbcCustomerRouteAdapter(JdbcClient jdbc) { this.jdbc = jdbc; }

    @Override public boolean customerCodeExists(String code) { return exists("customer", "code", code); }
    @Override public boolean routeCodeExists(String code) { return exists("route", "code", code); }
    @Override public boolean vehicleCodeExists(String code) { return exists("vehicle", "code", code); }

    @Override
    public boolean hasPotentialDuplicate(String name, String phone, String whatsapp) {
        return Boolean.TRUE.equals(jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM customer
                WHERE status = 'ACTIVE' AND (
                    normalized_name = :name
                    OR (:phone <> '' AND normalized_phone = :phone)
                    OR (:whatsapp <> '' AND normalized_whatsapp = :whatsapp)
                ))
                """).param("name", name).param("phone", phone).param("whatsapp", whatsapp)
                .query(Boolean.class).single());
    }

    @Override
    public CustomerView createCustomer(NewCustomer item) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO customer(id, code, name, normalized_name, contact_name, phone, normalized_phone,
                    whatsapp, normalized_whatsapp, address_reference, customer_type, credit_allowed,
                    credit_limit, created_by, registration_state)
                VALUES (:id, :code, :name, :normalizedName, :contactName, :phone, :normalizedPhone,
                    :whatsapp, :normalizedWhatsapp, :address, :type, :creditAllowed, :creditLimit,
                    :createdBy, :registrationState)
                """).param("id", id).param("code", item.code()).param("name", item.name())
                .param("normalizedName", item.normalizedName()).param("contactName", item.contactName())
                .param("phone", item.phone()).param("normalizedPhone", item.normalizedPhone())
                .param("whatsapp", item.whatsapp()).param("normalizedWhatsapp", item.normalizedWhatsapp())
                .param("address", item.addressReference()).param("type", item.customerType())
                .param("creditAllowed", item.creditAllowed()).param("creditLimit", item.creditLimit())
                .param("createdBy", item.createdBy())
                .param("registrationState", "PROVISIONAL".equals(item.customerType()) ? "PENDING_REVIEW" : "ACTIVE")
                .update();
        return findCustomer(id);
    }

    @Override
    public List<CustomerView> findCustomers(Optional<UUID> sellerId) {
        String filter = sellerId.isPresent() ? " AND ra.seller_id = :sellerId" : "";
        var statement = jdbc.sql(customerSelect() + filter + " ORDER BY c.name, c.code");
        if (sellerId.isPresent()) statement = statement.param("sellerId", sellerId.get());
        return statement.query((rs, rowNum) -> customerRow(rs)).list();
    }

    @Override
    public RouteView assignCustomerRoute(NewCustomerRoute item) {
        ensureActive("customer", item.customerId(), "CUSTOMER_NOT_FOUND", "No se encontró el cliente activo.");
        ensureActive("route", item.routeId(), "ROUTE_NOT_FOUND", "No se encontró la ruta activa.");
        var previous = jdbc.sql("SELECT valid_from FROM customer_route WHERE customer_id = :id AND valid_to IS NULL")
                .param("id", item.customerId()).query(LocalDate.class).optional();
        closePrevious("customer_route", "customer_id", item.customerId(), item.validFrom(), previous);
        jdbc.sql("""
                INSERT INTO customer_route(id, customer_id, route_id, valid_from, assigned_by)
                VALUES (:id, :customerId, :routeId, :validFrom, :assignedBy)
                """).param("id", UUID.randomUUID()).param("customerId", item.customerId())
                .param("routeId", item.routeId()).param("validFrom", item.validFrom())
                .param("assignedBy", item.assignedBy()).update();
        return findRoute(item.routeId());
    }

    @Override
    public RouteView createRoute(NewRoute item) {
        UUID id = UUID.randomUUID();
        jdbc.sql("INSERT INTO route(id, code, name, description) VALUES (:id, :code, :name, :description)")
                .param("id", id).param("code", item.code()).param("name", item.name())
                .param("description", item.description()).update();
        return findRoute(id);
    }

    @Override
    public List<RouteView> findRoutes(Optional<UUID> sellerId) {
        String filter = sellerId.isPresent() ? " WHERE ra.seller_id = :sellerId" : "";
        var statement = jdbc.sql(routeSelect() + filter + " ORDER BY r.name, r.code");
        if (sellerId.isPresent()) statement = statement.param("sellerId", sellerId.get());
        return statement.query((rs, rowNum) -> routeRow(rs)).list();
    }

    @Override
    public VehicleView createVehicle(NewVehicle item) {
        UUID id = UUID.randomUUID();
        jdbc.sql("INSERT INTO vehicle(id, code, license_plate, description) VALUES (:id, :code, :plate, :description)")
                .param("id", id).param("code", item.code())
                .param("plate", item.licensePlate().isBlank() ? null : item.licensePlate(), Types.VARCHAR)
                .param("description", item.description()).update();
        return findVehicle(id);
    }

    @Override
    public List<VehicleView> findVehicles() {
        return jdbc.sql("SELECT id, code, license_plate, description, status, created_at FROM vehicle ORDER BY code")
                .query((rs, rowNum) -> vehicleRow(rs)).list();
    }

    @Override
    public List<SellerOption> findSellers() {
        return jdbc.sql("SELECT id, code, display_name, status FROM seller ORDER BY display_name, code")
                .query((rs, rowNum) -> new SellerOption(rs.getObject("id", UUID.class), rs.getString("code"),
                        rs.getString("display_name"), rs.getString("status"))).list();
    }

    @Override
    public RouteView assignRoute(NewRouteAssignment item) {
        ensureActive("route", item.routeId(), "ROUTE_NOT_FOUND", "No se encontró la ruta activa.");
        ensureActive("seller", item.sellerId(), "SELLER_NOT_FOUND", "No se encontró el vendedor activo.");
        if (item.vehicleId() != null) ensureActive("vehicle", item.vehicleId(), "VEHICLE_NOT_FOUND", "No se encontró el vehículo activo.");
        var previous = jdbc.sql("SELECT valid_from FROM route_assignment WHERE route_id = :id AND valid_to IS NULL")
                .param("id", item.routeId()).query(LocalDate.class).optional();
        closePrevious("route_assignment", "route_id", item.routeId(), item.validFrom(), previous);
        jdbc.sql("""
                INSERT INTO route_assignment(id, route_id, seller_id, vehicle_id, valid_from, assigned_by)
                VALUES (:id, :routeId, :sellerId, :vehicleId, :validFrom, :assignedBy)
                """).param("id", UUID.randomUUID()).param("routeId", item.routeId())
                .param("sellerId", item.sellerId()).param("vehicleId", item.vehicleId(), Types.OTHER)
                .param("validFrom", item.validFrom()).param("assignedBy", item.assignedBy()).update();
        return findRoute(item.routeId());
    }

    @Override
    public Optional<UUID> findSellerIdByUserId(UUID userId) {
        return jdbc.sql("SELECT id FROM seller WHERE user_id = :userId AND status = 'ACTIVE'")
                .param("userId", userId).query(UUID.class).optional();
    }

    private CustomerView findCustomer(UUID id) {
        return jdbc.sql(customerSelect() + " AND c.id = :id").param("id", id)
                .query((rs, rowNum) -> customerRow(rs)).optional()
                .orElseThrow(() -> notFound("CUSTOMER_NOT_FOUND", "No se encontró el cliente."));
    }

    private RouteView findRoute(UUID id) {
        return jdbc.sql(routeSelect() + " WHERE r.id = :id").param("id", id)
                .query((rs, rowNum) -> routeRow(rs)).optional()
                .orElseThrow(() -> notFound("ROUTE_NOT_FOUND", "No se encontró la ruta."));
    }

    private VehicleView findVehicle(UUID id) {
        return jdbc.sql("SELECT id, code, license_plate, description, status, created_at FROM vehicle WHERE id = :id")
                .param("id", id).query((rs, rowNum) -> vehicleRow(rs)).optional()
                .orElseThrow(() -> notFound("VEHICLE_NOT_FOUND", "No se encontró el vehículo."));
    }

    private String customerSelect() {
        return """
                SELECT c.id, c.code, c.name, c.contact_name, c.phone, c.whatsapp, c.address_reference,
                       c.customer_type, c.status, c.credit_allowed, c.credit_limit, c.current_balance,
                       c.registration_state, c.created_at, r.id AS route_id, r.code AS route_code,
                       r.name AS route_name, s.id AS seller_id, s.display_name AS seller_name
                FROM customer c
                LEFT JOIN LATERAL (
                    SELECT route_id FROM customer_route cr
                    WHERE cr.customer_id = c.id AND cr.valid_from <= current_date
                      AND (cr.valid_to IS NULL OR cr.valid_to >= current_date)
                    ORDER BY cr.valid_from DESC LIMIT 1
                ) cr ON true
                LEFT JOIN route r ON r.id = cr.route_id
                LEFT JOIN LATERAL (
                    SELECT seller_id FROM route_assignment ra0
                    WHERE ra0.route_id = r.id AND ra0.valid_from <= current_date
                      AND (ra0.valid_to IS NULL OR ra0.valid_to >= current_date)
                    ORDER BY ra0.valid_from DESC LIMIT 1
                ) ra ON true
                LEFT JOIN seller s ON s.id = ra.seller_id
                WHERE 1=1
                """;
    }

    private String routeSelect() {
        return """
                SELECT r.id, r.code, r.name, r.description, r.status, r.created_at,
                       s.id AS seller_id, s.code AS seller_code, s.display_name AS seller_name,
                       v.id AS vehicle_id, v.code AS vehicle_code, v.license_plate,
                       ra.valid_from AS assignment_valid_from,
                       (SELECT count(*) FROM customer_route cr WHERE cr.route_id = r.id
                         AND cr.valid_from <= current_date AND (cr.valid_to IS NULL OR cr.valid_to >= current_date)) AS customer_count
                FROM route r
                LEFT JOIN LATERAL (
                    SELECT seller_id, vehicle_id, valid_from FROM route_assignment ra0
                    WHERE ra0.route_id = r.id AND ra0.valid_from <= current_date
                      AND (ra0.valid_to IS NULL OR ra0.valid_to >= current_date)
                    ORDER BY ra0.valid_from DESC LIMIT 1
                ) ra ON true
                LEFT JOIN seller s ON s.id = ra.seller_id
                LEFT JOIN vehicle v ON v.id = ra.vehicle_id
                """;
    }

    private CustomerView customerRow(ResultSet rs) throws SQLException {
        return new CustomerView(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                rs.getString("contact_name"), rs.getString("phone"), rs.getString("whatsapp"),
                rs.getString("address_reference"), rs.getString("customer_type"), rs.getString("status"),
                rs.getBoolean("credit_allowed"), rs.getBigDecimal("credit_limit"), rs.getBigDecimal("current_balance"),
                rs.getObject("route_id", UUID.class), rs.getString("route_code"), rs.getString("route_name"),
                rs.getObject("seller_id", UUID.class), rs.getString("seller_name"), rs.getString("registration_state"),
                instant(rs, "created_at"));
    }

    private RouteView routeRow(ResultSet rs) throws SQLException {
        return new RouteView(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                rs.getString("description"), rs.getString("status"), rs.getObject("seller_id", UUID.class),
                rs.getString("seller_code"), rs.getString("seller_name"), rs.getObject("vehicle_id", UUID.class),
                rs.getString("vehicle_code"), rs.getString("license_plate"), rs.getLong("customer_count"),
                rs.getObject("assignment_valid_from", LocalDate.class), instant(rs, "created_at"));
    }

    private VehicleView vehicleRow(ResultSet rs) throws SQLException {
        return new VehicleView(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("license_plate"),
                rs.getString("description"), rs.getString("status"), instant(rs, "created_at"));
    }

    private Instant instant(ResultSet rs, String column) throws SQLException {
        var timestamp = rs.getTimestamp(column);
        return timestamp == null ? null : timestamp.toInstant();
    }

    private boolean exists(String table, String column, String value) {
        String allowed = switch (table + "." + column) {
            case "customer.code" -> "SELECT EXISTS(SELECT 1 FROM customer WHERE code = :value)";
            case "route.code" -> "SELECT EXISTS(SELECT 1 FROM route WHERE code = :value)";
            case "vehicle.code" -> "SELECT EXISTS(SELECT 1 FROM vehicle WHERE code = :value)";
            default -> throw new IllegalArgumentException("Consulta no permitida");
        };
        return Boolean.TRUE.equals(jdbc.sql(allowed).param("value", value).query(Boolean.class).single());
    }

    private void ensureActive(String table, UUID id, String code, String message) {
        String sql = switch (table) {
            case "customer" -> "SELECT EXISTS(SELECT 1 FROM customer WHERE id = :id AND status = 'ACTIVE')";
            case "route" -> "SELECT EXISTS(SELECT 1 FROM route WHERE id = :id AND status = 'ACTIVE')";
            case "seller" -> "SELECT EXISTS(SELECT 1 FROM seller WHERE id = :id AND status = 'ACTIVE')";
            case "vehicle" -> "SELECT EXISTS(SELECT 1 FROM vehicle WHERE id = :id AND status = 'ACTIVE')";
            default -> throw new IllegalArgumentException("Entidad no permitida");
        };
        if (!Boolean.TRUE.equals(jdbc.sql(sql).param("id", id).query(Boolean.class).single())) throw notFound(code, message);
    }

    private void closePrevious(String table, String idColumn, UUID entityId, LocalDate newFrom,
                               Optional<LocalDate> previousFrom) {
        if (previousFrom.isEmpty()) return;
        if (!newFrom.isAfter(previousFrom.get())) {
            throw new BusinessException("ASSIGNMENT_DATE_OVERLAP",
                    "La nueva vigencia debe comenzar después de la asignación vigente.", ErrorCategory.CONFLICT);
        }
        String sql = switch (table + "." + idColumn) {
            case "customer_route.customer_id" -> "UPDATE customer_route SET valid_to = :validTo WHERE customer_id = :id AND valid_to IS NULL";
            case "route_assignment.route_id" -> "UPDATE route_assignment SET valid_to = :validTo WHERE route_id = :id AND valid_to IS NULL";
            default -> throw new IllegalArgumentException("Asignación no permitida");
        };
        jdbc.sql(sql).param("validTo", newFrom.minusDays(1)).param("id", entityId).update();
    }

    private BusinessException notFound(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.NOT_FOUND);
    }
}
