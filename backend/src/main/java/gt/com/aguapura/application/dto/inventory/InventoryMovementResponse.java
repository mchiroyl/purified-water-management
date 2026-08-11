package gt.com.aguapura.application.dto.inventory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record InventoryMovementResponse(
        UUID id,
        UUID locationId,
        String locationCode,
        String locationName,
        UUID productId,
        String productCode,
        String productName,
        String movementType,
        BigDecimal quantityDelta,
        BigDecimal balanceBefore,
        BigDecimal balanceAfter,
        String reason,
        String referenceType,
        UUID referenceId,
        UUID actorId,
        String actorUsername,
        UUID deviceId,
        Instant createdAt
) {
}
