package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.SettlementPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcSettlementAdapter implements SettlementPort {
    static final String CURRENT_STARTED_INITIAL_LOAD_LOCK_SQL = """
            SELECT id FROM route_load
            WHERE id=:id AND load_type='INITIAL' AND status='STARTED'
            FOR UPDATE
            """;

    private final JdbcClient jdbc;

    public JdbcSettlementAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean sellerOwnsLoad(UUID userId, UUID routeLoadId) {
        return Boolean.TRUE.equals(jdbc.sql("""
                SELECT EXISTS(SELECT 1 FROM route_load rl JOIN route_assignment ra ON ra.route_id=rl.route_id
                JOIN seller s ON s.id=ra.seller_id WHERE rl.id=:loadId AND s.user_id=:userId
                  AND ra.valid_from<=rl.planned_date AND (ra.valid_to IS NULL OR ra.valid_to>=rl.planned_date))
                """).param("loadId", routeLoadId).param("userId", userId).query(Boolean.class).single());
    }

    @Override
    public Source loadSource(UUID routeLoadId) {
        var source = jdbc.sql("""
                SELECT rl.id,rl.load_number,rl.route_id,r.code route_code,r.name route_name,rl.status,
                       rl.started_at,COALESCE(s.display_name,receiver.username) seller_name
                FROM route_load rl JOIN route r ON r.id=rl.route_id
                LEFT JOIN app_user receiver ON receiver.id=rl.seller_received_by
                LEFT JOIN seller s ON s.user_id=receiver.id
                WHERE rl.id=:id FOR UPDATE OF rl
                """).param("id", routeLoadId).query((rs, row) -> new Source(
                rs.getObject("id", UUID.class), rs.getLong("load_number"), rs.getObject("route_id", UUID.class),
                rs.getString("route_code"), rs.getString("route_name"), rs.getString("seller_name"),
                rs.getString("status"), rs.getTimestamp("started_at") == null ? null : rs.getTimestamp("started_at").toInstant(),
                List.of(), null, List.of())).optional().orElseThrow(this::notFound);
        if (source.startedAt() == null) throw new BusinessException("SETTLEMENT_LOAD_NOT_STARTED",
                "La carga debe estar iniciada antes de calcular su liquidación.", ErrorCategory.CONFLICT);
        var products = jdbc.sql("""
                SELECT p.id product_id,p.code product_code,p.name product_name,loaded.loaded_units,
                    COALESCE((SELECT SUM(si.quantity_base_units) FROM sale_item si JOIN sale sale ON sale.id=si.sale_id
                        WHERE sale.route_id=rl.route_id AND si.product_id=p.id AND sale.status='CONFIRMED'
                          AND NOT EXISTS(SELECT 1 FROM annulment_request ar WHERE ar.sale_id=sale.id AND ar.status='APPROVED')
                          AND sale.created_at>=rl.started_at AND sale.created_at<=COALESCE((SELECT closed_at FROM settlement WHERE route_load_id=rl.id),now())),0) sold_units,
                    COALESCE((SELECT SUM(ri.received_base_units) FROM return_item ri JOIN customer_return cr ON cr.id=ri.return_id
                        WHERE cr.route_id=rl.route_id AND ri.product_id=p.id AND cr.return_type='UNSOLD_GOOD'
                          AND cr.status IN ('RECEIVED','PARTIALLY_RECEIVED') AND cr.received_at>=rl.started_at
                          AND cr.received_at<=COALESCE((SELECT closed_at FROM settlement WHERE route_load_id=rl.id),now())),0) returned_good_units,
                    COALESCE((SELECT SUM(ri.received_base_units) FROM return_item ri JOIN customer_return cr ON cr.id=ri.return_id
                        WHERE cr.route_id=rl.route_id AND ri.product_id=p.id AND cr.return_type='CUSTOMER_RETURN'
                          AND cr.status IN ('RECEIVED','PARTIALLY_RECEIVED') AND cr.received_at>=rl.started_at
                          AND cr.received_at<=COALESCE((SELECT closed_at FROM settlement WHERE route_load_id=rl.id),now())),0) customer_return_units,
                    COALESCE((SELECT SUM(wi.approved_base_units) FROM waste_item wi JOIN waste w ON w.id=wi.waste_id
                        WHERE w.route_id=rl.route_id AND wi.product_id=p.id AND w.status IN ('APPROVED','PARTIALLY_APPROVED')
                          AND w.received_at_server>=rl.started_at
                          AND w.received_at_server<=COALESCE((SELECT closed_at FROM settlement WHERE route_load_id=rl.id),now())),0) approved_waste_units
                FROM route_load rl
                JOIN LATERAL (
                    SELECT rli.product_id,
                           SUM(rli.quantity_base_units + COALESCE((SELECT SUM(rlc.quantity_delta)
                               FROM route_load_correction rlc WHERE rlc.route_load_id=source_load.id
                                 AND rlc.product_id=rli.product_id),0)) loaded_units
                    FROM route_load source_load JOIN route_load_item rli ON rli.route_load_id=source_load.id
                    WHERE source_load.route_id=rl.route_id AND (
                        source_load.id=rl.id OR (
                            source_load.load_type='REPLENISHMENT'
                            AND source_load.status IN ('RECEIVED','STARTED','SETTLED')
                            AND source_load.seller_received_at>=rl.started_at
                            AND source_load.seller_received_at<=COALESCE((SELECT closed_at FROM settlement WHERE route_load_id=rl.id),now())
                        )
                    )
                    GROUP BY rli.product_id
                ) loaded ON true
                JOIN product p ON p.id=loaded.product_id WHERE rl.id=:id ORDER BY p.name
                """).param("id", routeLoadId).query((rs, row) -> new ProductSource(
                rs.getObject("product_id", UUID.class), rs.getString("product_code"), rs.getString("product_name"),
                rs.getBigDecimal("loaded_units"), rs.getBigDecimal("sold_units"),
                rs.getBigDecimal("returned_good_units"), rs.getBigDecimal("customer_return_units"),
                rs.getBigDecimal("approved_waste_units"))).list();
        var financial = jdbc.sql("""
                SELECT
                  COALESCE((SELECT SUM(sale.total) FROM sale WHERE sale.route_id=rl.route_id AND sale.status='CONFIRMED'
                    AND NOT EXISTS(SELECT 1 FROM annulment_request ar WHERE ar.sale_id=sale.id AND ar.status='APPROVED')
                    AND sale.created_at>=rl.started_at AND sale.created_at<=COALESCE((SELECT closed_at FROM settlement WHERE route_load_id=rl.id),now())),0) sales_total,
                  COALESCE((SELECT SUM(pay.amount) FROM payment pay JOIN sale sale ON sale.id=pay.sale_id
                    WHERE sale.route_id=rl.route_id AND pay.payment_method='CASH' AND pay.status='CONFIRMED'
                      AND NOT EXISTS(SELECT 1 FROM annulment_request ar WHERE ar.sale_id=sale.id AND ar.status='APPROVED')
                      AND sale.created_at>=rl.started_at AND sale.created_at<=COALESCE((SELECT closed_at FROM settlement WHERE route_load_id=rl.id),now())),0) expected_cash,
                  COALESCE((SELECT SUM(cd.amount) FROM cash_delivery cd WHERE cd.route_load_id=rl.id),0) delivered_cash,
                  COALESCE((SELECT SUM(pay.amount) FROM payment pay JOIN sale sale ON sale.id=pay.sale_id
                    WHERE sale.route_id=rl.route_id AND pay.payment_method='TRANSFER' AND pay.status='VERIFIED'
                      AND NOT EXISTS(SELECT 1 FROM annulment_request ar WHERE ar.sale_id=sale.id AND ar.status='APPROVED')
                      AND sale.created_at>=rl.started_at AND sale.created_at<=COALESCE((SELECT closed_at FROM settlement WHERE route_load_id=rl.id),now())),0) verified_transfers,
                  COALESCE((SELECT SUM(pay.amount) FROM payment pay JOIN sale sale ON sale.id=pay.sale_id
                    WHERE sale.route_id=rl.route_id AND pay.payment_method='CREDIT' AND pay.status='APPLIED'
                      AND NOT EXISTS(SELECT 1 FROM annulment_request ar WHERE ar.sale_id=sale.id AND ar.status='APPROVED')
                      AND sale.created_at>=rl.started_at AND sale.created_at<=COALESCE((SELECT closed_at FROM settlement WHERE route_load_id=rl.id),now())),0) applied_credit
                FROM route_load rl WHERE rl.id=:id
                """).param("id", routeLoadId).query((rs, row) -> new FinancialSource(
                rs.getBigDecimal("sales_total"), rs.getBigDecimal("expected_cash"),
                rs.getBigDecimal("delivered_cash"), rs.getBigDecimal("verified_transfers"),
                rs.getBigDecimal("applied_credit"))).single();
        var blockers = blockers(routeLoadId);
        return new Source(source.routeLoadId(), source.loadNumber(), source.routeId(), source.routeCode(),
                source.routeName(), source.sellerName(), source.loadStatus(), source.startedAt(),
                products, financial, blockers);
    }

    private List<String> blockers(UUID loadId) {
        var result = new ArrayList<String>();
        addBlocker(result, loadId, "TRANSFER_PENDING", """
                SELECT count(*) FROM payment p JOIN sale s ON s.id=p.sale_id JOIN route_load rl ON rl.route_id=s.route_id
                WHERE rl.id=:id AND p.payment_method='TRANSFER' AND p.status='PENDING_VERIFICATION' AND s.created_at>=rl.started_at
                AND NOT EXISTS(SELECT 1 FROM annulment_request ar WHERE ar.sale_id=s.id AND ar.status='APPROVED')
                """);
        addBlocker(result, loadId, "WASTE_PENDING", """
                SELECT count(*) FROM waste w JOIN route_load rl ON rl.route_id=w.route_id WHERE rl.id=:id
                AND w.status IN ('PENDING_REVIEW','PENDING_SECOND_APPROVAL') AND w.received_at_server>=rl.started_at
                """);
        addBlocker(result, loadId, "RETURN_PENDING", """
                SELECT count(*) FROM customer_return cr JOIN route_load rl ON rl.route_id=cr.route_id WHERE rl.id=:id
                AND cr.status='PENDING_RECEIPT' AND cr.received_at_server>=rl.started_at
                """);
        addBlocker(result, loadId, "CUSTOMER_REVIEW_PENDING", """
                SELECT count(*) FROM customer c JOIN route_load rl ON c.created_by=rl.seller_received_by WHERE rl.id=:id
                AND c.registration_state='PENDING_REVIEW' AND c.created_at>=rl.started_at
                """);
        addBlocker(result, loadId, "SYNC_CONFLICT", """
                SELECT count(*) FROM sync_operation so JOIN route_load rl ON so.user_id=rl.seller_received_by WHERE rl.id=:id
                AND so.received_at_server>=rl.started_at AND (so.processing_status<>'COMPLETED' OR so.result_status IN ('CONFLICT','RETRY'))
                """);
        addBlocker(result, loadId, "REPLENISHMENT_PENDING", """
                SELECT count(*) FROM route_load rec JOIN route_load initial ON initial.route_id=rec.route_id
                WHERE initial.id=:id AND rec.load_type='REPLENISHMENT' AND rec.created_at>=initial.started_at
                  AND rec.status IN ('PREPARED','WAREHOUSE_CONFIRMED')
                """);
        return result;
    }

    private void addBlocker(List<String> target, UUID loadId, String code, String sql) {
        Integer count = jdbc.sql(sql).param("id", loadId).query(Integer.class).single();
        if (count != null && count > 0) target.add(code + ":" + count);
    }

    @Override
    public SettlementView saveCalculation(NewCalculation item) {
        var existing = jdbc.sql("SELECT status FROM settlement WHERE route_load_id=:id FOR UPDATE")
                .param("id", item.source().routeLoadId()).query(String.class).optional();
        if (existing.filter("CLOSED"::equals).isPresent()) throw new BusinessException("SETTLEMENT_ALREADY_CLOSED",
                "La liquidación cerrada es inmutable.", ErrorCategory.CONFLICT);
        jdbc.sql("""
                INSERT INTO settlement(id,route_load_id,route_id,status,sales_total,expected_cash,delivered_cash,
                  verified_transfers,applied_credit,monetary_difference,physical_difference_total,blocking_reasons)
                VALUES (:id,:loadId,:routeId,:status,:sales,:cash,:delivered,:transfers,:credit,:moneyDiff,:physicalDiff,:blockers)
                ON CONFLICT (route_load_id) DO UPDATE SET status=excluded.status,sales_total=excluded.sales_total,
                  expected_cash=excluded.expected_cash,delivered_cash=excluded.delivered_cash,
                  verified_transfers=excluded.verified_transfers,applied_credit=excluded.applied_credit,
                  monetary_difference=excluded.monetary_difference,physical_difference_total=excluded.physical_difference_total,
                  blocking_reasons=excluded.blocking_reasons,calculated_at=now(),version=settlement.version+1
                """).param("id", item.settlementId()).param("loadId", item.source().routeLoadId())
                .param("routeId", item.source().routeId()).param("status", item.status())
                .param("sales", item.source().financial().salesTotal())
                .param("cash", item.source().financial().expectedCash())
                .param("delivered", item.source().financial().deliveredCash())
                .param("transfers", item.source().financial().verifiedTransfers())
                .param("credit", item.source().financial().appliedCredit())
                .param("moneyDiff", item.monetaryDifference()).param("physicalDiff", item.physicalDifferenceTotal())
                .param("blockers", String.join("\n", item.blockers())).update();
        UUID settlementId = jdbc.sql("SELECT id FROM settlement WHERE route_load_id=:id")
                .param("id", item.source().routeLoadId()).query(UUID.class).single();
        jdbc.sql("DELETE FROM settlement_item WHERE settlement_id=:id").param("id", settlementId).update();
        for (var row : item.items()) {
            jdbc.sql("""
                    INSERT INTO settlement_item(id,settlement_id,product_id,loaded_units,sold_units,
                      returned_good_units,customer_return_units,approved_waste_units,physical_difference)
                    VALUES (:id,:settlementId,:productId,:loaded,:sold,:returned,:customerReturned,:waste,:difference)
                    """).param("id", row.id()).param("settlementId", settlementId)
                    .param("productId", row.source().productId()).param("loaded", row.source().loadedUnits())
                    .param("sold", row.source().soldUnits()).param("returned", row.source().returnedGoodUnits())
                    .param("customerReturned", row.source().customerReturnUnits())
                    .param("waste", row.source().approvedWasteUnits()).param("difference", row.physicalDifference()).update();
        }
        return findOne(item.source().routeLoadId());
    }

    @Override
    public SettlementView close(UUID routeLoadId, UUID actorId, UUID deviceId, String notes) {
        UUID lockedLoad = jdbc.sql(CURRENT_STARTED_INITIAL_LOAD_LOCK_SQL)
                .param("id", routeLoadId).query(UUID.class).optional().orElseThrow(() ->
                new BusinessException("SETTLEMENT_NOT_READY", "La carga ya no está disponible para cierre.", ErrorCategory.CONFLICT));
        int changed = jdbc.sql("""
                UPDATE settlement SET status='CLOSED',closed_by=:actor,closed_device_id=:device,
                  closed_at=now(),close_notes=:notes,version=version+1 WHERE route_load_id=:loadId
                  AND status IN ('BALANCED','WITH_DIFFERENCE') AND blocking_reasons=''
                """).param("actor", actorId).param("device", deviceId).param("notes", notes)
                .param("loadId", routeLoadId).update();
        if (changed != 1) throw new BusinessException("SETTLEMENT_NOT_READY",
                "La liquidación no está lista para cierre.", ErrorCategory.CONFLICT);
        int loadChanged = jdbc.sql("UPDATE route_load SET status='SETTLED',version=version+1 WHERE id=:id AND status='STARTED'")
                .param("id", lockedLoad).update();
        if (loadChanged != 1) throw new BusinessException("SETTLEMENT_NOT_READY",
                "La carga cambió de estado durante el cierre.", ErrorCategory.CONFLICT);
        return findOne(routeLoadId);
    }

    @Override
    public CashDeliveryView addCashDelivery(UUID routeLoadId, UUID receivedBy, UUID deviceId,
                                            BigDecimal amount, String notes) {
        UUID id = UUID.randomUUID();
        jdbc.sql("""
                INSERT INTO cash_delivery(id,route_load_id,amount,delivered_by,delivered_device_id,
                  received_by,received_device_id,notes)
                SELECT :id,rl.id,:amount,rl.seller_received_by,rl.seller_received_device_id,:receivedBy,:deviceId,:notes
                FROM route_load rl WHERE rl.id=:loadId AND rl.status='STARTED'
                """).param("id", id).param("amount", amount).param("receivedBy", receivedBy)
                .param("deviceId", deviceId).param("notes", notes).param("loadId", routeLoadId).update();
        return jdbc.sql(cashSelect() + " WHERE cd.id=:id").param("id", id)
                .query((rs, row) -> cashRow(rs)).optional().orElseThrow(this::notFound);
    }

    @Override
    public List<SettlementView> findAll(Optional<UUID> sellerUserId) {
        String filter = sellerUserId.isPresent() ? " AND EXISTS(SELECT 1 FROM route_assignment ra JOIN seller own ON own.id=ra.seller_id WHERE ra.route_id=s.route_id AND own.user_id=:userId AND ra.valid_from<=rl.planned_date AND (ra.valid_to IS NULL OR ra.valid_to>=rl.planned_date))" : "";
        var query = jdbc.sql(settlementSelect() + filter + " ORDER BY s.calculated_at DESC");
        if (sellerUserId.isPresent()) query = query.param("userId", sellerUserId.get());
        return query.query((rs, row) -> settlementRow(rs)).list().stream().map(this::withDetails).toList();
    }

    private SettlementView findOne(UUID routeLoadId) {
        return withDetails(jdbc.sql(settlementSelect() + " AND s.route_load_id=:id").param("id", routeLoadId)
                .query((rs, row) -> settlementRow(rs)).optional().orElseThrow(this::notFound));
    }

    private SettlementView withDetails(SettlementView item) {
        var details = jdbc.sql("""
                SELECT si.*,p.code product_code,p.name product_name FROM settlement_item si
                JOIN product p ON p.id=si.product_id WHERE si.settlement_id=:id ORDER BY p.name
                """).param("id", item.id()).query((rs, row) -> new ItemView(rs.getObject("id", UUID.class),
                rs.getObject("product_id", UUID.class), rs.getString("product_code"), rs.getString("product_name"),
                rs.getBigDecimal("loaded_units"), rs.getBigDecimal("sold_units"),
                rs.getBigDecimal("returned_good_units"), rs.getBigDecimal("customer_return_units"),
                rs.getBigDecimal("approved_waste_units"), rs.getBigDecimal("physical_difference"))).list();
        var cash = jdbc.sql(cashSelect() + " WHERE cd.route_load_id=:id ORDER BY cd.delivered_at")
                .param("id", item.routeLoadId()).query((rs, row) -> cashRow(rs)).list();
        return new SettlementView(item.id(), item.routeLoadId(), item.loadNumber(), item.routeId(), item.routeCode(),
                item.routeName(), item.sellerName(), item.loadStatus(), item.status(), item.salesTotal(),
                item.expectedCash(), item.deliveredCash(), item.verifiedTransfers(), item.appliedCredit(),
                item.monetaryDifference(), item.physicalDifferenceTotal(), item.blockingReasons(), item.calculatedAt(),
                item.closedBy(), item.closedByUsername(), item.closedAt(), item.closeNotes(), details, cash);
    }

    private String settlementSelect() {
        return """
                SELECT s.*,rl.load_number,rl.status load_status,r.code route_code,r.name route_name,
                  COALESCE(seller.display_name,receiver.username) seller_name,closer.username closed_by_username
                FROM settlement s JOIN route_load rl ON rl.id=s.route_load_id JOIN route r ON r.id=s.route_id
                LEFT JOIN app_user receiver ON receiver.id=rl.seller_received_by LEFT JOIN seller ON seller.user_id=receiver.id
                LEFT JOIN app_user closer ON closer.id=s.closed_by WHERE 1=1
                """;
    }

    private SettlementView settlementRow(ResultSet rs) throws SQLException {
        String rawBlockers = rs.getString("blocking_reasons");
        List<String> blockers = rawBlockers == null || rawBlockers.isBlank() ? List.of() : Arrays.asList(rawBlockers.split("\\n"));
        return new SettlementView(rs.getObject("id", UUID.class), rs.getObject("route_load_id", UUID.class),
                rs.getLong("load_number"), rs.getObject("route_id", UUID.class), rs.getString("route_code"),
                rs.getString("route_name"), rs.getString("seller_name"), rs.getString("load_status"),
                rs.getString("status"), rs.getBigDecimal("sales_total"), rs.getBigDecimal("expected_cash"),
                rs.getBigDecimal("delivered_cash"), rs.getBigDecimal("verified_transfers"),
                rs.getBigDecimal("applied_credit"), rs.getBigDecimal("monetary_difference"),
                rs.getBigDecimal("physical_difference_total"), blockers,
                rs.getTimestamp("calculated_at").toInstant(), rs.getObject("closed_by", UUID.class),
                rs.getString("closed_by_username"), rs.getTimestamp("closed_at") == null ? null : rs.getTimestamp("closed_at").toInstant(),
                rs.getString("close_notes"), List.of(), List.of());
    }

    private String cashSelect() {
        return """
                SELECT cd.*,delivered.username delivered_username,received.username received_username
                FROM cash_delivery cd JOIN app_user delivered ON delivered.id=cd.delivered_by
                JOIN app_user received ON received.id=cd.received_by
                """;
    }

    private CashDeliveryView cashRow(ResultSet rs) throws SQLException {
        return new CashDeliveryView(rs.getObject("id", UUID.class), rs.getBigDecimal("amount"),
                rs.getString("delivered_username"), rs.getString("received_username"), rs.getString("notes"),
                rs.getTimestamp("delivered_at").toInstant());
    }

    private BusinessException notFound() {
        return new BusinessException("SETTLEMENT_LOAD_NOT_FOUND", "No se encontró la carga o liquidación.",
                ErrorCategory.NOT_FOUND);
    }
}
