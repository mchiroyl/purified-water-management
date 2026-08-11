package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.InventoryPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcInventoryAdapter implements InventoryPort {
    private final JdbcClient jdbc;

    public JdbcInventoryAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean locationCodeExists(String code) {
        return exists("SELECT EXISTS(SELECT 1 FROM inventory_location WHERE code=:value)", code);
    }

    @Override
    public boolean activeRouteExists(UUID routeId) {
        return exists("SELECT EXISTS(SELECT 1 FROM route WHERE id=:value AND status='ACTIVE')", routeId);
    }

    @Override
    public boolean routeLocationExists(UUID routeId) {
        return exists("SELECT EXISTS(SELECT 1 FROM inventory_location WHERE route_id=:value)", routeId);
    }

    @Override
    public boolean activeProductExists(UUID productId) {
        return exists("SELECT EXISTS(SELECT 1 FROM product WHERE id=:value AND active AND controls_inventory)", productId);
    }

    @Override
    public LocationView createLocation(NewLocation item) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO inventory_location(id,code,name,location_type,route_id)
                VALUES (:id,:code,:name,:type,:routeId)
                """).param("id", id).param("code", item.code()).param("name", item.name())
                .param("type", item.locationType()).param("routeId", item.routeId(), Types.OTHER).update();
        return findLocation(id);
    }

    @Override
    public List<LocationView> findLocations(Optional<UUID> sellerUserId) {
        String filter = sellerUserId.isPresent() ? """
                 WHERE il.location_type='ROUTE' AND EXISTS (
                    SELECT 1 FROM route_assignment ra JOIN seller s ON s.id=ra.seller_id
                    WHERE ra.route_id=il.route_id AND s.user_id=:sellerUserId AND s.status='ACTIVE'
                      AND ra.valid_from<=current_date AND (ra.valid_to IS NULL OR ra.valid_to>=current_date))
                """ : "";
        var statement = jdbc.sql(locationSelect() + filter + " ORDER BY il.name,il.code");
        if (sellerUserId.isPresent()) statement = statement.param("sellerUserId", sellerUserId.get());
        return statement.query((rs, row) -> locationRow(rs)).list().stream().map(this::withBalances).toList();
    }

    @Override
    public BalanceView lockBalance(UUID locationId, UUID productId) {
        jdbc.sql("""
                INSERT INTO inventory_balance(location_id,product_id)
                SELECT il.id,p.id FROM inventory_location il CROSS JOIN product p
                WHERE il.id=:locationId AND il.active AND p.id=:productId AND p.active AND p.controls_inventory
                ON CONFLICT (location_id,product_id) DO NOTHING
                """).param("locationId", locationId).param("productId", productId).update();
        return jdbc.sql("""
                SELECT ib.location_id,ib.product_id,p.code product_code,p.name product_name,u.code base_unit_code,
                       ib.quantity_base_units,ib.version,ib.updated_at
                FROM inventory_balance ib JOIN inventory_location il ON il.id=ib.location_id
                JOIN product p ON p.id=ib.product_id
                JOIN unit_of_measure u ON u.id=p.base_unit_id
                WHERE ib.location_id=:locationId AND ib.product_id=:productId AND il.active
                FOR UPDATE OF ib
                """).param("locationId", locationId).param("productId", productId)
                .query((rs, row) -> balanceRow(rs)).optional()
                .orElseThrow(() -> notFound("INVENTORY_LOCATION_NOT_FOUND", "No se encontró la ubicación de inventario activa."));
    }

    @Override
    public MovementView storeMovement(NewMovement item, long expectedVersion) {
        int changed = jdbc.sql("""
                UPDATE inventory_balance SET quantity_base_units=:balanceAfter,version=version+1,updated_at=now()
                WHERE location_id=:locationId AND product_id=:productId AND version=:expectedVersion
                """).param("balanceAfter", item.balanceAfter()).param("locationId", item.locationId())
                .param("productId", item.productId()).param("expectedVersion", expectedVersion).update();
        if (changed != 1) {
            throw new BusinessException("INVENTORY_CONCURRENT_UPDATE",
                    "El inventario cambió durante la operación; vuelva a intentarlo.", ErrorCategory.CONFLICT);
        }
        jdbc.sql("""
                INSERT INTO inventory_movement(id,location_id,product_id,movement_type,quantity_delta,
                    balance_before,balance_after,reason,reference_type,reference_id,actor_id,device_id)
                VALUES (:id,:locationId,:productId,:movementType,:quantityDelta,:balanceBefore,:balanceAfter,
                    :reason,:referenceType,:referenceId,:actorId,:deviceId)
                """).param("id", item.id()).param("locationId", item.locationId()).param("productId", item.productId())
                .param("movementType", item.movementType()).param("quantityDelta", item.quantityDelta())
                .param("balanceBefore", item.balanceBefore()).param("balanceAfter", item.balanceAfter())
                .param("reason", item.reason()).param("referenceType", item.referenceType(), Types.VARCHAR)
                .param("referenceId", item.referenceId(), Types.OTHER).param("actorId", item.actorId())
                .param("deviceId", item.deviceId(), Types.OTHER).update();
        return findMovement(item.id());
    }

    @Override
    public List<MovementView> findMovements(UUID locationId, Optional<UUID> sellerUserId) {
        if (sellerUserId.isPresent() && !sellerCanAccess(sellerUserId.get(), locationId)) {
            throw new BusinessException("INVENTORY_LOCATION_FORBIDDEN",
                    "La ubicación no pertenece a una ruta asignada al vendedor.", ErrorCategory.FORBIDDEN);
        }
        return jdbc.sql(movementSelect() + " AND im.location_id=:locationId ORDER BY im.created_at DESC")
                .param("locationId", locationId).query((rs, row) -> movementRow(rs)).list();
    }

    private LocationView findLocation(UUID id) {
        return jdbc.sql(locationSelect() + " WHERE il.id=:id").param("id", id)
                .query((rs, row) -> locationRow(rs)).optional().map(this::withBalances)
                .orElseThrow(() -> notFound("INVENTORY_LOCATION_NOT_FOUND", "No se encontró la ubicación de inventario."));
    }

    private LocationView withBalances(LocationView location) {
        var balances = jdbc.sql("""
                SELECT ib.location_id,ib.product_id,p.code product_code,p.name product_name,u.code base_unit_code,
                       ib.quantity_base_units,ib.version,ib.updated_at
                FROM inventory_balance ib JOIN product p ON p.id=ib.product_id
                JOIN unit_of_measure u ON u.id=p.base_unit_id
                WHERE ib.location_id=:locationId ORDER BY p.name,p.code
                """).param("locationId", location.id()).query((rs, row) -> balanceRow(rs)).list();
        return new LocationView(location.id(), location.code(), location.name(), location.locationType(),
                location.routeId(), location.routeCode(), location.routeName(), location.active(),
                location.createdAt(), balances);
    }

    private MovementView findMovement(UUID id) {
        return jdbc.sql(movementSelect() + " AND im.id=:id").param("id", id)
                .query((rs, row) -> movementRow(rs)).single();
    }

    private boolean sellerCanAccess(UUID userId, UUID locationId) {
        return Boolean.TRUE.equals(jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM inventory_location il
                JOIN route_assignment ra ON ra.route_id=il.route_id JOIN seller s ON s.id=ra.seller_id
                WHERE il.id=:locationId AND s.user_id=:userId AND s.status='ACTIVE'
                  AND ra.valid_from<=current_date AND (ra.valid_to IS NULL OR ra.valid_to>=current_date))
                """).param("locationId", locationId).param("userId", userId).query(Boolean.class).single());
    }

    private String locationSelect() {
        return """
                SELECT il.id,il.code,il.name,il.location_type,il.route_id,r.code route_code,r.name route_name,
                       il.active,il.created_at
                FROM inventory_location il LEFT JOIN route r ON r.id=il.route_id
                """;
    }

    private String movementSelect() {
        return """
                SELECT im.id,im.location_id,il.code location_code,il.name location_name,im.product_id,
                       p.code product_code,p.name product_name,im.movement_type,im.quantity_delta,
                       im.balance_before,im.balance_after,im.reason,im.reference_type,im.reference_id,
                       im.actor_id,u.username actor_username,im.device_id,im.created_at
                FROM inventory_movement im JOIN inventory_location il ON il.id=im.location_id
                JOIN product p ON p.id=im.product_id JOIN app_user u ON u.id=im.actor_id WHERE 1=1
                """;
    }

    private LocationView locationRow(ResultSet rs) throws SQLException {
        return new LocationView(rs.getObject("id", UUID.class), rs.getString("code"), rs.getString("name"),
                rs.getString("location_type"), rs.getObject("route_id", UUID.class), rs.getString("route_code"),
                rs.getString("route_name"), rs.getBoolean("active"), instant(rs, "created_at"), List.of());
    }

    private BalanceView balanceRow(ResultSet rs) throws SQLException {
        return new BalanceView(rs.getObject("location_id", UUID.class), rs.getObject("product_id", UUID.class),
                rs.getString("product_code"), rs.getString("product_name"), rs.getString("base_unit_code"),
                rs.getBigDecimal("quantity_base_units"), rs.getLong("version"), instant(rs, "updated_at"));
    }

    private MovementView movementRow(ResultSet rs) throws SQLException {
        return new MovementView(rs.getObject("id", UUID.class), rs.getObject("location_id", UUID.class),
                rs.getString("location_code"), rs.getString("location_name"), rs.getObject("product_id", UUID.class),
                rs.getString("product_code"), rs.getString("product_name"), rs.getString("movement_type"),
                rs.getBigDecimal("quantity_delta"), rs.getBigDecimal("balance_before"),
                rs.getBigDecimal("balance_after"), rs.getString("reason"), rs.getString("reference_type"),
                rs.getObject("reference_id", UUID.class), rs.getObject("actor_id", UUID.class),
                rs.getString("actor_username"), rs.getObject("device_id", UUID.class), instant(rs, "created_at"));
    }

    private boolean exists(String sql, Object value) {
        return Boolean.TRUE.equals(jdbc.sql(sql).param("value", value).query(Boolean.class).single());
    }

    private Instant instant(ResultSet rs, String column) throws SQLException {
        var value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private BusinessException notFound(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.NOT_FOUND);
    }
}
