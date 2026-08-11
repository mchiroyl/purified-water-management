package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface InventoryPort {
    boolean locationCodeExists(String code);
    boolean activeRouteExists(UUID routeId);
    boolean routeLocationExists(UUID routeId);
    boolean activeProductExists(UUID productId);
    LocationView createLocation(NewLocation location);
    List<LocationView> findLocations(Optional<UUID> sellerUserId);
    BalanceView lockBalance(UUID locationId, UUID productId);
    MovementView storeMovement(NewMovement movement, long expectedVersion);
    List<MovementView> findMovements(UUID locationId, Optional<UUID> sellerUserId);

    record NewLocation(String code, String name, String locationType, UUID routeId) {
    }

    record LocationView(UUID id, String code, String name, String locationType, UUID routeId,
                        String routeCode, String routeName, boolean active, Instant createdAt,
                        List<BalanceView> balances) {
    }

    record BalanceView(UUID locationId, UUID productId, String productCode, String productName,
                       String baseUnitCode, BigDecimal quantityBaseUnits, long version, Instant updatedAt) {
    }

    record NewMovement(UUID id, UUID locationId, UUID productId, String movementType,
                       BigDecimal quantityDelta, BigDecimal balanceBefore, BigDecimal balanceAfter,
                       String reason, String referenceType, UUID referenceId, UUID actorId, UUID deviceId) {
    }

    record MovementView(UUID id, UUID locationId, String locationCode, String locationName,
                        UUID productId, String productCode, String productName, String movementType,
                        BigDecimal quantityDelta, BigDecimal balanceBefore, BigDecimal balanceAfter,
                        String reason, String referenceType, UUID referenceId, UUID actorId,
                        String actorUsername, UUID deviceId, Instant createdAt) {
    }
}
