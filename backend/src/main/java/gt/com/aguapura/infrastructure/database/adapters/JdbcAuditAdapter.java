package gt.com.aguapura.infrastructure.database.adapters;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import gt.com.aguapura.application.dto.reports.ReportPageResponse;
import gt.com.aguapura.application.ports.AuditPort;
import gt.com.aguapura.domain.audit.AuditDataSanitizer;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Repository
public class JdbcAuditAdapter implements AuditPort {
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() { };
    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public JdbcAuditAdapter(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    @Override
    public void append(Event event) {
        jdbc.sql("""
                INSERT INTO audit_log(user_id,device_id,action,entity_type,entity_id,before_data,after_data,
                                      correlation_id,ip_address)
                VALUES (:user,:device,:action,:entityType,:entityId,CAST(NULLIF(:beforeData,'') AS jsonb),
                        CAST(NULLIF(:afterData,'') AS jsonb),:correlation,:ip)
                """).param("user", event.userId()).param("device", event.deviceId())
                .param("action", event.action()).param("entityType", event.entityType())
                .param("entityId", event.entityId()).param("beforeData", write(event.beforeData()))
                .param("afterData", write(event.afterData())).param("correlation", event.correlationId())
                .param("ip", event.ipAddress()).update();
    }

    @Override
    public ReportPageResponse<Row> search(Query query) {
        var sql = new StringBuilder("""
                FROM audit_log a LEFT JOIN app_user u ON u.id=a.user_id LEFT JOIN device d ON d.id=a.device_id
                WHERE a.occurred_at>=:start AND a.occurred_at<:end
                """);
        var params = new LinkedHashMap<String, Object>();
        params.put("start", query.startInclusive().atOffset(ZoneOffset.UTC));
        params.put("end", query.endExclusive().atOffset(ZoneOffset.UTC));
        filter(sql, params, query.action(), "action", "a.action");
        filter(sql, params, query.entityType(), "entityType", "a.entity_type");
        filter(sql, params, query.user(), "user", "concat(u.username,' ',COALESCE(u.email,''))");
        if (query.correlationId() != null) {
            sql.append(" AND a.correlation_id=:correlation ");
            params.put("correlation", query.correlationId());
        }
        long total = bind(jdbc.sql("SELECT count(*) " + sql), params).query(Long.class).single();
        var rows = bind(jdbc.sql("""
                SELECT a.*,COALESCE(u.username,'Sistema') username,COALESCE(d.friendly_name,'') device_name
                """ + sql + " ORDER BY a.occurred_at DESC,a.id LIMIT :limit OFFSET :offset"), params)
                .param("limit", query.size()).param("offset", query.page() * query.size())
                .query((rs, row) -> row(rs)).list();
        return new ReportPageResponse<>(rows, total, query.page(), query.size(),
                (long) (query.page() + 1) * query.size() < total);
    }

    private void filter(StringBuilder sql, Map<String, Object> params, String value, String name, String column) {
        if (value == null || value.isBlank()) return;
        sql.append(" AND lower(").append(column).append(") LIKE :").append(name).append(' ');
        params.put(name, "%" + value.toLowerCase() + "%");
    }

    private JdbcClient.StatementSpec bind(JdbcClient.StatementSpec spec, Map<String, Object> params) {
        for (var entry : params.entrySet()) spec = spec.param(entry.getKey(), entry.getValue());
        return spec;
    }

    private Row row(ResultSet rs) throws SQLException {
        return new Row(rs.getObject("id", UUID.class), rs.getObject("user_id", UUID.class),
                rs.getString("username"), rs.getObject("device_id", UUID.class), rs.getString("device_name"),
                rs.getString("action"), rs.getString("entity_type"), rs.getObject("entity_id", UUID.class),
                read(rs.getString("before_data")), read(rs.getString("after_data")),
                rs.getObject("correlation_id", UUID.class), rs.getString("ip_address"),
                rs.getTimestamp("occurred_at").toInstant());
    }

    private String write(Map<String, Object> value) {
        if (value == null || value.isEmpty()) return "";
        try { return json.writeValueAsString(value); }
        catch (Exception exception) { throw new IllegalStateException("No fue posible serializar auditoría segura.", exception); }
    }

    private Map<String, Object> read(String value) {
        if (value == null || value.isBlank()) return Map.of();
        try { return AuditDataSanitizer.sanitize(json.readValue(value, MAP_TYPE)); }
        catch (Exception exception) { return Map.of("unavailable", true); }
    }
}
