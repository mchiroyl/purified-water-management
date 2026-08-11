package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.DashboardPort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;

@Repository
public class JdbcDashboardAdapter implements DashboardPort {
    private final JdbcClient jdbc;

    public JdbcDashboardAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public Metrics load(Instant start, Instant end, LocalDate operationalDate,
                        UUID actorId, boolean restricted) {
        return jdbc.sql("""
                WITH scoped_routes AS (
                  SELECT r.id FROM route r WHERE NOT :restricted OR EXISTS (
                    SELECT 1 FROM route_assignment ra JOIN seller own ON own.id=ra.seller_id
                    WHERE ra.route_id=r.id AND own.user_id=:actor
                      AND ra.valid_from<=CAST(:localDay AS date)
                      AND (ra.valid_to IS NULL OR ra.valid_to>=CAST(:localDay AS date)))
                ), valid_sales AS (
                  SELECT s.* FROM sale s JOIN scoped_routes sr ON sr.id=s.route_id
                  WHERE s.created_at>=:start AND s.created_at<:end
                    AND NOT EXISTS(SELECT 1 FROM annulment_request ar WHERE ar.sale_id=s.id AND ar.status='APPROVED')
                )
                SELECT
                  COALESCE((SELECT sum(total) FROM valid_sales),0) sales_today,
                  COALESCE((SELECT sum(p.amount) FROM payment p JOIN valid_sales s ON s.id=p.sale_id
                    WHERE p.payment_method='CASH' AND p.status='CONFIRMED'),0) expected_cash,
                  COALESCE((SELECT sum(cd.amount) FROM cash_delivery cd JOIN route_load rl ON rl.id=cd.route_load_id
                    JOIN scoped_routes sr ON sr.id=rl.route_id WHERE cd.delivered_at>=:start AND cd.delivered_at<:end),0) delivered_cash,
                  COALESCE((SELECT sum(p.amount) FROM payment p JOIN valid_sales s ON s.id=p.sale_id
                    WHERE p.payment_method='TRANSFER' AND p.status<>'REJECTED'),0) transfers,
                  COALESCE((SELECT sum(p.amount) FROM payment p JOIN valid_sales s ON s.id=p.sale_id
                    WHERE p.payment_method='CREDIT' AND p.status='APPLIED'),0) credit,
                  COALESCE((SELECT sum(abs(st.monetary_difference)) FROM settlement st JOIN scoped_routes sr ON sr.id=st.route_id
                    WHERE st.calculated_at>=:start AND st.calculated_at<:end),0) monetary_differences,
                  COALESCE((SELECT sum(abs(st.physical_difference_total)) FROM settlement st JOIN scoped_routes sr ON sr.id=st.route_id
                    WHERE st.calculated_at>=:start AND st.calculated_at<:end),0) inventory_differences,
                  COALESCE((SELECT sum(wi.approved_base_units) FROM waste_item wi JOIN waste w ON w.id=wi.waste_id
                    JOIN scoped_routes sr ON sr.id=w.route_id WHERE w.received_at_server>=:start AND w.received_at_server<:end
                    AND w.status IN ('APPROVED','PARTIALLY_APPROVED')),0) approved_waste_units,
                  (SELECT count(*) FROM waste w JOIN scoped_routes sr ON sr.id=w.route_id
                    WHERE w.status IN ('PENDING_REVIEW','PENDING_SECOND_APPROVAL')) pending_wastes,
                  (SELECT count(*) FROM customer c WHERE c.registration_state='PENDING_REVIEW'
                    AND (NOT :restricted OR c.created_by=:actor)) provisional_customers,
                  (SELECT count(*) FROM payment p JOIN sale s ON s.id=p.sale_id JOIN scoped_routes sr ON sr.id=s.route_id
                    WHERE p.payment_method='TRANSFER' AND p.status='PENDING_VERIFICATION') pending_transfers,
                  (SELECT count(*) FROM route_load rl JOIN scoped_routes sr ON sr.id=rl.route_id WHERE rl.status='STARTED') active_routes,
                  (SELECT count(*) FROM settlement st JOIN scoped_routes sr ON sr.id=st.route_id
                    WHERE st.closed_at>=:start AND st.closed_at<:end) completed_routes,
                  (SELECT count(*) FROM sync_operation so WHERE (NOT :restricted OR so.user_id=:actor)
                    AND (so.processing_status<>'COMPLETED' OR so.result_status IN ('CONFLICT','RETRY'))) pending_offline_operations,
                  (SELECT count(*) FROM customer_return cr JOIN scoped_routes sr ON sr.id=cr.route_id
                    WHERE cr.status='PENDING_RECEIPT') pending_returns,
                  (SELECT count(*) FROM authorization_request ar WHERE ar.status='REQUESTED'
                    AND (NOT :restricted OR ar.requested_by=:actor)) pending_authorizations,
                  (SELECT count(*) FROM incident i WHERE i.status IN ('OPEN','INVESTIGATING')
                    AND (i.route_id IS NULL OR EXISTS(SELECT 1 FROM scoped_routes sr WHERE sr.id=i.route_id))) open_incidents
                """).param("restricted", restricted).param("actor", actorId)
                .param("localDay", operationalDate)
                .param("start", start.atOffset(ZoneOffset.UTC)).param("end", end.atOffset(ZoneOffset.UTC))
                .query((rs, row) -> map(rs)).single();
    }

    private Metrics map(ResultSet rs) throws SQLException {
        return new Metrics(rs.getBigDecimal("sales_today"), rs.getBigDecimal("expected_cash"),
                rs.getBigDecimal("delivered_cash"), rs.getBigDecimal("transfers"), rs.getBigDecimal("credit"),
                rs.getBigDecimal("monetary_differences"), rs.getBigDecimal("inventory_differences"),
                rs.getBigDecimal("approved_waste_units"), rs.getLong("pending_wastes"),
                rs.getLong("provisional_customers"), rs.getLong("pending_transfers"),
                rs.getLong("active_routes"), rs.getLong("completed_routes"),
                rs.getLong("pending_offline_operations"), rs.getLong("pending_returns"),
                rs.getLong("pending_authorizations"), rs.getLong("open_incidents"));
    }
}
