package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public interface RouteTrackingPort {
    void recordStart(UUID routeLoadId, UUID routeId, GeoLocation point, UUID actorId, UUID deviceId);

    void recordSale(UUID routeLoadId, UUID routeId, UUID saleId, GeoLocation point, UUID actorId, UUID deviceId);

    record GeoLocation(BigDecimal latitude, BigDecimal longitude, BigDecimal accuracyMeters, Instant capturedAt) {
    }
}
