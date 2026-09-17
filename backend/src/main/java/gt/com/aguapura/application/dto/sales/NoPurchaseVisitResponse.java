package gt.com.aguapura.application.dto.sales;

import java.time.Instant;
import java.util.UUID;

public record NoPurchaseVisitResponse(
        UUID id,
        UUID routeId,
        String routeName,
        UUID customerId,
        String customerName,
        String visitReason,
        String visitNote,
        Instant capturedAt,
        Instant persistedAt
) {}
