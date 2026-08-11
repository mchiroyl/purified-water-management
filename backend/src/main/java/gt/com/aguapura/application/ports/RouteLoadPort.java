package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface RouteLoadPort {
    boolean activeRouteExists(UUID routeId);
    boolean activeWarehouseLocationExists(UUID locationId);
    Optional<UUID> findActiveRouteLocation(UUID routeId);
    boolean activeInventoryProductExists(UUID productId);
    boolean sellerAssignedToRoute(UUID userId, UUID routeId);
    LoadView createLoad(NewLoad load);
    List<LoadView> findLoads(Optional<UUID> sellerUserId);
    LoadView findLoad(UUID id);
    LoadView confirmWarehouse(UUID id, UUID actorId, UUID deviceId);
    LoadView confirmReceipt(UUID id, UUID actorId, UUID deviceId);
    LoadView start(UUID id, UUID actorId, UUID deviceId);
    LoadView addCorrection(NewCorrection correction);

    record NewLoad(UUID routeId, UUID sourceLocationId, UUID targetLocationId, LocalDate plannedDate,
                   String notes, UUID createdBy, List<NewItem> items) {
    }

    record NewItem(UUID productId, BigDecimal quantityBaseUnits) {
    }

    record NewCorrection(UUID id, UUID routeLoadId, UUID productId, BigDecimal quantityDelta,
                         String reason, UUID actorId, UUID deviceId) {
    }

    record LoadView(UUID id, long loadNumber, UUID routeId, String routeCode, String routeName,
                    UUID sourceLocationId, String sourceLocationCode, String sourceLocationName,
                    UUID targetLocationId, String targetLocationCode, String targetLocationName,
                    LocalDate plannedDate, String notes, String status, UUID createdBy,
                    String createdByUsername, Instant createdAt, UUID warehouseConfirmedBy,
                    String warehouseConfirmedByUsername, UUID warehouseConfirmedDeviceId,
                    Instant warehouseConfirmedAt, UUID sellerReceivedBy, String sellerReceivedByUsername,
                    UUID sellerReceivedDeviceId, Instant sellerReceivedAt, UUID startedBy,
                    String startedByUsername, UUID startedDeviceId, Instant startedAt,
                    List<ItemView> items, List<CorrectionView> corrections) {
    }

    record ItemView(UUID id, UUID productId, String productCode, String productName,
                    String baseUnitCode, BigDecimal quantityBaseUnits) {
    }

    record CorrectionView(UUID id, UUID productId, String productCode, String productName,
                          BigDecimal quantityDelta, String reason, UUID actorId,
                          String actorUsername, UUID deviceId, Instant createdAt) {
    }
}
