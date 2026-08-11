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
        if (!LOCATION_TYPES.contains(type)) {
            throw validation("INVALID_INVENTORY_LOCATION_TYPE", "El tipo de ubicación no es válido.");
        }
        if (persistence.locationCodeExists(code)) {
            throw conflict("INVENTORY_LOCATION_CODE_EXISTS", "El código de ubicación ya está registrado.");
        }
        if ("ROUTE".equals(type)) {
            if (request.routeId() == null || !persistence.activeRouteExists(request.routeId())) {
                throw validation("INVENTORY_ROUTE_REQUIRED", "La ubicación de ruta requiere una ruta activa.");
            }
            if (persistence.routeLocationExists(request.routeId())) {
                throw conflict("ROUTE_INVENTORY_LOCATION_EXISTS", "La ruta ya tiene una ubicación de inventario.");
            }
        } else if (request.routeId() != null) {
            throw validation("WAREHOUSE_ROUTE_NOT_ALLOWED", "Una bodega no puede vincularse a una ruta.");
        }
        return location(persistence.createLocation(new InventoryPort.NewLocation(
                code, request.name().trim(), type, request.routeId())));
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
