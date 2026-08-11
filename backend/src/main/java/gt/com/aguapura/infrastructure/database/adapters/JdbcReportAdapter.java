package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.dto.reports.ReportPageResponse;
import gt.com.aguapura.application.dto.reports.SalesReportRow;
import gt.com.aguapura.application.dto.reports.SettlementReportRow;
import gt.com.aguapura.application.dto.reports.WasteReportRow;
import gt.com.aguapura.application.ports.ReportPort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Repository
public class JdbcReportAdapter implements ReportPort {
    private final JdbcClient jdbc;

    public JdbcReportAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public ReportPageResponse<SalesReportRow> sales(Query query, UUID actorId, boolean restricted) {
        var sql = new StringBuilder("""
                FROM sale s JOIN route r ON r.id=s.route_id JOIN seller seller ON seller.id=s.seller_id
                JOIN customer c ON c.id=s.customer_id JOIN sale_item si ON si.sale_id=s.id
                JOIN product p ON p.id=si.product_id JOIN product_presentation pp ON pp.id=si.presentation_id
                LEFT JOIN LATERAL (
                  SELECT string_agg(pay.payment_method,',' ORDER BY pay.payment_method) FILTER (WHERE pay.status<>'REJECTED') methods,
                    COALESCE(sum(pay.amount) FILTER (WHERE pay.payment_method='CASH' AND pay.status='CONFIRMED'),0) cash_amount,
                    COALESCE(sum(pay.amount) FILTER (WHERE pay.payment_method='TRANSFER' AND pay.status<>'REJECTED'),0) transfer_amount,
                    COALESCE(sum(pay.amount) FILTER (WHERE pay.payment_method='CREDIT' AND pay.status='APPLIED'),0) credit_amount
                  FROM payment pay WHERE pay.sale_id=s.id
                ) pay ON true
                WHERE s.created_at>=:start AND s.created_at<:end
                  AND (NOT :restricted OR seller.user_id=:actor)
                """);
        var params = base(query, actorId, restricted);
        textFilter(sql, params, query.seller(), "seller", "seller.code", "seller.display_name");
        textFilter(sql, params, query.route(), "route", "r.code", "r.name");
        textFilter(sql, params, query.customer(), "customer", "c.code", "c.name");
        textFilter(sql, params, query.product(), "product", "p.code", "p.name");
        textFilter(sql, params, query.presentation(), "presentation", "pp.code", "pp.name");
        if (!query.paymentMethod().isBlank()) {
            sql.append(" AND EXISTS(SELECT 1 FROM payment fp WHERE fp.sale_id=s.id AND fp.payment_method=:paymentMethod) ");
            params.put("paymentMethod", query.paymentMethod());
        }
        long total = count(sql.toString(), params);
        String select = """
                SELECT s.id sale_id,s.document_number,s.created_at,seller.code seller_code,seller.display_name seller_name,
                  r.code route_code,r.name route_name,c.code customer_code,c.name customer_name,p.code product_code,p.name product_name,
                  pp.code presentation_code,pp.name presentation_name,si.presentation_quantity,si.quantity_base_units,
                  si.unit_price,si.line_total,s.total sale_total,s.currency_code,COALESCE(pay.methods,'') payment_methods,
                  pay.cash_amount,pay.transfer_amount,pay.credit_amount,
                  CASE WHEN EXISTS(SELECT 1 FROM annulment_request ar WHERE ar.sale_id=s.id AND ar.status='APPROVED')
                    THEN 'ANNULLED' ELSE 'CONFIRMED' END sale_status
                """;
        var rows = bind(jdbc.sql(select + sql + " ORDER BY s.created_at DESC,s.document_number,p.name LIMIT :limit OFFSET :offset"), params)
                .param("limit", query.size()).param("offset", query.page() * query.size())
                .query((rs, row) -> salesRow(rs)).list();
        return page(rows, total, query);
    }

    @Override
    public ReportPageResponse<WasteReportRow> wastes(Query query, UUID actorId, boolean restricted) {
        var sql = new StringBuilder("""
                FROM waste w JOIN route r ON r.id=w.route_id JOIN seller seller ON seller.id=w.seller_id
                JOIN waste_item wi ON wi.waste_id=w.id JOIN waste_type wt ON wt.id=wi.waste_type_id
                JOIN product p ON p.id=wi.product_id JOIN product_presentation pp ON pp.id=wi.presentation_id
                WHERE w.received_at_server>=:start AND w.received_at_server<:end
                  AND (NOT :restricted OR seller.user_id=:actor)
                """);
        var params = base(query, actorId, restricted);
        textFilter(sql, params, query.seller(), "seller", "seller.code", "seller.display_name");
        textFilter(sql, params, query.route(), "route", "r.code", "r.name");
        textFilter(sql, params, query.product(), "product", "p.code", "p.name");
        textFilter(sql, params, query.presentation(), "presentation", "pp.code", "pp.name");
        long total = count(sql.toString(), params);
        String select = """
                SELECT w.id waste_id,w.received_at_server,seller.code seller_code,seller.display_name seller_name,
                  r.code route_code,r.name route_name,p.code product_code,p.name product_name,
                  pp.code presentation_code,pp.name presentation_name,wt.name waste_type,wi.reported_base_units,
                  wi.approved_base_units,w.status,w.reason
                """;
        var rows = bind(jdbc.sql(select + sql + " ORDER BY w.received_at_server DESC,w.id,p.name LIMIT :limit OFFSET :offset"), params)
                .param("limit", query.size()).param("offset", query.page() * query.size())
                .query((rs, row) -> wasteRow(rs)).list();
        return page(rows, total, query);
    }

    @Override
    public ReportPageResponse<SettlementReportRow> settlements(Query query, UUID actorId, boolean restricted) {
        var sql = new StringBuilder("""
                FROM settlement st JOIN route r ON r.id=st.route_id JOIN route_load rl ON rl.id=st.route_load_id
                LEFT JOIN app_user receiver ON receiver.id=rl.seller_received_by
                LEFT JOIN seller seller ON seller.user_id=receiver.id
                WHERE st.calculated_at>=:start AND st.calculated_at<:end
                  AND (NOT :restricted OR seller.user_id=:actor)
                """);
        var params = base(query, actorId, restricted);
        textFilter(sql, params, query.seller(), "seller", "seller.code", "seller.display_name");
        textFilter(sql, params, query.route(), "route", "r.code", "r.name");
        if (query.differenceOnly()) sql.append(" AND (st.monetary_difference<>0 OR st.physical_difference_total<>0) ");
        long total = count(sql.toString(), params);
        String select = """
                SELECT st.id settlement_id,st.calculated_at,COALESCE(seller.code,'') seller_code,
                  COALESCE(seller.display_name,receiver.username,'') seller_name,r.code route_code,r.name route_name,
                  rl.load_number,st.sales_total,st.expected_cash,st.delivered_cash,st.verified_transfers,
                  st.applied_credit,st.monetary_difference,st.physical_difference_total,st.status
                """;
        var rows = bind(jdbc.sql(select + sql + " ORDER BY st.calculated_at DESC,rl.load_number DESC LIMIT :limit OFFSET :offset"), params)
                .param("limit", query.size()).param("offset", query.page() * query.size())
                .query((rs, row) -> settlementRow(rs)).list();
        return page(rows, total, query);
    }

    private Map<String, Object> base(Query query, UUID actor, boolean restricted) {
        var params = new LinkedHashMap<String, Object>();
        params.put("start", query.startInclusive().atOffset(ZoneOffset.UTC));
        params.put("end", query.endExclusive().atOffset(ZoneOffset.UTC));
        params.put("restricted", restricted);
        params.put("actor", actor);
        return params;
    }

    private void textFilter(StringBuilder sql, Map<String, Object> params, String value, String parameter,
                            String codeColumn, String nameColumn) {
        if (value == null || value.isBlank()) return;
        sql.append(" AND lower(concat(").append(codeColumn).append(",' ',").append(nameColumn)
                .append(")) LIKE :").append(parameter).append(" ");
        params.put(parameter, "%" + value.toLowerCase() + "%");
    }

    private long count(String from, Map<String, Object> params) {
        return bind(jdbc.sql("SELECT count(*) " + from), params).query(Long.class).single();
    }

    private JdbcClient.StatementSpec bind(JdbcClient.StatementSpec spec, Map<String, Object> params) {
        for (var entry : params.entrySet()) spec = spec.param(entry.getKey(), entry.getValue());
        return spec;
    }

    private <T> ReportPageResponse<T> page(java.util.List<T> rows, long total, Query query) {
        return new ReportPageResponse<>(rows, total, query.page(), query.size(),
                (long) (query.page() + 1) * query.size() < total);
    }

    private SalesReportRow salesRow(ResultSet rs) throws SQLException {
        return new SalesReportRow(rs.getObject("sale_id", UUID.class), rs.getString("document_number"),
                rs.getTimestamp("created_at").toInstant(), rs.getString("seller_code"), rs.getString("seller_name"),
                rs.getString("route_code"), rs.getString("route_name"), rs.getString("customer_code"),
                rs.getString("customer_name"), rs.getString("product_code"), rs.getString("product_name"),
                rs.getString("presentation_code"), rs.getString("presentation_name"),
                rs.getBigDecimal("presentation_quantity"), rs.getBigDecimal("quantity_base_units"),
                rs.getBigDecimal("unit_price"), rs.getBigDecimal("line_total"), rs.getBigDecimal("sale_total"),
                rs.getString("currency_code"), rs.getString("payment_methods"), rs.getBigDecimal("cash_amount"),
                rs.getBigDecimal("transfer_amount"), rs.getBigDecimal("credit_amount"), rs.getString("sale_status"));
    }

    private WasteReportRow wasteRow(ResultSet rs) throws SQLException {
        return new WasteReportRow(rs.getObject("waste_id", UUID.class), rs.getTimestamp("received_at_server").toInstant(),
                rs.getString("seller_code"), rs.getString("seller_name"), rs.getString("route_code"),
                rs.getString("route_name"), rs.getString("product_code"), rs.getString("product_name"),
                rs.getString("presentation_code"), rs.getString("presentation_name"), rs.getString("waste_type"),
                rs.getBigDecimal("reported_base_units"), rs.getBigDecimal("approved_base_units"),
                rs.getString("status"), rs.getString("reason"));
    }

    private SettlementReportRow settlementRow(ResultSet rs) throws SQLException {
        return new SettlementReportRow(rs.getObject("settlement_id", UUID.class), rs.getTimestamp("calculated_at").toInstant(),
                rs.getString("seller_code"), rs.getString("seller_name"), rs.getString("route_code"),
                rs.getString("route_name"), rs.getLong("load_number"), rs.getBigDecimal("sales_total"),
                rs.getBigDecimal("expected_cash"), rs.getBigDecimal("delivered_cash"),
                rs.getBigDecimal("verified_transfers"), rs.getBigDecimal("applied_credit"),
                rs.getBigDecimal("monetary_difference"), rs.getBigDecimal("physical_difference_total"),
                rs.getString("status"));
    }
}
