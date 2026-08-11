package gt.com.aguapura.application.dto.inventory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record InventoryLocationResponse(
        UUID id,
        String code,
        String name,
        String locationType,
        UUID routeId,
        String routeCode,
        String routeName,
        boolean active,
        Instant createdAt,
        List<BalanceResponse> balances
) {
    public record BalanceResponse(
            UUID productId,
            String productCode,
            String productName,
            String baseUnitCode,
            BigDecimal quantityBaseUnits,
            long version,
            Instant updatedAt
    ) {
    }
}
