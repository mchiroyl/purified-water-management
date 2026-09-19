package gt.com.aguapura.application.dto.jugs;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record JugEventResponse(
        UUID id,
        UUID customerId,
        String customerName,
        UUID routeId,
        String routeName,
        UUID routeLoadId,
        UUID saleId,
        String eventType,
        int quantity,
        BigDecimal unitPrice,
        String notes,
        UUID registeredBy,
        String registeredByName,
        UUID deviceId,
        Instant createdAt
) {
}
