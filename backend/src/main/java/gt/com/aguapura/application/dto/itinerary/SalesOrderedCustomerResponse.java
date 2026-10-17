package gt.com.aguapura.application.dto.itinerary;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SalesOrderedCustomerResponse(
        UUID customerId,
        String customerCode,
        String customerName,
        String addressReference,
        BigDecimal targetLatitude,
        BigDecimal targetLongitude,
        BigDecimal accuracyMeters,
        Instant firstSaleAt,
        long salesCount
) {}
