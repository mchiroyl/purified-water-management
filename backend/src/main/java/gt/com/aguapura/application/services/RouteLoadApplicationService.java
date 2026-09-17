package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.loading.CreateRouteLoadCorrectionRequest;
import gt.com.aguapura.application.dto.loading.CreateRouteLoadRequest;
import gt.com.aguapura.application.dto.loading.ConfirmRouteLoadReceiptRequest;
import gt.com.aguapura.application.dto.loading.RouteLoadResponse;
import gt.com.aguapura.application.ports.RouteLoadPort;
import gt.com.aguapura.application.ports.CompanyConfigurationPersistencePort;
import gt.com.aguapura.application.ports.RouteTrackingPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import gt.com.aguapura.domain.loading.RouteLoadWorkflow;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class RouteLoadApplicationService {
    private final RouteLoadPort persistence;
    private final InventoryApplicationService inventory;
    private final CompanyConfigurationPersistencePort companyConfiguration;
    private final RouteTrackingPort tracking;

    public RouteLoadApplicationService(RouteLoadPort persistence, InventoryApplicationService inventory,
                                       CompanyConfigurationPersistencePort companyConfiguration, RouteTrackingPort tracking) {
        this.persistence = persistence;
        this.inventory = inventory;
        this.companyConfiguration = companyConfiguration;
        this.tracking = tracking;
    }

    @Transactional
    public RouteLoadResponse create(CreateRouteLoadRequest request, UUID actorId) {
        String loadType = safe(request.loadType()).toUpperCase(java.util.Locale.ROOT);
        if (loadType.isBlank()) loadType = "INITIAL";
        if (!List.of("INITIAL", "REPLENISHMENT").contains(loadType)) {
            throw validation("LOAD_TYPE_INVALID", "El tipo de carga no es válido.");
        }
        ZoneId companyZone = companyConfiguration.find().map(data -> ZoneId.of(data.timezone()))
                .orElse(ZoneId.of("America/Guatemala"));
        if (request.plannedDate().isBefore(LocalDate.now(companyZone))) {
            throw validation("LOAD_DATE_IN_PAST", "La fecha planificada no puede estar en el pasado.");
        }
        if (!persistence.activeRouteExists(request.routeId())) {
            throw validation("LOAD_ROUTE_NOT_FOUND", "No se encontró la ruta activa.");
        }
        if ("REPLENISHMENT".equals(loadType)) {
            UUID currentInitialLoad = persistence.lockCurrentStartedInitialLoad(request.routeId()).orElseThrow(() ->
                    conflict("REPLENISHMENT_ROUTE_NOT_STARTED", "La recarga requiere una ruta con recorrido iniciado."));
            if (persistence.routeLoadHasClosedSettlement(currentInitialLoad)) {
                throw conflict("REPLENISHMENT_AFTER_SETTLEMENT", "No se puede recargar una ruta cuya liquidación ya fue cerrada.");
            }
        }
        if (!persistence.activeWarehouseLocationExists(request.sourceLocationId())) {
            throw validation("LOAD_WAREHOUSE_NOT_FOUND", "El origen debe ser una bodega de inventario activa.");
        }
        UUID targetLocation = persistence.findActiveRouteLocation(request.routeId()).orElseThrow(() ->
                validation("LOAD_ROUTE_LOCATION_NOT_FOUND", "La ruta requiere una ubicación de inventario activa."));
        var products = new HashSet<UUID>();
        var items = request.items().stream().map(item -> {
            if (!products.add(item.productId())) {
                throw validation("LOAD_DUPLICATE_PRODUCT", "Un producto no puede repetirse en la misma carga.");
            }
            if (!persistence.activeInventoryProductExists(item.productId())) {
                throw validation("LOAD_PRODUCT_NOT_FOUND", "La carga contiene un producto inactivo o sin inventario.");
            }
            return new RouteLoadPort.NewItem(item.productId(), item.quantityBaseUnits());
        }).toList();
        return response(persistence.createLoad(new RouteLoadPort.NewLoad(request.routeId(),
                request.sourceLocationId(), targetLocation, request.plannedDate(), loadType,
                safe(request.notes()), actorId, items)));
    }

    @Transactional
    public RouteLoadResponse createReplenishment(CreateRouteLoadRequest request, UUID actorId) {
        var replenishment = new CreateRouteLoadRequest(request.routeId(), request.sourceLocationId(),
                request.plannedDate(), "REPLENISHMENT", request.notes(), request.items());
        return create(replenishment, actorId);
    }

    @Transactional(readOnly = true)
    public List<RouteLoadResponse> findLoads(UUID userId, boolean restrictedToSeller) {
        return persistence.findLoads(restrictedToSeller ? Optional.of(userId) : Optional.empty())
                .stream().map(this::response).toList();
    }

    @Transactional
    public RouteLoadResponse confirmWarehouse(UUID id, UUID actorId, UUID deviceId) {
        var load = persistence.findLoad(id);
        RouteLoadWorkflow.confirmWarehouse(load.status());
        return response(persistence.confirmWarehouse(id, actorId, deviceId));
    }

    @Transactional
    public RouteLoadResponse confirmReceipt(UUID id, ConfirmRouteLoadReceiptRequest request,
                                            UUID actorId, UUID deviceId, boolean restrictedToSeller) {
        var load = persistence.findLoad(id);
        if (restrictedToSeller && !persistence.sellerAssignedToRoute(actorId, load.routeId())) {
            throw forbidden("LOAD_ROUTE_FORBIDDEN", "La carga no pertenece a una ruta asignada al vendedor.");
        }
        RouteLoadWorkflow.confirmReceipt(load.status(), load.warehouseConfirmedBy(), actorId);
        load.items().stream().sorted((left, right) -> left.productId().compareTo(right.productId())).forEach(item ->
                inventory.transfer(load.sourceLocationId(), load.targetLocationId(), item.productId(),
                        item.quantityBaseUnits(), "LOAD_OUT", "LOAD_IN", "Recepción de " + number(load.loadNumber()),
                        "ROUTE_LOAD", load.id(), actorId, deviceId));
        var received = persistence.confirmReceipt(id, actorId, deviceId);
        if ("INITIAL".equals(load.loadType())) {
            var location = request.location();
            if (location == null) {
                throw validation("LOAD_RECEIPT_LOCATION_REQUIRED", "La carga inicial requiere una ubicación válida.");
            }
            tracking.recordStart(load.id(), load.routeId(), new RouteTrackingPort.GeoLocation(location.latitude(),
                    location.longitude(), location.accuracyMeters(), location.capturedAt()), actorId, deviceId);
        }
        return response(received);
    }

    @Transactional
    public RouteLoadResponse start(UUID id, UUID actorId, UUID deviceId, boolean restrictedToSeller) {
        var load = persistence.findLoad(id);
        if (restrictedToSeller && !persistence.sellerAssignedToRoute(actorId, load.routeId())) {
            throw forbidden("LOAD_ROUTE_FORBIDDEN", "La carga no pertenece a una ruta asignada al vendedor.");
        }
        if ("REPLENISHMENT".equals(load.loadType())) {
            throw conflict("REPLENISHMENT_CANNOT_START", "Una recarga se recibe dentro del recorrido y no inicia otro recorrido.");
        }
        RouteLoadWorkflow.start(load.status());
        return response(persistence.start(id, actorId, deviceId));
    }

    @Transactional(readOnly = true)
    public gt.com.aguapura.application.dto.route.RouteMapResponse getRouteMap(UUID id, boolean sellerOnly, UUID actorId) {
        var load = persistence.findLoad(id);
        if (!List.of("STARTED", "SETTLED").contains(load.status())) {
            throw conflict("ROUTE_MAP_NOT_AVAILABLE", "El mapa solo está disponible para recorridos iniciados o liquidados.");
        }
        // If the user is a seller (sellerOnly), they can only view maps of routes assigned to them.
        if (sellerOnly && !persistence.sellerAssignedToRoute(actorId, load.routeId())) {
            throw forbidden("ROUTE_MAP_FORBIDDEN", "Solo puede ver el mapa de sus propios recorridos.");
        }
        var points = tracking.findRouteMap(id);
        int salesCount = 0;
        int noPurchaseVisitCount = 0;
        BigDecimal totalAmount = BigDecimal.ZERO;
        for (var p : points) {
            if ("SALE".equals(p.pointType()) && p.saleTotal() != null) {
                salesCount++;
                totalAmount = totalAmount.add(p.saleTotal());
            } else if ("NO_PURCHASE_VISIT".equals(p.pointType())) {
                noPurchaseVisitCount++;
            }
        }
        long durationMinutes = 0;
        if (points.size() > 1) {
            var first = points.getFirst().capturedAt();
            var last = points.getLast().capturedAt();
            durationMinutes = java.time.Duration.between(first, last).toMinutes();
        }
        var pointResponses = points.stream().map(p -> new gt.com.aguapura.application.dto.route.RouteMapResponse.Point(
                p.pointType(), p.latitude(), p.longitude(), p.accuracyMeters(),
                p.capturedAt(), p.documentNumber(), p.saleTotal(), p.customerName(), p.visitNote()
        )).toList();
        String sellerName = load.sellerReceivedByUsername() != null ? load.sellerReceivedByUsername()
                : load.startedByUsername();
        return new gt.com.aguapura.application.dto.route.RouteMapResponse(
                sellerName, load.routeName(), load.plannedDate(), salesCount,
                noPurchaseVisitCount, totalAmount, durationMinutes, pointResponses);
    }

    @Transactional
    public RouteLoadResponse correct(UUID id, CreateRouteLoadCorrectionRequest request,
                                     UUID actorId, UUID deviceId) {
        var load = persistence.findLoad(id);
        if (!List.of("RECEIVED", "STARTED").contains(load.status())) {
            throw conflict("LOAD_CORRECTION_STATUS", "Solo una carga recibida o iniciada admite corrección.");
        }
        if (request.quantityDelta().signum() == 0) {
            throw validation("LOAD_CORRECTION_ZERO", "La corrección debe ser distinta de cero.");
        }
        if (load.items().stream().noneMatch(item -> item.productId().equals(request.productId()))) {
            throw validation("LOAD_CORRECTION_PRODUCT", "La corrección debe corresponder a un producto de la carga.");
        }
        UUID correctionId = UUID.randomUUID();
        BigDecimal quantity = request.quantityDelta().abs();
        boolean additional = request.quantityDelta().signum() > 0;
        UUID source = additional ? load.sourceLocationId() : load.targetLocationId();
        UUID target = additional ? load.targetLocationId() : load.sourceLocationId();
        inventory.transfer(source, target, request.productId(), quantity,
                additional ? "LOAD_OUT" : "TRANSFER_OUT", additional ? "LOAD_IN" : "TRANSFER_IN",
                "Corrección de " + number(load.loadNumber()) + ": " + request.reason().trim(),
                "ROUTE_LOAD_CORRECTION", correctionId, actorId, deviceId);
        return response(persistence.addCorrection(new RouteLoadPort.NewCorrection(correctionId, id,
                request.productId(), request.quantityDelta(), request.reason().trim(), actorId, deviceId)));
    }

    private RouteLoadResponse response(RouteLoadPort.LoadView item) {
        var items = item.items().stream().map(row -> new RouteLoadResponse.ItemResponse(row.id(), row.productId(),
                row.productCode(), row.productName(), row.baseUnitCode(), row.quantityBaseUnits())).toList();
        var corrections = item.corrections().stream().map(row -> new RouteLoadResponse.CorrectionResponse(row.id(),
                row.productId(), row.productCode(), row.productName(), row.quantityDelta(), row.reason(),
                row.actorId(), row.actorUsername(), row.deviceId(), row.createdAt())).toList();
        return new RouteLoadResponse(item.id(), number(item.loadNumber()), item.routeId(), item.routeCode(),
                item.routeName(), item.sourceLocationId(), item.sourceLocationCode(), item.sourceLocationName(),
                item.targetLocationId(), item.targetLocationCode(), item.targetLocationName(), item.plannedDate(),
                item.loadType(), item.notes(), item.status(), item.createdBy(), item.createdByUsername(), item.createdAt(),
                item.warehouseConfirmedBy(), item.warehouseConfirmedByUsername(), item.warehouseConfirmedDeviceId(),
                item.warehouseConfirmedAt(), item.sellerReceivedBy(), item.sellerReceivedByUsername(),
                item.sellerReceivedDeviceId(), item.sellerReceivedAt(), item.startedBy(), item.startedByUsername(),
                item.startedDeviceId(), item.startedAt(), items, corrections);
    }

    private String number(long value) {
        return "CARGA-%06d".formatted(value);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private BusinessException validation(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.VALIDATION);
    }

    private BusinessException conflict(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.CONFLICT);
    }

    private BusinessException forbidden(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.FORBIDDEN);
    }
}
