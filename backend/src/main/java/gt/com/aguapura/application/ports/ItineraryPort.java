package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ItineraryPort {

    // ── Ubicación confirmada de cliente ──────────────────────────────────────────
    void saveCustomerConfirmedLocation(ConfirmedLocationView location);

    Optional<ConfirmedLocationView> findCustomerConfirmedLocation(UUID customerId);

    List<CustomerHistoricalPointView> findCustomerHistoricalPoints(UUID customerId);

    // ── Plantilla maestra de ruta ────────────────────────────────────────────────
    RoutePlanTemplateView createTemplate(NewTemplate template, List<NewTemplateStop> stops);

    RoutePlanTemplateView updateTemplate(UUID templateId, NewTemplate template, List<NewTemplateStop> stops);

    List<RoutePlanTemplateView> findTemplatesByRouteId(UUID routeId);

    Optional<RoutePlanTemplateView> findTemplateById(UUID templateId);

    // ── Itinerario de jornada ────────────────────────────────────────────────────
    DailyItineraryRunView publishDailyItinerary(NewItineraryRun run, List<NewItineraryStop> stops);

    Optional<DailyItineraryRunView> findActiveItineraryByRouteId(UUID routeId);

    Optional<DailyItineraryRunView> findActiveItineraryBySellerId(UUID sellerId);

    Optional<DailyItineraryRunView> findItineraryById(UUID itineraryId);

    Optional<DailyItineraryRunView> findItineraryByRouteLoadId(UUID routeLoadId);

    DailyItineraryRunView updatePublishedDailyItinerary(UUID runId, NewItineraryRun run, List<NewItineraryStop> stops);

    void recordStopSale(UUID itineraryRunId, UUID customerId, UUID saleId,
                        BigDecimal obsLat, BigDecimal obsLon, BigDecimal obsAcc,
                        BigDecimal distDev, boolean mismatch);

    void recordStopNoPurchaseVisit(UUID itineraryRunId, UUID customerId, String reason, String notes,
                                   BigDecimal obsLat, BigDecimal obsLon, BigDecimal obsAcc);

    void recordStopPostponed(UUID stopId, String reason, String notes,
                            BigDecimal obsLat, BigDecimal obsLon, BigDecimal obsAcc,
                            String evidencePhoto);

    void closeItineraryIncomplete(UUID itineraryId, String reason, UUID closedBy);

    void closeItineraryOnSettlement(UUID routeLoadId);

    List<SalesOrderedCustomerView> findRouteCustomersOrderedBySales(UUID routeId);

    // ── Records & Views ──────────────────────────────────────────────────────────
    record SalesOrderedCustomerView(
            UUID customerId, String customerCode, String customerName,
            String addressReference, BigDecimal targetLatitude, BigDecimal targetLongitude,
            BigDecimal accuracyMeters, Instant firstSaleAt, long salesCount
    ) {}

    record ConfirmedLocationView(
            UUID id, UUID customerId, BigDecimal latitude, BigDecimal longitude,
            BigDecimal accuracyMeters, String sourceType, UUID sourceReferenceId,
            UUID confirmedBy, Instant confirmedAt, String notes, String status
    ) {}

    record CustomerHistoricalPointView(
            UUID id, String pointType, BigDecimal latitude, BigDecimal longitude,
            BigDecimal accuracyMeters, Instant capturedAt, String referenceText
    ) {}

    record NewTemplate(UUID routeId, String name, String description,
                       BigDecimal startLatitude, BigDecimal startLongitude,
                       String startAddressReference, UUID createdBy) {}

    record NewTemplateStop(UUID customerId, int stopOrder, String instructions) {}

    record RoutePlanTemplateView(
            UUID id, UUID routeId, String routeCode, String routeName,
            String name, String description,
            BigDecimal startLatitude, BigDecimal startLongitude,
            String startAddressReference, int version, String status,
            Instant createdAt, List<RoutePlanTemplateStopView> stops
    ) {}

    record RoutePlanTemplateStopView(
            UUID id, UUID customerId, String customerCode, String customerName,
            String addressReference, BigDecimal targetLatitude, BigDecimal targetLongitude,
            int stopOrder, String instructions
    ) {}

    record NewItineraryRun(
            UUID routeId, UUID routeLoadId, UUID templateId, LocalDate operationalDate,
            UUID sellerId, UUID vehicleId, BigDecimal startLatitude, BigDecimal startLongitude,
            String startAddressReference, String publishedPolyline, UUID publishedBy
    ) {}

    record NewItineraryStop(
            UUID customerId, int plannedOrder, String customerNameSnapshot,
            String addressReferenceSnapshot, BigDecimal targetLatitude, BigDecimal targetLongitude,
            BigDecimal accuracyMeters
    ) {}

    record DailyItineraryRunView(
            UUID id, UUID routeId, String routeCode, String routeName,
            UUID routeLoadId, Long loadNumber, UUID templateId, LocalDate operationalDate,
            UUID sellerId, String sellerName, UUID vehicleId, String licensePlate,
            BigDecimal startLatitude, BigDecimal startLongitude, String startAddressReference,
            String publishedPolyline, String status, int totalPlannedStops,
            int attendedStops, int postponedStops, Instant publishedAt,
            Instant closedAt, String closureReason, List<DailyItineraryStopView> stops
    ) {}

    record DailyItineraryStopView(
            UUID id, UUID itineraryRunId, UUID customerId, int plannedOrder,
            String customerNameSnapshot, String addressReferenceSnapshot,
            BigDecimal targetLatitude, BigDecimal targetLongitude, BigDecimal accuracyMeters,
            String status, Integer executionOrder, Instant completedAt, UUID saleId,
            String noPurchaseReason, String postponedReason, String notes,
            BigDecimal observedLatitude, BigDecimal observedLongitude,
            BigDecimal distanceDeviationMeters, boolean hasLocationMismatch,
            String evidencePhoto, Instant evidencePhotoCapturedAt
    ) {}
}
