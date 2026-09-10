package gt.com.aguapura.application.dto.route;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record RouteHistoryResponse(
        UUID loadId,
        java.time.LocalDate date,
        String sellerName,
        Instant startTime,
        Instant endTime,
        long durationMinutes,
        int pointCount,
        BigDecimal estimatedDistanceKm,
        BigDecimal firstLat,
        BigDecimal firstLon,
        BigDecimal lastLat,
        BigDecimal lastLon
) {}
