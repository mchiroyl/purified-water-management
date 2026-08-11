package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.returns.ConfirmReturnReceiptRequest;
import gt.com.aguapura.application.dto.returns.CreateReturnRequest;
import gt.com.aguapura.application.dto.returns.ReturnResponse;
import gt.com.aguapura.application.ports.ReturnPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import gt.com.aguapura.domain.returns.ReturnReceiptPolicy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class ReturnApplicationService {
    private static final Set<String> TYPES = Set.of("UNSOLD_GOOD", "CUSTOMER_RETURN");
    private final ReturnPort persistence;
    private final InventoryApplicationService inventory;

    public ReturnApplicationService(ReturnPort persistence, InventoryApplicationService inventory) {
        this.persistence = persistence;
        this.inventory = inventory;
    }

    @Transactional
    public ReturnResponse create(CreateReturnRequest request, UUID actorId, UUID deviceId,
                                 boolean restrictedToSeller) {
        if (!TYPES.contains(request.returnType())) throw validation("RETURN_TYPE_INVALID",
                "El tipo de devolución no es válido.");
        if (restrictedToSeller && !persistence.sellerAssignedToRoute(actorId, request.routeId())) {
            throw forbidden("RETURN_ROUTE_FORBIDDEN", "El vendedor no está asignado a la ruta seleccionada.");
        }
        var route = persistence.findRouteContext(request.routeId()).orElseThrow(() ->
                validation("RETURN_ROUTE_INVALID", "La ruta requiere vendedor e inventario activos."));
        if ("CUSTOMER_RETURN".equals(request.returnType())) {
            if (request.customerId() == null || !persistence.customerBelongsToRoute(request.customerId(), request.routeId())) {
                throw validation("RETURN_CUSTOMER_REQUIRED", "La devolución de cliente requiere un cliente de la ruta.");
            }
            if (request.saleId() != null && !persistence.saleBelongsToCustomerAndRoute(
                    request.saleId(), request.customerId(), request.routeId())) {
                throw validation("RETURN_SALE_INVALID", "La venta no corresponde al cliente y ruta indicados.");
            }
        } else if (request.customerId() != null || request.saleId() != null) {
            throw validation("UNSOLD_GOOD_CUSTOMER_NOT_ALLOWED",
                    "El producto no vendido no debe asociarse a cliente o venta.");
        }
        var presentations = new HashSet<UUID>();
        var items = request.items().stream().map(row -> {
            if (!presentations.add(row.presentationId())) throw validation("RETURN_DUPLICATE_PRESENTATION",
                    "Una presentación no puede repetirse en la devolución.");
            var presentation = persistence.findPresentation(row.presentationId()).orElseThrow(() ->
                    validation("RETURN_PRESENTATION_NOT_FOUND", "La presentación no está activa."));
            return new ReturnPort.NewItem(UUID.randomUUID(), presentation, row.presentationQuantity(),
                    row.presentationQuantity().multiply(presentation.conversionFactor()));
        }).toList();
        return response(persistence.create(new ReturnPort.NewReturn(request.clientReference(),
                request.clientReference(), request.returnType(), route, request.customerId(), request.saleId(),
                actorId, deviceId, request.reason().trim(), request.reportedAtLocal(), items)));
    }

    @Transactional(readOnly = true)
    public List<ReturnResponse> findReturns(UUID actorId, boolean restrictedToSeller) {
        return persistence.findReturns(restrictedToSeller ? Optional.of(actorId) : Optional.empty())
                .stream().map(this::response).toList();
    }

    @Transactional
    public ReturnResponse confirmReceipt(UUID id, ConfirmReturnReceiptRequest request, UUID actorId,
                                         UUID deviceId, String role) {
        if (!persistence.activeWarehouseExists(request.warehouseLocationId())) throw validation(
                "RETURN_WAREHOUSE_INVALID", "La recepción requiere una bodega de inventario activa.");
        var item = persistence.findForReceipt(id);
        var quantities = new HashMap<UUID, BigDecimal>();
        for (var receipt : request.items()) {
            if (quantities.put(receipt.itemId(), receipt.receivedBaseUnits()) != null) throw validation(
                    "RETURN_RECEIPT_DUPLICATE_ITEM", "La recepción contiene un detalle repetido.");
        }
        var itemIds = item.items().stream().map(ReturnPort.ReturnItemView::id)
                .collect(java.util.stream.Collectors.toSet());
        if (!quantities.keySet().equals(itemIds)) throw validation("RETURN_RECEIPT_ITEMS",
                "La recepción debe resolver todos los detalles reportados.");
        BigDecimal reported = item.items().stream().map(ReturnPort.ReturnItemView::reportedBaseUnits)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal received = item.items().stream().map(row -> quantities.get(row.id()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        var policy = ReturnReceiptPolicy.confirm(item.status(), role, reported, received);
        var receipt = persistence.confirmReceipt(new ReturnPort.NewReceipt(id, request.warehouseLocationId(),
                actorId, deviceId, policy.status(), request.notes().trim(), item.items().stream()
                .map(row -> new ReturnPort.ItemReceipt(row.id(), quantities.get(row.id()))).toList()));
        item.items().stream().sorted((left, right) -> left.productId().compareTo(right.productId()))
                .filter(row -> quantities.get(row.id()).signum() > 0).forEach(row -> {
                    BigDecimal quantity = quantities.get(row.id());
                    if ("UNSOLD_GOOD".equals(item.returnType())) {
                        inventory.transfer(item.routeLocationId(), request.warehouseLocationId(), row.productId(),
                                quantity, "RETURN_OUT", "RETURN_IN", "Recepción de producto no vendido",
                                "RETURN", id, actorId, deviceId);
                    } else {
                        inventory.receive(request.warehouseLocationId(), row.productId(), quantity, "RETURN_IN",
                                "Recepción de devolución de cliente", "RETURN", id, actorId, deviceId);
                    }
                });
        return response(receipt);
    }

    private ReturnResponse response(ReturnPort.ReturnView item) {
        var details = item.items().stream().map(row -> new ReturnResponse.Item(row.id(), row.presentationId(),
                row.presentationCode(), row.presentationName(), row.productId(), row.productCode(),
                row.productName(), row.presentationQuantity(), row.reportedBaseUnits(),
                row.receivedBaseUnits())).toList();
        BigDecimal reported = details.stream().map(ReturnResponse.Item::reportedBaseUnits)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal received = details.stream().map(ReturnResponse.Item::receivedBaseUnits)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new ReturnResponse(item.id(), item.clientReference(), item.returnType(), item.routeId(),
                item.routeCode(), item.routeName(), item.routeLocationId(), item.customerId(), item.customerCode(),
                item.customerName(), item.saleId(), item.saleDocumentNumber(), item.sellerId(), item.sellerName(),
                item.reportedBy(), item.reportedByUsername(), item.deviceId(), item.status(), item.reason(),
                item.reportedAtLocal(), item.receivedAtServer(), item.warehouseLocationId(),
                item.warehouseLocationName(), item.receivedBy(), item.receivedByUsername(), item.receivedDeviceId(),
                item.receivedAt(), item.receiptNotes(), reported, received, reported.subtract(received), details);
    }

    private BusinessException validation(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.VALIDATION);
    }
    private BusinessException forbidden(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.FORBIDDEN);
    }
}
