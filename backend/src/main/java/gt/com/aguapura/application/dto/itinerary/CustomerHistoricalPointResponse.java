package gt.com.aguapura.application.dto.itinerary;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CustomerHistoricalPointResponse(
        UUID id,
        String pointType,
        BigDecimal latitude,
        BigDecimal longitude,
        BigDecimal accuracyMeters,
        Instant capturedAt,
        String referenceText
) {}
