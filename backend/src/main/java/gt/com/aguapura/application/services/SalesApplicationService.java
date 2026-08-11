package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.pricing.ResolvePriceRequest;
import gt.com.aguapura.application.dto.sales.CreateSaleRequest;
import gt.com.aguapura.application.dto.sales.SaleResponse;
import gt.com.aguapura.application.ports.SalesPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import gt.com.aguapura.domain.exceptions.ErrorCategory;
import gt.com.aguapura.domain.sales.SaleLineCalculator;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class SalesApplicationService {
    private final SalesPort persistence;
    private final PricingApplicationService pricing;
    private final InventoryApplicationService inventory;

    public SalesApplicationService(SalesPort persistence, PricingApplicationService pricing,
                                   InventoryApplicationService inventory) {
        this.persistence = persistence;
        this.pricing = pricing;
        this.inventory = inventory;
    }

    @Transactional
    public SaleResponse create(CreateSaleRequest request, UUID actorId, UUID deviceId, boolean restrictedToSeller) {
        var context = persistence.findSaleContext(request.routeId(), request.customerId()).orElseThrow(() ->
                validation("SALE_CONTEXT_INVALID", "La ruta, el cliente o el inventario de ruta no son válidos."));
        if (restrictedToSeller && !persistence.sellerAssignedToRoute(actorId, request.routeId())) {
            throw forbidden("SALE_ROUTE_FORBIDDEN", "El vendedor no está asignado a la ruta seleccionada.");
        }
        var seenPresentations = new HashSet<UUID>();
        var items = new ArrayList<SalesPort.NewSaleItem>();
        BigDecimal subtotal = BigDecimal.ZERO;
        for (var requested : request.items()) {
            if (!seenPresentations.add(requested.presentationId())) {
                throw validation("SALE_DUPLICATE_PRESENTATION", "Una presentación no puede repetirse en la venta.");
            }
            var presentation = persistence.findActivePresentation(requested.presentationId()).orElseThrow(() ->
                    validation("SALE_PRESENTATION_NOT_FOUND", "No se encontró la presentación activa."));
            var preliminary = SaleLineCalculator.calculate(requested.quantity(), presentation.conversionFactor(),
                    BigDecimal.ZERO);
            final var price = resolvePrice(request.customerId(), requested.presentationId(),
                    preliminary.quantityBaseUnits());
            var calculated = SaleLineCalculator.calculate(requested.quantity(), presentation.conversionFactor(),
                    price.unitPrice());
            subtotal = subtotal.add(calculated.lineTotal());
            items.add(new SalesPort.NewSaleItem(UUID.randomUUID(), presentation.productId(),
                    presentation.presentationId(), requested.quantity(), calculated.quantityBaseUnits(),
                    price.unitPrice(), calculated.lineTotal(), price.source(), price.priceVersionId(),
                    price.priceTierId(), price.specialPriceId()));
        }
        subtotal = subtotal.setScale(2, RoundingMode.HALF_UP);
        UUID saleId = UUID.randomUUID();
        var sale = persistence.createSale(new SalesPort.NewSale(saleId, request.clientReference(), request.routeId(),
                context.inventoryLocationId(), context.sellerId(), request.customerId(), subtotal, subtotal,
                actorId, deviceId, items));
        items.stream().sorted((left, right) -> left.productId().compareTo(right.productId())).forEach(item ->
                inventory.consume(context.inventoryLocationId(), item.productId(), item.quantityBaseUnits(),
                        "SALE_OUT", "Venta " + sale.documentNumber(), "SALE", saleId, actorId, deviceId));
        return response(sale);
    }

    @Transactional(readOnly = true)
    public List<SaleResponse> findSales(UUID userId, boolean restrictedToSeller) {
        return persistence.findSales(restrictedToSeller ? Optional.of(userId) : Optional.empty())
                .stream().map(this::response).toList();
    }

    @Transactional(readOnly = true)
    public SaleResponse findSale(UUID id, UUID userId, boolean restrictedToSeller) {
        return persistence.findSale(id, restrictedToSeller ? Optional.of(userId) : Optional.empty())
                .map(this::response).orElseThrow(() -> new BusinessException("SALE_NOT_FOUND",
                        "No se encontró la venta.", ErrorCategory.NOT_FOUND));
    }

    private gt.com.aguapura.application.dto.pricing.PriceDecisionResponse resolvePrice(
            UUID customerId, UUID presentationId, BigDecimal quantityBaseUnits) {
        try {
            return pricing.resolve(new ResolvePriceRequest(customerId, presentationId, quantityBaseUnits, null));
        } catch (IllegalArgumentException exception) {
            throw validation("SALE_PRICE_NOT_CONFIGURED", "No existe un precio vigente para la cantidad vendida.");
        }
    }

    private SaleResponse response(SalesPort.SaleView item) {
        var items = item.items().stream().map(row -> new SaleResponse.ItemResponse(row.id(), row.productId(),
                row.productCode(), row.productName(), row.presentationId(), row.presentationCode(),
                row.presentationName(), row.presentationQuantity(), row.quantityBaseUnits(), row.unitPrice(),
                row.lineTotal(), row.priceSource(), row.priceVersionId(), row.priceTierId(), row.specialPriceId()))
                .toList();
        return new SaleResponse(item.id(), item.clientReference(), item.documentNumber(), item.routeId(),
                item.routeCode(), item.routeName(), item.sellerId(), item.sellerName(), item.customerId(),
                item.customerCode(), item.customerName(), item.status(), item.subtotal(), item.total(),
                item.currencyCode(), item.companyName(), item.companyTaxId(), item.companyAddress(),
                item.documentLegend(), item.createdBy(), item.createdByUsername(), item.deviceId(),
                item.createdAt(), items);
    }

    private BusinessException validation(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.VALIDATION);
    }

    private BusinessException forbidden(String code, String message) {
        return new BusinessException(code, message, ErrorCategory.FORBIDDEN);
    }
}
