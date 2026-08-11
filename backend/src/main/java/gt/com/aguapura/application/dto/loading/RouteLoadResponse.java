package gt.com.aguapura.application.dto.loading;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record RouteLoadResponse(
        UUID id,
        String loadNumber,
        UUID routeId,
        String routeCode,
        String routeName,
        UUID sourceLocationId,
        String sourceLocationCode,
        String sourceLocationName,
        UUID targetLocationId,
        String targetLocationCode,
        String targetLocationName,
        LocalDate plannedDate,
        String notes,
        String status,
        UUID createdBy,
        String createdByUsername,
        Instant createdAt,
        UUID warehouseConfirmedBy,
        String warehouseConfirmedByUsername,
        UUID warehouseConfirmedDeviceId,
        Instant warehouseConfirmedAt,
        UUID sellerReceivedBy,
        String sellerReceivedByUsername,
        UUID sellerReceivedDeviceId,
        Instant sellerReceivedAt,
        UUID startedBy,
        String startedByUsername,
        UUID startedDeviceId,
        Instant startedAt,
        List<ItemResponse> items,
        List<CorrectionResponse> corrections
) {
    public record ItemResponse(UUID id, UUID productId, String productCode, String productName,
                               String baseUnitCode, BigDecimal quantityBaseUnits) {
    }

    public record CorrectionResponse(UUID id, UUID productId, String productCode, String productName,
                                     BigDecimal quantityDelta, String reason, UUID actorId,
                                     String actorUsername, UUID deviceId, Instant createdAt) {
    }
}
