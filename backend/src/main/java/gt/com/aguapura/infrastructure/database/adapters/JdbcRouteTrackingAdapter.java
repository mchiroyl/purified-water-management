package gt.com.aguapura.infrastructure.database.adapters;

import gt.com.aguapura.application.ports.RouteTrackingPort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

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
