package gt.com.aguapura.application.dto.waste;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record WasteResponse(
        UUID id, UUID clientReference, UUID routeId, String routeCode, String routeName,
        UUID inventoryLocationId, UUID sellerId, String sellerName, UUID reportedBy,
        String reportedByUsername, UUID deviceId, String status, String requiredRole,
        String reason, Instant occurredAtLocal, Instant receivedAtServer,
        BigDecimal reportedBaseUnits, BigDecimal approvedBaseUnits,
        BigDecimal pendingDifferenceBaseUnits, List<Item> items,
        List<Evidence> evidence, List<Review> reviews) {

    public record Item(UUID id, UUID wasteTypeId, String wasteTypeCode, String wasteTypeName,
                       String evidencePolicy, UUID presentationId, String presentationCode,
                       String presentationName, UUID productId, String productCode, String productName,
                       BigDecimal presentationQuantity, BigDecimal reportedBaseUnits,
                       BigDecimal recoverableBaseUnits, BigDecimal approvedBaseUnits) {
    }

    public record Evidence(UUID id, String storageReference, String mediaType, String sha256,
                           UUID capturedDeviceId, Instant capturedAtLocal) {
    }

    public record Review(UUID id, UUID reviewerId, String reviewerUsername, String reviewerRole,
                         String decision, BigDecimal approvedBaseUnits, String notes,
                         Instant reviewedAt) {
    }
}
