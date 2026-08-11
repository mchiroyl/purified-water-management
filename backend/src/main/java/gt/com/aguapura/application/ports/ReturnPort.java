package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReturnPort {
    boolean sellerAssignedToRoute(UUID userId, UUID routeId);
    Optional<RouteContext> findRouteContext(UUID routeId);
    boolean customerBelongsToRoute(UUID customerId, UUID routeId);
    boolean saleBelongsToCustomerAndRoute(UUID saleId, UUID customerId, UUID routeId);
    boolean activeWarehouseExists(UUID locationId);
    Optional<PresentationView> findPresentation(UUID presentationId);
    ReturnView create(NewReturn item);
    ReturnView findForReceipt(UUID id);
    ReturnView confirmReceipt(NewReceipt item);
    List<ReturnView> findReturns(Optional<UUID> sellerUserId);

    record RouteContext(UUID routeId, String routeCode, String routeName, UUID routeLocationId,
                        UUID sellerId, String sellerName) {
    }
    record PresentationView(UUID presentationId, String presentationCode, String presentationName,
                            UUID productId, String productCode, String productName,
                            BigDecimal conversionFactor) {
    }
    record NewReturn(UUID id, UUID clientReference, String returnType, RouteContext route,
                     UUID customerId, UUID saleId, UUID reportedBy, UUID deviceId,
                     String reason, Instant reportedAtLocal, List<NewItem> items) {
    }
    record NewItem(UUID id, PresentationView presentation, BigDecimal presentationQuantity,
                   BigDecimal reportedBaseUnits) {
    }
    record NewReceipt(UUID returnId, UUID warehouseLocationId, UUID receivedBy, UUID deviceId,
                      String status, String notes, List<ItemReceipt> items) {
    }
    record ItemReceipt(UUID itemId, BigDecimal receivedBaseUnits) {
    }
    record ReturnView(UUID id, UUID clientReference, String returnType, UUID routeId,
                      String routeCode, String routeName, UUID routeLocationId, UUID customerId,
                      String customerCode, String customerName, UUID saleId, String saleDocumentNumber,
                      UUID sellerId, String sellerName, UUID reportedBy, String reportedByUsername,
                      UUID deviceId, String status, String reason, Instant reportedAtLocal,
                      Instant receivedAtServer, UUID warehouseLocationId, String warehouseLocationName,
                      UUID receivedBy, String receivedByUsername, UUID receivedDeviceId,
                      Instant receivedAt, String receiptNotes, List<ReturnItemView> items) {
    }
    record ReturnItemView(UUID id, UUID returnId, UUID presentationId, String presentationCode,
                          String presentationName, UUID productId, String productCode, String productName,
                          BigDecimal presentationQuantity, BigDecimal reportedBaseUnits,
                          BigDecimal receivedBaseUnits) {
    }
}
