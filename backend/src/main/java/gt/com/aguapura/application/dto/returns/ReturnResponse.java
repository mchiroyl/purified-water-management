package gt.com.aguapura.application.dto.returns;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ReturnResponse(
        UUID id, UUID clientReference, String returnType, UUID routeId, String routeCode,
        String routeName, UUID routeLocationId, UUID customerId, String customerCode,
        String customerName, UUID saleId, String saleDocumentNumber, UUID sellerId,
        String sellerName, UUID reportedBy, String reportedByUsername, UUID deviceId,
        String status, String reason, Instant reportedAtLocal, Instant receivedAtServer,
        UUID warehouseLocationId, String warehouseLocationName, UUID receivedBy,
        String receivedByUsername, UUID receivedDeviceId, Instant receivedAt,
        String receiptNotes, BigDecimal reportedBaseUnits, BigDecimal receivedBaseUnits,
        BigDecimal pendingDifferenceBaseUnits, List<Item> items) {
    public record Item(UUID id, UUID presentationId, String presentationCode, String presentationName,
                       UUID productId, String productCode, String productName,
                       BigDecimal presentationQuantity, BigDecimal reportedBaseUnits,
                       BigDecimal receivedBaseUnits) {
    }
}
