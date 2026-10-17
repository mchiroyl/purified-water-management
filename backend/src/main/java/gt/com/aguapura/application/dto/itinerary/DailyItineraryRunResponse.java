package gt.com.aguapura.application.dto.itinerary;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record DailyItineraryRunResponse(
        UUID id,
        UUID routeId,
        String routeCode,
        String routeName,
        UUID routeLoadId,
        Long loadNumber,
        UUID templateId,
        LocalDate operationalDate,
        UUID sellerId,
        String sellerName,
        UUID vehicleId,
        String licensePlate,
        BigDecimal startLatitude,
        BigDecimal startLongitude,
        String startAddressReference,
        String publishedPolyline,
        String status,
        int totalPlannedStops,
        int attendedStops,
        int postponedStops,
        Instant publishedAt,
        Instant closedAt,
        String closureReason,
        List<StopResponse> stops
) {
    @com.fasterxml.jackson.annotation.JsonProperty("totalStops")
    public int totalStops() { return totalPlannedStops; }

    @com.fasterxml.jackson.annotation.JsonProperty("completedStops")
    public int completedStops() { return attendedStops; }

    @com.fasterxml.jackson.annotation.JsonProperty("planDate")
    public LocalDate planDate() { return operationalDate; }

    public record StopResponse(
            UUID id,
            UUID itineraryRunId,
            UUID customerId,
            int plannedOrder,
            String customerNameSnapshot,
            String addressReferenceSnapshot,
            BigDecimal targetLatitude,
            BigDecimal targetLongitude,
            BigDecimal accuracyMeters,
            String status,
            Integer executionOrder,
            Instant completedAt,
            UUID saleId,
            String noPurchaseReason,
            String postponedReason,
            String notes,
            BigDecimal observedLatitude,
            BigDecimal observedLongitude,
            BigDecimal distanceDeviationMeters,
            boolean hasLocationMismatch,
            String evidencePhoto,
            Instant evidencePhotoCapturedAt
    ) {
        @com.fasterxml.jackson.annotation.JsonProperty("stopOrder")
        public int stopOrder() { return plannedOrder; }

        @com.fasterxml.jackson.annotation.JsonProperty("customerName")
        public String customerName() { return customerNameSnapshot; }

        @com.fasterxml.jackson.annotation.JsonProperty("addressReference")
        public String addressReference() { return addressReferenceSnapshot; }
    }
}
