package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.RouteLoadPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcRouteLoadAdapter implements RouteLoadPort {
    static final String CURRENT_STARTED_INITIAL_LOAD_LOCK_SQL = """
            SELECT id FROM route_load
            WHERE route_id=:routeId AND load_type='INITIAL' AND status='STARTED'
            FOR UPDATE
            """;
    static final String CURRENT_INITIAL_LOAD_CLOSED_SETTLEMENT_SQL = """
            SELECT EXISTS(
                SELECT 1 FROM settlement
                WHERE route_load_id=:routeLoadId AND status='CLOSED'
            )
            """;
    private final JdbcClient jdbc;

    public JdbcRouteLoadAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean activeRouteExists(UUID routeId) {
        return exists("SELECT EXISTS(SELECT 1 FROM route WHERE id=:value AND status='ACTIVE')", routeId);
    }

    @Override
    public boolean activeWarehouseLocationExists(UUID locationId) {
        return exists("SELECT EXISTS(SELECT 1 FROM inventory_location WHERE id=:value AND active AND location_type='WAREHOUSE')", locationId);
    }

    @Override
    public Optional<UUID> findActiveRouteLocation(UUID routeId) {
        return jdbc.sql("SELECT id FROM inventory_location WHERE route_id=:routeId AND active AND location_type='ROUTE'")
                .param("routeId", routeId).query(UUID.class).optional();
    }

    @Override
    public boolean activeInventoryProductExists(UUID productId) {
        return exists("SELECT EXISTS(SELECT 1 FROM product WHERE id=:value AND active AND controls_inventory)", productId);
    }

    @Override
    public Optional<UUID> lockCurrentStartedInitialLoad(UUID routeId) {
        return jdbc.sql(CURRENT_STARTED_INITIAL_LOAD_LOCK_SQL).param("routeId", routeId).query(UUID.class).optional();
    }

    @Override
    public boolean routeLoadHasClosedSettlement(UUID routeLoadId) {
        return Boolean.TRUE.equals(jdbc.sql(CURRENT_INITIAL_LOAD_CLOSED_SETTLEMENT_SQL)
                .param("routeLoadId", routeLoadId).query(Boolean.class).single());
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
    public LoadView createLoad(NewLoad item) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO route_load(id,route_id,source_location_id,target_location_id,planned_date,load_type,notes,created_by)
                VALUES (:id,:routeId,:sourceLocationId,:targetLocationId,:plannedDate,:loadType,:notes,:createdBy)
                """).param("id", id).param("routeId", item.routeId())
                .param("sourceLocationId", item.sourceLocationId()).param("targetLocationId", item.targetLocationId())
                .param("plannedDate", item.plannedDate()).param("loadType", item.loadType()).param("notes", item.notes())
                .param("createdBy", item.createdBy()).update();
        for (var row : item.items()) {
            jdbc.sql("""
                    INSERT INTO route_load_item(id,route_load_id,product_id,quantity_base_units)
                    VALUES (:id,:loadId,:productId,:quantity)
                    """).param("id", UUID.randomUUID()).param("loadId", id).param("productId", row.productId())
                    .param("quantity", row.quantityBaseUnits()).update();
        }
        return findLoad(id);
    }

    @Override
    public List<LoadView> findLoads(Optional<UUID> sellerUserId) {
        String filter = sellerUserId.isPresent() ? """
                 AND EXISTS(SELECT 1 FROM route_assignment ra JOIN seller s ON s.id=ra.seller_id
                    WHERE ra.route_id=rl.route_id AND s.user_id=:sellerUserId AND s.status='ACTIVE'
                      AND ra.valid_from<=current_date AND (ra.valid_to IS NULL OR ra.valid_to>=current_date))
                """ : "";
        var statement = jdbc.sql(loadSelect() + filter + " ORDER BY rl.planned_date DESC,rl.load_number DESC");
        if (sellerUserId.isPresent()) statement = statement.param("sellerUserId", sellerUserId.get());
        return statement.query((rs, row) -> loadRow(rs)).list().stream().map(this::withDetails).toList();
    }

    @Override
    public LoadView findLoad(UUID id) {
        return jdbc.sql(loadSelect() + " AND rl.id=:id").param("id", id)
                .query((rs, row) -> loadRow(rs)).optional().map(this::withDetails)
                .orElseThrow(() -> notFound("ROUTE_LOAD_NOT_FOUND", "No se encontró la carga de ruta."));
    }

    @Override
    public LoadView confirmWarehouse(UUID id, UUID actorId, UUID deviceId) {
        updateStatus("""
                UPDATE route_load SET status='WAREHOUSE_CONFIRMED',warehouse_confirmed_by=:actorId,
                    warehouse_confirmed_device_id=:deviceId,warehouse_confirmed_at=now(),version=version+1
                WHERE id=:id AND status='PREPARED'
                """, id, actorId, deviceId);
        return findLoad(id);
    }

    @Override
    public LoadView confirmReceipt(UUID id, UUID actorId, UUID deviceId) {
        updateStatus("""
                UPDATE route_load SET status='RECEIVED',seller_received_by=:actorId,
                    seller_received_device_id=:deviceId,seller_received_at=now(),version=version+1
                WHERE id=:id AND status='WAREHOUSE_CONFIRMED'
                """, id, actorId, deviceId);
        return findLoad(id);
    }

    @Override
    public LoadView start(UUID id, UUID actorId, UUID deviceId) {
        updateStatus("""
                UPDATE route_load SET status='STARTED',started_by=:actorId,started_device_id=:deviceId,
                    started_at=now(),version=version+1 WHERE id=:id AND status='RECEIVED'
                """, id, actorId, deviceId);
        return findLoad(id);
    }

    @Override
    public LoadView addCorrection(NewCorrection item) {
        jdbc.sql("""
                INSERT INTO route_load_correction(id,route_load_id,product_id,quantity_delta,reason,actor_id,device_id)
                VALUES (:id,:loadId,:productId,:quantityDelta,:reason,:actorId,:deviceId)
                """).param("id", item.id()).param("loadId", item.routeLoadId()).param("productId", item.productId())
                .param("quantityDelta", item.quantityDelta()).param("reason", item.reason())
                .param("actorId", item.actorId()).param("deviceId", item.deviceId()).update();
        return findLoad(item.routeLoadId());
    }

    private LoadView withDetails(LoadView load) {
        var items = jdbc.sql("""
                SELECT rli.id,rli.product_id,p.code product_code,p.name product_name,u.code base_unit_code,
                       rli.quantity_base_units
                FROM route_load_item rli JOIN product p ON p.id=rli.product_id
                JOIN unit_of_measure u ON u.id=p.base_unit_id
                WHERE rli.route_load_id=:id ORDER BY p.name,p.code
                """).param("id", load.id()).query((rs, row) -> new ItemView(rs.getObject("id", UUID.class),
                rs.getObject("product_id", UUID.class), rs.getString("product_code"), rs.getString("product_name"),
                rs.getString("base_unit_code"), rs.getBigDecimal("quantity_base_units"))).list();
        var corrections = jdbc.sql("""
                SELECT rlc.id,rlc.product_id,p.code product_code,p.name product_name,rlc.quantity_delta,
                       rlc.reason,rlc.actor_id,u.username actor_username,rlc.device_id,rlc.created_at
                FROM route_load_correction rlc JOIN product p ON p.id=rlc.product_id
                JOIN app_user u ON u.id=rlc.actor_id WHERE rlc.route_load_id=:id ORDER BY rlc.created_at DESC
                """).param("id", load.id()).query((rs, row) -> new CorrectionView(rs.getObject("id", UUID.class),
                rs.getObject("product_id", UUID.class), rs.getString("product_code"), rs.getString("product_name"),
                rs.getBigDecimal("quantity_delta"), rs.getString("reason"), rs.getObject("actor_id", UUID.class),
                rs.getString("actor_username"), rs.getObject("device_id", UUID.class), instant(rs, "created_at"))).list();
        return new LoadView(load.id(), load.loadNumber(), load.routeId(), load.routeCode(), load.routeName(),
                load.sourceLocationId(), load.sourceLocationCode(), load.sourceLocationName(), load.targetLocationId(),
                load.targetLocationCode(), load.targetLocationName(), load.plannedDate(), load.notes(), load.status(),
                load.createdBy(), load.createdByUsername(), load.createdAt(), load.warehouseConfirmedBy(),
                load.warehouseConfirmedByUsername(), load.warehouseConfirmedDeviceId(), load.warehouseConfirmedAt(),
                load.sellerReceivedBy(), load.sellerReceivedByUsername(), load.sellerReceivedDeviceId(),
                load.sellerReceivedAt(), load.loadType(), load.startedBy(), load.startedByUsername(), load.startedDeviceId(),
                load.startedAt(), items, corrections);
    }

    private String loadSelect() {
        return """
                SELECT rl.id,rl.load_number,rl.route_id,r.code route_code,r.name route_name,
                       rl.source_location_id,src.code source_location_code,src.name source_location_name,
                       rl.target_location_id,dst.code target_location_code,dst.name target_location_name,
                       rl.planned_date,rl.load_type,rl.notes,rl.status,rl.created_by,creator.username created_by_username,rl.created_at,
                       rl.warehouse_confirmed_by,warehouse_user.username warehouse_confirmed_by_username,
                       rl.warehouse_confirmed_device_id,rl.warehouse_confirmed_at,
                       rl.seller_received_by,seller_user.username seller_received_by_username,
                       rl.seller_received_device_id,rl.seller_received_at,
                       rl.started_by,started_user.username started_by_username,rl.started_device_id,rl.started_at
                FROM route_load rl JOIN route r ON r.id=rl.route_id
                JOIN inventory_location src ON src.id=rl.source_location_id
                JOIN inventory_location dst ON dst.id=rl.target_location_id
                JOIN app_user creator ON creator.id=rl.created_by
                LEFT JOIN app_user warehouse_user ON warehouse_user.id=rl.warehouse_confirmed_by
                LEFT JOIN app_user seller_user ON seller_user.id=rl.seller_received_by
                LEFT JOIN app_user started_user ON started_user.id=rl.started_by WHERE 1=1
                """;
    }

    private LoadView loadRow(ResultSet rs) throws SQLException {
        return new LoadView(rs.getObject("id", UUID.class), rs.getLong("load_number"),
                rs.getObject("route_id", UUID.class), rs.getString("route_code"), rs.getString("route_name"),
                rs.getObject("source_location_id", UUID.class), rs.getString("source_location_code"),
                rs.getString("source_location_name"), rs.getObject("target_location_id", UUID.class),
                rs.getString("target_location_code"), rs.getString("target_location_name"),
                rs.getObject("planned_date", LocalDate.class), rs.getString("notes"), rs.getString("status"),
                rs.getObject("created_by", UUID.class), rs.getString("created_by_username"), instant(rs, "created_at"),
                rs.getObject("warehouse_confirmed_by", UUID.class), rs.getString("warehouse_confirmed_by_username"),
                rs.getObject("warehouse_confirmed_device_id", UUID.class), instant(rs, "warehouse_confirmed_at"),
                rs.getObject("seller_received_by", UUID.class), rs.getString("seller_received_by_username"),
                rs.getObject("seller_received_device_id", UUID.class), instant(rs, "seller_received_at"), rs.getString("load_type"),
                rs.getObject("started_by", UUID.class), rs.getString("started_by_username"),
                rs.getObject("started_device_id", UUID.class), instant(rs, "started_at"), List.of(), List.of());
    }

    private void updateStatus(String sql, UUID id, UUID actorId, UUID deviceId) {
        int changed = jdbc.sql(sql).param("id", id).param("actorId", actorId).param("deviceId", deviceId).update();
        if (changed != 1) {
            throw new BusinessException("INVALID_LOAD_STATUS",
                    "La carga cambió de estado y no admite esta operación.", ErrorCategory.CONFLICT);
        }
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
