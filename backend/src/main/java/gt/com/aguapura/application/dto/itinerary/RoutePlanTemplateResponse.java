package gt.com.aguapura.application.dto.itinerary;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record RoutePlanTemplateResponse(
        UUID id,
        UUID routeId,
        String routeCode,
        String routeName,
        String name,
        String description,
        BigDecimal startLatitude,
        BigDecimal startLongitude,
        String startAddressReference,
        int version,
        String status,
        Instant createdAt,
        List<StopResponse> stops
) {
    public record StopResponse(
            UUID id,
            UUID customerId,
            String customerCode,
            String customerName,
            String addressReference,
            BigDecimal targetLatitude,
            BigDecimal targetLongitude,
            int stopOrder,
            String instructions
    ) {}
}
