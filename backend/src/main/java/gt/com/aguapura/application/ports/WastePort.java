package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WastePort {
    boolean sellerAssignedToRoute(UUID userId, UUID routeId);
    Optional<RouteContext> findRouteContext(UUID routeId);
    Optional<PresentationView> findPresentation(UUID presentationId);
    Optional<WasteTypeView> findWasteType(UUID id);
    WasteView create(NewWaste waste);
    WasteView findForReview(UUID id);
    WasteView review(NewReview review);
    List<WasteView> findWastes(Optional<UUID> sellerUserId);
    List<WasteTypeView> findWasteTypes(boolean includeInactive);
    WasteTypeView saveWasteType(WasteTypeDefinition definition);
    List<WasteIndicatorView> indicators();

    record RouteContext(UUID routeId, String routeCode, String routeName, UUID inventoryLocationId,
                        UUID sellerId, String sellerName) {
    }

    record PresentationView(UUID presentationId, String presentationCode, String presentationName,
                            UUID productId, String productCode, String productName,
                            BigDecimal conversionFactor) {
    }

    record WasteTypeView(UUID id, String code, String name, String evidencePolicy,
                         BigDecimal warehouseApprovalLimitBaseUnits,
                         BigDecimal supervisorApprovalLimitBaseUnits,
                         int dailyAlertThreshold, boolean active) {
    }

    record WasteTypeDefinition(UUID id, String code, String name, String evidencePolicy,
                               BigDecimal warehouseApprovalLimitBaseUnits,
                               BigDecimal supervisorApprovalLimitBaseUnits,
                               int dailyAlertThreshold, boolean active) {
    }

    record NewWaste(UUID id, UUID clientReference, RouteContext route, UUID reportedBy, UUID deviceId,
                    String reason, Instant occurredAtLocal, List<NewWasteItem> items,
                    List<NewEvidence> evidence) {
    }

    record NewWasteItem(UUID id, WasteTypeView wasteType, PresentationView presentation,
                        BigDecimal presentationQuantity, BigDecimal reportedBaseUnits,
                        BigDecimal recoverableBaseUnits) {
    }

    record NewEvidence(UUID id, String storageReference, String mediaType, String sha256,
                       Instant capturedAtLocal) {
    }

    record NewReview(UUID wasteId, UUID reviewerId, String reviewerRole, String decision,
                     String status, String requiredRole, String notes, BigDecimal approvedBaseUnits,
                     boolean finalDecision, List<ItemApproval> items) {
    }

    record ItemApproval(UUID itemId, BigDecimal approvedBaseUnits) {
    }

    record WasteView(UUID id, UUID clientReference, UUID routeId, String routeCode, String routeName,
                     UUID inventoryLocationId, UUID sellerId, String sellerName, UUID reportedBy,
                     String reportedByUsername, UUID deviceId, String status, String requiredRole,
                     String reason, Instant occurredAtLocal, Instant receivedAtServer,
                     List<WasteItemView> items, List<EvidenceView> evidence, List<ReviewView> reviews) {
    }

    record WasteItemView(UUID id, UUID wasteId, UUID wasteTypeId, String wasteTypeCode,
                         String wasteTypeName, String evidencePolicy, UUID presentationId,
                         String presentationCode, String presentationName, UUID productId,
                         String productCode, String productName, BigDecimal presentationQuantity,
                         BigDecimal reportedBaseUnits, BigDecimal recoverableBaseUnits,
                         BigDecimal approvedBaseUnits, BigDecimal warehouseApprovalLimitBaseUnits,
                         BigDecimal supervisorApprovalLimitBaseUnits) {
    }

    record EvidenceView(UUID id, String storageReference, String mediaType, String sha256,
                        UUID capturedDeviceId, Instant capturedAtLocal) {
    }

    record ReviewView(UUID id, UUID reviewerId, String reviewerUsername, String reviewerRole,
                      String decision, BigDecimal approvedBaseUnits, String notes, Instant reviewedAt) {
    }

    record WasteIndicatorView(UUID sellerId, String sellerName, UUID routeId, String routeName,
                              UUID productId, String productName, long reportCount,
                              BigDecimal reportedBaseUnits, BigDecimal approvedBaseUnits,
                              long openAlerts) {
    }
}
