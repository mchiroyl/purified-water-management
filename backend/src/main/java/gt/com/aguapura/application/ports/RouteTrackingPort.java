package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RouteTrackingPort {
    void recordStart(UUID routeLoadId, UUID routeId, GeoLocation point, UUID actorId, UUID deviceId);

    void recordSale(UUID routeLoadId, UUID routeId, UUID saleId, GeoLocation point, UUID actorId, UUID deviceId);

    void recordNoPurchaseVisit(UUID routeLoadId, UUID routeId, UUID customerId, String visitNote,
                               GeoLocation point, UUID actorId, UUID deviceId);

    Optional<SaleLocationView> findSaleLocation(UUID saleId);

    List<RouteMapPoint> findRouteMap(UUID loadId);

    List<RouteHistoryDay> findRouteHistory(UUID routeId, Instant from, Instant to);

    record RouteMapPoint(String pointType, BigDecimal latitude, BigDecimal longitude,
                         BigDecimal accuracyMeters, Instant capturedAt, String documentNumber,
                         BigDecimal saleTotal, String customerName, String visitNote) {}

    record RouteHistoryDay(UUID loadId, java.time.LocalDate date, String sellerName,
                           Instant startTime, Instant endTime, long durationMinutes,
                           int pointCount, BigDecimal estimatedDistanceKm,
                           BigDecimal firstLat, BigDecimal firstLon,
                           BigDecimal lastLat, BigDecimal lastLon) {}

    record GeoLocation(BigDecimal latitude, BigDecimal longitude, BigDecimal accuracyMeters, Instant capturedAt) {
    }

    record SaleLocationView(BigDecimal latitude, BigDecimal longitude, BigDecimal accuracyMeters,
                            Instant capturedAt, Instant persistedAt) {
    }
}
