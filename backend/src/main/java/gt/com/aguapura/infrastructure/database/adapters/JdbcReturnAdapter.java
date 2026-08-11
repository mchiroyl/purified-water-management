package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.ReturnPort;
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
public class JdbcReturnAdapter implements ReturnPort {
    private final JdbcClient jdbc;

    public JdbcReturnAdapter(JdbcClient jdbc) {
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
                SELECT r.id route_id,r.code route_code,r.name route_name,il.id route_location_id,
                       s.id seller_id,s.display_name seller_name
                FROM route r JOIN inventory_location il ON il.route_id=r.id AND il.active
                JOIN LATERAL (SELECT ra.seller_id FROM route_assignment ra WHERE ra.route_id=r.id
                    AND ra.valid_from<=current_date AND (ra.valid_to IS NULL OR ra.valid_to>=current_date)
                    ORDER BY ra.valid_from DESC LIMIT 1) current_assignment ON true
                JOIN seller s ON s.id=current_assignment.seller_id AND s.status='ACTIVE'
                WHERE r.id=:id AND r.status='ACTIVE'
                """).param("id", routeId).query((rs, row) -> new RouteContext(
                rs.getObject("route_id", UUID.class), rs.getString("route_code"), rs.getString("route_name"),
                rs.getObject("route_location_id", UUID.class), rs.getObject("seller_id", UUID.class),
                rs.getString("seller_name"))).optional();
    }

    @Override
    public boolean customerBelongsToRoute(UUID customerId, UUID routeId) {
        return Boolean.TRUE.equals(jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM customer_route cr JOIN customer c ON c.id=cr.customer_id
                WHERE cr.customer_id=:customerId AND cr.route_id=:routeId AND c.status='ACTIVE'
                  AND cr.valid_from<=current_date AND (cr.valid_to IS NULL OR cr.valid_to>=current_date))
                """).param("customerId", customerId).param("routeId", routeId).query(Boolean.class).single());
    }

    @Override
    public boolean saleBelongsToCustomerAndRoute(UUID saleId, UUID customerId, UUID routeId) {
        return Boolean.TRUE.equals(jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM sale WHERE id=:saleId AND customer_id=:customerId AND route_id=:routeId)
                """).param("saleId", saleId).param("customerId", customerId).param("routeId", routeId)
                .query(Boolean.class).single());
    }

    @Override
    public boolean activeWarehouseExists(UUID locationId) {
        return Boolean.TRUE.equals(jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM inventory_location WHERE id=:id AND active AND location_type='WAREHOUSE')
                """).param("id", locationId).query(Boolean.class).single());
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
    public ReturnView create(NewReturn item) {
        jdbc.sql("""
                INSERT INTO customer_return(id,client_reference,return_type,route_id,route_location_id,
                    customer_id,sale_id,seller_id,reported_by,device_id,reason,reported_at_local)
                VALUES (:id,:clientReference,:returnType,:routeId,:routeLocationId,:customerId,:saleId,
                    :sellerId,:reportedBy,:deviceId,:reason,:reportedAt)
                """).param("id", item.id()).param("clientReference", item.clientReference())
                .param("returnType", item.returnType()).param("routeId", item.route().routeId())
                .param("routeLocationId", item.route().routeLocationId())
                .param("customerId", item.customerId(), Types.OTHER).param("saleId", item.saleId(), Types.OTHER)
                .param("sellerId", item.route().sellerId()).param("reportedBy", item.reportedBy())
                .param("deviceId", item.deviceId()).param("reason", item.reason())
                .param("reportedAt", databaseTimestamp(item.reportedAtLocal())).update();
        for (var row : item.items()) {
            jdbc.sql("""
                    INSERT INTO return_item(id,return_id,presentation_id,product_id,presentation_quantity,
                        reported_base_units)
                    VALUES (:id,:returnId,:presentationId,:productId,:presentationQuantity,:reported)
                    """).param("id", row.id()).param("returnId", item.id())
                    .param("presentationId", row.presentation().presentationId())
                    .param("productId", row.presentation().productId())
                    .param("presentationQuantity", row.presentationQuantity())
                    .param("reported", row.reportedBaseUnits()).update();
        }
        return findReturn(item.id());
    }

    @Override
    public ReturnView findForReceipt(UUID id) {
        var item = jdbc.sql(returnSelect() + " AND cr.id=:id FOR UPDATE OF cr").param("id", id)
                .query((rs, row) -> returnRow(rs)).optional().orElseThrow(() -> notFound());
        return withItems(item);
    }

    @Override
    public ReturnView confirmReceipt(NewReceipt item) {
        for (var row : item.items()) {
            jdbc.sql("""
                    UPDATE return_item SET received_base_units=:received WHERE id=:itemId AND return_id=:returnId
                    """).param("received", row.receivedBaseUnits()).param("itemId", row.itemId())
                    .param("returnId", item.returnId()).update();
        }
        int changed = jdbc.sql("""
                UPDATE customer_return SET status=:status,warehouse_location_id=:warehouseId,
                    received_by=:receivedBy,received_device_id=:deviceId,received_at=now(),receipt_notes=:notes
                WHERE id=:id AND status='PENDING_RECEIPT'
                """).param("status", item.status()).param("warehouseId", item.warehouseLocationId())
                .param("receivedBy", item.receivedBy()).param("deviceId", item.deviceId())
                .param("notes", item.notes()).param("id", item.returnId()).update();
        if (changed != 1) throw new BusinessException("RETURN_CONCURRENT_RECEIPT",
                "La devolución cambió durante la recepción.", ErrorCategory.CONFLICT);
        return findReturn(item.returnId());
    }

    @Override
    public List<ReturnView> findReturns(Optional<UUID> sellerUserId) {
        String filter = sellerUserId.isPresent() ? " AND seller.user_id=:sellerUserId" : "";
        var statement = jdbc.sql(returnSelect() + filter + " ORDER BY cr.received_at_server DESC");
        if (sellerUserId.isPresent()) statement = statement.param("sellerUserId", sellerUserId.get());
        return statement.query((rs, row) -> returnRow(rs)).list().stream().map(this::withItems).toList();
    }

    private ReturnView findReturn(UUID id) {
        var item = jdbc.sql(returnSelect() + " AND cr.id=:id").param("id", id)
                .query((rs, row) -> returnRow(rs)).optional().orElseThrow(this::notFound);
        return withItems(item);
    }

    private ReturnView withItems(ReturnView item) {
        var details = jdbc.sql("""
                SELECT ri.id,ri.return_id,ri.presentation_id,pp.code presentation_code,
                       pp.name presentation_name,ri.product_id,p.code product_code,p.name product_name,
                       ri.presentation_quantity,ri.reported_base_units,ri.received_base_units
                FROM return_item ri JOIN product_presentation pp ON pp.id=ri.presentation_id
                JOIN product p ON p.id=ri.product_id WHERE ri.return_id=:id ORDER BY p.name,pp.name
                """).param("id", item.id()).query((rs, row) -> new ReturnItemView(
                rs.getObject("id", UUID.class), rs.getObject("return_id", UUID.class),
                rs.getObject("presentation_id", UUID.class), rs.getString("presentation_code"),
                rs.getString("presentation_name"), rs.getObject("product_id", UUID.class),
                rs.getString("product_code"), rs.getString("product_name"),
                rs.getBigDecimal("presentation_quantity"), rs.getBigDecimal("reported_base_units"),
                rs.getBigDecimal("received_base_units"))).list();
        return new ReturnView(item.id(), item.clientReference(), item.returnType(), item.routeId(),
                item.routeCode(), item.routeName(), item.routeLocationId(), item.customerId(), item.customerCode(),
                item.customerName(), item.saleId(), item.saleDocumentNumber(), item.sellerId(), item.sellerName(),
                item.reportedBy(), item.reportedByUsername(), item.deviceId(), item.status(), item.reason(),
                item.reportedAtLocal(), item.receivedAtServer(), item.warehouseLocationId(),
                item.warehouseLocationName(), item.receivedBy(), item.receivedByUsername(), item.receivedDeviceId(),
                item.receivedAt(), item.receiptNotes(), details);
    }

    private String returnSelect() {
        return """
                SELECT cr.id,cr.client_reference,cr.return_type,cr.route_id,r.code route_code,r.name route_name,
                       cr.route_location_id,cr.customer_id,c.code customer_code,c.name customer_name,
                       cr.sale_id,sale.document_number sale_document_number,cr.seller_id,seller.display_name seller_name,
                       cr.reported_by,reporter.username reported_by_username,cr.device_id,cr.status,cr.reason,
                       cr.reported_at_local,cr.received_at_server,cr.warehouse_location_id,
                       warehouse.name warehouse_location_name,cr.received_by,receiver.username received_by_username,
                       cr.received_device_id,cr.received_at,cr.receipt_notes
                FROM customer_return cr JOIN route r ON r.id=cr.route_id JOIN seller ON seller.id=cr.seller_id
                JOIN app_user reporter ON reporter.id=cr.reported_by LEFT JOIN customer c ON c.id=cr.customer_id
                LEFT JOIN sale ON sale.id=cr.sale_id LEFT JOIN inventory_location warehouse ON warehouse.id=cr.warehouse_location_id
                LEFT JOIN app_user receiver ON receiver.id=cr.received_by WHERE 1=1
                """;
    }

    private ReturnView returnRow(ResultSet rs) throws SQLException {
        return new ReturnView(rs.getObject("id", UUID.class), rs.getObject("client_reference", UUID.class),
                rs.getString("return_type"), rs.getObject("route_id", UUID.class), rs.getString("route_code"),
                rs.getString("route_name"), rs.getObject("route_location_id", UUID.class),
                rs.getObject("customer_id", UUID.class), rs.getString("customer_code"), rs.getString("customer_name"),
                rs.getObject("sale_id", UUID.class), rs.getString("sale_document_number"),
                rs.getObject("seller_id", UUID.class), rs.getString("seller_name"),
                rs.getObject("reported_by", UUID.class), rs.getString("reported_by_username"),
                rs.getObject("device_id", UUID.class), rs.getString("status"), rs.getString("reason"),
                instant(rs, "reported_at_local"), instant(rs, "received_at_server"),
                rs.getObject("warehouse_location_id", UUID.class), rs.getString("warehouse_location_name"),
                rs.getObject("received_by", UUID.class), rs.getString("received_by_username"),
                rs.getObject("received_device_id", UUID.class), instant(rs, "received_at"),
                rs.getString("receipt_notes"), List.of());
    }

    static OffsetDateTime databaseTimestamp(Instant value) {
        return value == null ? null : value.atOffset(ZoneOffset.UTC);
    }

    private Instant instant(ResultSet rs, String column) throws SQLException {
        var value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    private BusinessException notFound() {
        return new BusinessException("RETURN_NOT_FOUND", "No se encontró la devolución.", ErrorCategory.NOT_FOUND);
    }
}
