package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.inventory.CreateInventoryLocationRequest;
import gt.com.aguapura.application.dto.inventory.InventoryAdjustmentRequest;
import gt.com.aguapura.application.dto.inventory.InventoryLocationResponse;
import gt.com.aguapura.application.dto.inventory.InventoryMovementResponse;
import gt.com.aguapura.application.ports.InventoryPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import gt.com.aguapura.domain.inventory.InventoryStockPolicy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.math.BigDecimal;

@Service
public class InventoryApplicationService {
    private static final Set<String> LOCATION_TYPES = Set.of("WAREHOUSE", "ROUTE");

    private final InventoryPort persistence;

    public InventoryApplicationService(InventoryPort persistence) {
        this.persistence = persistence;
    }

    @Transactional
    public InventoryLocationResponse createLocation(CreateInventoryLocationRequest request) {
        String code = request.code().trim().toUpperCase(Locale.ROOT);
        String type = request.locationType().trim().toUpperCase(Locale.ROOT);
        if (!"WAREHOUSE".equals(type)) {
            throw validation("INVALID_INVENTORY_LOCATION_TYPE",
                    "El inventario se gestiona desde la bodega. Las rutas se asignan por cargas diarias y no se registran como ubicaciones de stock.");
        }
        if (request.routeId() != null) {
            throw validation("WAREHOUSE_ROUTE_NOT_ALLOWED", "La bodega no puede vincularse a una ruta. Use el módulo de rutas y cargas diarias.");
        }
        if (persistence.locationCodeExists(code)) {
            throw conflict("INVENTORY_LOCATION_CODE_EXISTS", "El código de ubicación ya está registrado.");
        }
        return location(persistence.createLocation(new InventoryPort.NewLocation(
                code, request.name().trim(), type, null)));
    }

    @Transactional(readOnly = true)
    public List<InventoryLocationResponse> findLocations(UUID userId, boolean restrictedToSeller) {
        Optional<UUID> seller = restrictedToSeller ? Optional.of(userId) : Optional.empty();
        return persistence.findLocations(seller).stream().map(this::location).toList();
    }

    @Transactional
    public InventoryMovementResponse adjust(InventoryAdjustmentRequest request, UUID actorId, UUID deviceId) {
        if (!persistence.activeProductExists(request.productId())) {
            throw validation("INVENTORY_PRODUCT_NOT_FOUND", "No se encontró el producto activo.");
        }
        var current = persistence.lockBalance(request.locationId(), request.productId());
        var balanceAfter = InventoryStockPolicy.balanceAfter(current.quantityBaseUnits(), request.quantityDelta());
        String type = request.quantityDelta().signum() > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT";
        var movement = new InventoryPort.NewMovement(UUID.randomUUID(), request.locationId(), request.productId(),
                type, request.quantityDelta(), current.quantityBaseUnits(), balanceAfter, request.reason().trim(),
                "MANUAL_ADJUSTMENT", null, actorId, deviceId);
        return movement(persistence.storeMovement(movement, current.version()));
    }

    @Transactional
    public void transfer(UUID sourceLocationId, UUID targetLocationId, UUID productId, BigDecimal quantity,
                         String outgoingType, String incomingType, String reason, String referenceType,
                         UUID referenceId, UUID actorId, UUID deviceId) {
        if (sourceLocationId.equals(targetLocationId)) {
            throw validation("INVENTORY_SAME_LOCATION", "El origen y el destino deben ser distintos.");
        }
        if (quantity == null || quantity.signum() <= 0) {
            throw validation("INVENTORY_TRANSFER_QUANTITY", "La cantidad transferida debe ser mayor que cero.");
        }
        InventoryPort.BalanceView first;
        InventoryPort.BalanceView second;
        if (sourceLocationId.toString().compareTo(targetLocationId.toString()) < 0) {
            first = persistence.lockBalance(sourceLocationId, productId);
            second = persistence.lockBalance(targetLocationId, productId);
        } else {
            first = persistence.lockBalance(targetLocationId, productId);
            second = persistence.lockBalance(sourceLocationId, productId);
        }
        var source = first.locationId().equals(sourceLocationId) ? first : second;
        var target = first.locationId().equals(targetLocationId) ? first : second;
        var sourceAfter = InventoryStockPolicy.balanceAfter(source.quantityBaseUnits(), quantity.negate());
        var targetAfter = InventoryStockPolicy.balanceAfter(target.quantityBaseUnits(), quantity);
        persistence.storeMovement(new InventoryPort.NewMovement(UUID.randomUUID(), sourceLocationId, productId,
                outgoingType, quantity.negate(), source.quantityBaseUnits(), sourceAfter, reason, referenceType,
                referenceId, actorId, deviceId), source.version());
        persistence.storeMovement(new InventoryPort.NewMovement(UUID.randomUUID(), targetLocationId, productId,
                incomingType, quantity, target.quantityBaseUnits(), targetAfter, reason, referenceType,
                referenceId, actorId, deviceId), target.version());
    }

    @Transactional
    public void consume(UUID locationId, UUID productId, BigDecimal quantity, String movementType,
                        String reason, String referenceType, UUID referenceId, UUID actorId, UUID deviceId) {
        if (quantity == null || quantity.signum() <= 0) {
            throw validation("INVENTORY_CONSUMPTION_QUANTITY", "La cantidad descontada debe ser mayor que cero.");
        }
        var current = persistence.lockBalance(locationId, productId);
        var balanceAfter = InventoryStockPolicy.balanceAfter(current.quantityBaseUnits(), quantity.negate());
        persistence.storeMovement(new InventoryPort.NewMovement(UUID.randomUUID(), locationId, productId,
                movementType, quantity.negate(), current.quantityBaseUnits(), balanceAfter, reason, referenceType,
                referenceId, actorId, deviceId), current.version());
    }

    @Transactional
    public void receive(UUID locationId, UUID productId, BigDecimal quantity, String movementType,
                        String reason, String referenceType, UUID referenceId, UUID actorId, UUID deviceId) {
        if (quantity == null || quantity.signum() <= 0) {
            throw validation("INVENTORY_RECEIPT_QUANTITY", "La cantidad recibida debe ser mayor que cero.");
        }
        var current = persistence.lockBalance(locationId, productId);
        var balanceAfter = InventoryStockPolicy.balanceAfter(current.quantityBaseUnits(), quantity);
        persistence.storeMovement(new InventoryPort.NewMovement(UUID.randomUUID(), locationId, productId,
                movementType, quantity, current.quantityBaseUnits(), balanceAfter, reason, referenceType,
                referenceId, actorId, deviceId), current.version());
    }

    @Transactional(readOnly = true)
    public List<InventoryMovementResponse> findMovements(UUID locationId, UUID userId, boolean restrictedToSeller) {
        Optional<UUID> seller = restrictedToSeller ? Optional.of(userId) : Optional.empty();
        return persistence.findMovements(locationId, seller).stream().map(this::movement).toList();
    }

    private InventoryLocationResponse location(InventoryPort.LocationView item) {
        var balances = item.balances().stream().map(balance -> new InventoryLocationResponse.BalanceResponse(
                balance.productId(), balance.productCode(), balance.productName(), balance.baseUnitCode(),
                balance.quantityBaseUnits(), balance.version(), balance.updatedAt())).toList();
        return new InventoryLocationResponse(item.id(), item.code(), item.name(), item.locationType(), item.routeId(),
                item.routeCode(), item.routeName(), item.active(), item.createdAt(), balances);
    }

    private InventoryMovementResponse movement(InventoryPort.MovementView item) {
        return new InventoryMovementResponse(item.id(), item.locationId(), item.locationCode(), item.locationName(),
                item.productId(), item.productCode(), item.productName(), item.movementType(), item.quantityDelta(),
                item.balanceBefore(), item.balanceAfter(), item.reason(), item.referenceType(), item.referenceId(),
                item.actorId(), item.actorUsername(), item.deviceId(), item.createdAt());
    }

    private BusinessException validation(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.VALIDATION);
    }

    private BusinessException conflict(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.CONFLICT);
    }
}
