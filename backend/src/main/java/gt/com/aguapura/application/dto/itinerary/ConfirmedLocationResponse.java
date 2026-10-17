package gt.com.aguapura.application.dto.itinerary;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record ConfirmedLocationResponse(
        UUID id,
        UUID customerId,
        BigDecimal latitude,
        BigDecimal longitude,
        BigDecimal accuracyMeters,
        String sourceType,
        UUID sourceReferenceId,
        UUID confirmedBy,
        Instant confirmedAt,
        String notes,
        String status
) {}
