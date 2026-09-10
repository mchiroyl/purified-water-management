package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.RouteTrackingPort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public class JdbcRouteTrackingAdapter implements RouteTrackingPort {
    private final JdbcClient jdbc;

    public JdbcRouteTrackingAdapter(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void recordStart(UUID routeLoadId, UUID routeId, GeoLocation point, UUID actorId, UUID deviceId) {
        insert(routeLoadId, routeId, null, "START", point, actorId, deviceId);
    }

    @Override
    public void recordSale(UUID routeLoadId, UUID routeId, UUID saleId, GeoLocation point, UUID actorId, UUID deviceId) {
        insert(routeLoadId, routeId, saleId, "SALE", point, actorId, deviceId);
    }

    @Override
    public Optional<RouteTrackingPort.SaleLocationView> findSaleLocation(UUID saleId) {
        return jdbc.sql("""
                SELECT latitude, longitude, accuracy_meters, captured_at, persisted_at
                FROM route_tracking_point
                WHERE sale_id = :saleId AND point_type = 'SALE'
                """)
                .param("saleId", saleId)
                .query((rs, row) -> new RouteTrackingPort.SaleLocationView(
                        rs.getBigDecimal("latitude"),
                        rs.getBigDecimal("longitude"),
                        rs.getBigDecimal("accuracy_meters"),
                        rs.getTimestamp("captured_at").toInstant(),
                        rs.getTimestamp("persisted_at").toInstant()))
                .optional();
    }

    @Override
    public java.util.List<RouteTrackingPort.RouteMapPoint> findRouteMap(UUID loadId) {
        return jdbc.sql("""
                SELECT p.point_type, p.latitude, p.longitude, p.accuracy_meters, p.captured_at,
                       s.document_number, s.total
                FROM route_tracking_point p
                LEFT JOIN sale s ON p.sale_id = s.id
                WHERE p.route_load_id = :loadId
                ORDER BY p.captured_at ASC
                """)
                .param("loadId", loadId)
                .query((rs, row) -> new RouteTrackingPort.RouteMapPoint(
                        rs.getString("point_type"),
                        rs.getBigDecimal("latitude"),
                        rs.getBigDecimal("longitude"),
                        rs.getBigDecimal("accuracy_meters"),
                        rs.getTimestamp("captured_at").toInstant(),
                        rs.getString("document_number"),
                        rs.getBigDecimal("total")))
                .list();
    }

    @Override
    public java.util.List<RouteTrackingPort.RouteHistoryDay> findRouteHistory(UUID routeId, java.time.Instant from, java.time.Instant to) {
        return jdbc.sql("""
                WITH config AS (
                    SELECT timezone FROM company_configuration LIMIT 1
                ),
                points AS (
                    SELECT p.route_load_id, p.latitude, p.longitude, p.captured_at,
                           LAG(p.latitude) OVER (PARTITION BY p.route_load_id ORDER BY p.captured_at) as prev_lat,
                           LAG(p.longitude) OVER (PARTITION BY p.route_load_id ORDER BY p.captured_at) as prev_lon,
                           FIRST_VALUE(p.latitude) OVER (PARTITION BY p.route_load_id ORDER BY p.captured_at) as first_lat,
                           FIRST_VALUE(p.longitude) OVER (PARTITION BY p.route_load_id ORDER BY p.captured_at) as first_lon,
                           FIRST_VALUE(p.latitude) OVER (PARTITION BY p.route_load_id ORDER BY p.captured_at DESC) as last_lat,
                           FIRST_VALUE(p.longitude) OVER (PARTITION BY p.route_load_id ORDER BY p.captured_at DESC) as last_lon
                    FROM route_tracking_point p
                    JOIN route_load rl ON p.route_load_id = rl.id
                    WHERE rl.route_id = :routeId AND rl.status = 'SETTLED'
                      AND rl.created_at >= :from AND rl.created_at < :to
                ),
                distances AS (
                    SELECT route_load_id, captured_at, first_lat, first_lon, last_lat, last_lon,
                           CASE
                             WHEN prev_lat IS NULL THEN 0
                             WHEN latitude = prev_lat AND longitude = prev_lon THEN 0
                             ELSE 6371 * acos(least(1.0::numeric, cos(radians(prev_lat)) * cos(radians(latitude)) * cos(radians(longitude) - radians(prev_lon)) + sin(radians(prev_lat)) * sin(radians(latitude))))
                           END as dist_km
                    FROM points
                ),
                aggregated AS (
                    SELECT d.route_load_id,
                           COUNT(*) as point_count,
                           SUM(d.dist_km) as estimated_distance_km,
                           MIN(d.captured_at) as start_time,
                           MAX(d.captured_at) as end_time,
                           MAX(d.first_lat) as first_lat,
                           MAX(d.first_lon) as first_lon,
                           MAX(d.last_lat) as last_lat,
                           MAX(d.last_lon) as last_lon
                    FROM distances d
                    GROUP BY d.route_load_id
                )
                SELECT a.route_load_id as load_id,
                       (rl.created_at AT TIME ZONE (SELECT timezone FROM config))::date as load_date,
                       u.name as seller_name, a.start_time, a.end_time,
                       EXTRACT(EPOCH FROM (a.end_time - a.start_time))/60 as duration_minutes,
                       a.point_count, a.estimated_distance_km,
                       a.first_lat, a.first_lon, a.last_lat, a.last_lon
                FROM aggregated a
                JOIN route_load rl ON a.route_load_id = rl.id
                JOIN app_user u ON rl.seller_id = u.id
                ORDER BY load_date ASC, a.start_time ASC
                """)
                .param("routeId", routeId)
                .param("from", java.sql.Timestamp.from(from))
                .param("to", java.sql.Timestamp.from(to))
                .query((rs, row) -> new RouteTrackingPort.RouteHistoryDay(
                        rs.getObject("load_id", UUID.class),
                        rs.getDate("load_date").toLocalDate(),
                        rs.getString("seller_name"),
                        rs.getTimestamp("start_time").toInstant(),
                        rs.getTimestamp("end_time").toInstant(),
                        rs.getLong("duration_minutes"),
                        rs.getInt("point_count"),
                        rs.getBigDecimal("estimated_distance_km"),
                        rs.getBigDecimal("first_lat"),
                        rs.getBigDecimal("first_lon"),
                        rs.getBigDecimal("last_lat"),
                        rs.getBigDecimal("last_lon")))
                .list();
    }

    private void insert(UUID routeLoadId, UUID routeId, UUID saleId, String pointType,
                        GeoLocation point, UUID actorId, UUID deviceId) {
        jdbc.sql("""
                INSERT INTO route_tracking_point(route_load_id,route_id,sale_id,point_type,latitude,longitude,
                                                 accuracy_meters,captured_at,actor_id,device_id)
                VALUES (:routeLoadId,:routeId,:saleId,:pointType,:latitude,:longitude,
                        :accuracyMeters,:capturedAt,:actorId,:deviceId)
                """)
                .param("routeLoadId", routeLoadId)
                .param("routeId", routeId)
                .param("saleId", saleId)
                .param("pointType", pointType)
                .param("latitude", point.latitude())
                .param("longitude", point.longitude())
                .param("accuracyMeters", point.accuracyMeters())
                .param("capturedAt", point.capturedAt())
                .param("actorId", actorId)
                .param("deviceId", deviceId)
                .update();
    }
}
