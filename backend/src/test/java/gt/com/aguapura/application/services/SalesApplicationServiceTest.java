package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.location.GeoLocationRequest;
import gt.com.aguapura.application.dto.pricing.PriceDecisionResponse;
import gt.com.aguapura.application.dto.sales.CreateSaleRequest;
import gt.com.aguapura.application.ports.RouteTrackingPort;
import gt.com.aguapura.application.ports.SalesPort;
import jakarta.validation.Validation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import gt.com.aguapura.domain.exceptions.BusinessException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SalesApplicationServiceTest {
    @Mock private SalesPort persistence;
    @Mock private PricingApplicationService pricing;
    @Mock private InventoryApplicationService inventory;
    @Mock private AuditApplicationService audit;
    @Mock private RouteTrackingPort tracking;

    private SalesApplicationService service;
    private final UUID clientReference = UUID.randomUUID();
    private final UUID routeId = UUID.randomUUID();
    private final UUID routeLoadId = UUID.randomUUID();
    private final UUID inventoryLocationId = UUID.randomUUID();
    private final UUID warehouseLocationId = UUID.randomUUID();
    private final UUID sellerId = UUID.randomUUID();
    private final UUID customerId = UUID.randomUUID();
    private final UUID presentationId = UUID.randomUUID();
    private final UUID productId = UUID.randomUUID();
    private final UUID actorId = UUID.randomUUID();
    private final UUID deviceId = UUID.randomUUID();
    private final GeoLocationRequest location = new GeoLocationRequest(new BigDecimal("14.6349"),
            new BigDecimal("-90.5069"), new BigDecimal("4.2"), Instant.parse("2026-08-16T12:00:00Z"));

    @BeforeEach
    void setUp() {
        service = new SalesApplicationService(persistence, pricing, inventory, audit, tracking);
    }

    @Test
    void confirmedSaleRecordsItsLocationWithTheActiveRouteLoad() {
        when(persistence.findSaleContext(routeId, customerId)).thenReturn(Optional.of(new SalesPort.SaleContext(
                routeId, inventoryLocationId, routeLoadId, sellerId, "PERMANENT", false,
                BigDecimal.ZERO, BigDecimal.ZERO)));
        when(persistence.findActivePresentation(presentationId)).thenReturn(Optional.of(new SalesPort.PresentationView(
                presentationId, "GAR-20", "Garrafón", productId, "AGUA", "Agua", BigDecimal.ONE)));
        when(pricing.resolve(any())).thenReturn(new PriceDecisionResponse(new BigDecimal("10.00"), "LIST",
                null, null, null));
        when(persistence.createSale(any())).thenAnswer(invocation -> sale(invocation.getArgument(0)));

        var result = service.create(validRequest(location), actorId, deviceId, false);

        verify(tracking).recordSale(eq(routeLoadId), eq(routeId), eq(result.id()),
                eq(new RouteTrackingPort.GeoLocation(location.latitude(), location.longitude(),
                        location.accuracyMeters(), location.capturedAt())), eq(actorId), eq(deviceId));
    }

    @Test
    void requiresAValidSaleLocation() {
        var validator = Validation.buildDefaultValidatorFactory().getValidator();
        var missingLocation = validator.validate(validRequest(null));
        var outOfRangeLocation = validator.validate(validRequest(new GeoLocationRequest(new BigDecimal("91"),
                new BigDecimal("-90.5069"), new BigDecimal("4.2"), Instant.parse("2026-08-16T12:00:00Z"))));

        assertThat(missingLocation).extracting(violation -> violation.getPropertyPath().toString())
                .contains("location");
        assertThat(outOfRangeLocation).extracting(violation -> violation.getPropertyPath().toString())
                .contains("location.latitude");
    }

    @Test
    void throwsRouteLoadNotStartedWhenStartedRouteLoadIsMissing() {
        when(persistence.findSaleContext(routeId, customerId)).thenReturn(Optional.empty());
        when(persistence.findStartedRouteLoadId(routeId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(validRequest(location), actorId, deviceId, false))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("No hay una carga de inventario activa para esta ruta");
    }

    @Test
    void throwsCustomerNotInRouteWhenCustomerNotFoundInRoute() {
        when(persistence.findSaleContext(routeId, customerId)).thenReturn(Optional.empty());
        when(persistence.findStartedRouteLoadId(routeId)).thenReturn(Optional.of(UUID.randomUUID()));
        when(persistence.findCustomerInRoute(customerId, routeId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.create(validRequest(location), actorId, deviceId, false))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("El cliente seleccionado no está asignado a la ruta");
    }

    @Test
    void directOfficeSaleConsumesFromWarehouseWithoutRequiringRouteOrRouteLoad() {
        when(persistence.findDirectOfficeSaleContext(customerId, warehouseLocationId)).thenReturn(Optional.of(
                new SalesPort.SaleContext(null, warehouseLocationId, null, null, "OCCASIONAL", false,
                        BigDecimal.ZERO, BigDecimal.ZERO)));
        when(persistence.findActivePresentation(presentationId)).thenReturn(Optional.of(new SalesPort.PresentationView(
                presentationId, "GAR-20", "Garrafón", productId, "AGUA", "Agua", BigDecimal.ONE)));
        when(pricing.resolve(any())).thenReturn(new PriceDecisionResponse(new BigDecimal("10.00"), "LIST",
                null, null, null));
        when(persistence.createSale(any())).thenAnswer(invocation -> sale(invocation.getArgument(0)));

        var request = new CreateSaleRequest(clientReference, null, customerId,
                List.of(new CreateSaleRequest.ItemRequest(presentationId, BigDecimal.ONE)),
                List.of(new CreateSaleRequest.PaymentRequest("CASH", new BigDecimal("10.00"), null, null, null)),
                location, "DIRECT_OFFICE", warehouseLocationId, null, null);

        var result = service.create(request, actorId, deviceId, false);

        assertThat(result.originType()).isEqualTo("DIRECT_OFFICE");
        verify(inventory).consume(eq(warehouseLocationId), eq(productId), eq(BigDecimal.ONE),
                eq("SALE_OUT"), eq("Venta Mostrador REC-00000001"), eq("SALE"), eq(result.id()),
                eq(actorId), eq(deviceId));
        verify(tracking, never()).recordSale(any(), any(), any(), any(), any(), any());
    }

    @Test
    void sellerCannotPerformDirectOfficeSale() {
        var request = new CreateSaleRequest(clientReference, null, customerId,
                List.of(new CreateSaleRequest.ItemRequest(presentationId, BigDecimal.ONE)),
                List.of(new CreateSaleRequest.PaymentRequest("CASH", new BigDecimal("10.00"), null, null, null)),
                location, "DIRECT_OFFICE", warehouseLocationId, null, null);

        assertThatThrownBy(() -> service.create(request, actorId, deviceId, true))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Los vendedores en ruta no pueden registrar ventas de mostrador");
    }

    @Test
    void adminCanAttributeSaleToSpecificStartedLoadAndSetRetroactiveTimestamp() {
        UUID yesterdayLoadId = UUID.randomUUID();
        Instant yesterdayTimestamp = Instant.parse("2026-10-27T16:30:00Z");

        when(persistence.findSaleContext(routeId, customerId)).thenReturn(Optional.of(new SalesPort.SaleContext(
                routeId, inventoryLocationId, routeLoadId, sellerId, "PERMANENT", false,
                BigDecimal.ZERO, BigDecimal.ZERO)));
        when(persistence.isLoadStarted(yesterdayLoadId)).thenReturn(true);
        when(persistence.findActivePresentation(presentationId)).thenReturn(Optional.of(new SalesPort.PresentationView(
                presentationId, "GAR-20", "Garrafón", productId, "AGUA", "Agua", BigDecimal.ONE)));
        when(pricing.resolve(any())).thenReturn(new PriceDecisionResponse(new BigDecimal("10.00"), "LIST",
                null, null, null));
        when(persistence.createSale(any())).thenAnswer(invocation -> sale(invocation.getArgument(0)));

        var request = new CreateSaleRequest(clientReference, routeId, customerId,
                List.of(new CreateSaleRequest.ItemRequest(presentationId, BigDecimal.ONE)),
                List.of(new CreateSaleRequest.PaymentRequest("CASH", new BigDecimal("10.00"), null, null, null)),
                location, "ROUTE", null, yesterdayLoadId, yesterdayTimestamp);

        service.create(request, actorId, deviceId, false);

        var captor = ArgumentCaptor.forClass(SalesPort.NewSale.class);
        verify(persistence).createSale(captor.capture());
        assertThat(captor.getValue().routeLoadId()).isEqualTo(yesterdayLoadId);
        assertThat(captor.getValue().createdAt()).isEqualTo(yesterdayTimestamp);
    }

    private CreateSaleRequest validRequest(GeoLocationRequest requestedLocation) {
        return new CreateSaleRequest(clientReference, routeId, customerId, List.of(new CreateSaleRequest.ItemRequest(
                presentationId, BigDecimal.ONE)), List.of(new CreateSaleRequest.PaymentRequest("CASH",
                new BigDecimal("10.00"), null, null, null)), requestedLocation);
    }

    private SalesPort.SaleView sale(SalesPort.NewSale item) {
        return new SalesPort.SaleView(item.id(), item.clientReference(), "REC-00000001", item.routeId(), "R-1",
                "Ruta uno", item.inventoryLocationId(), item.sellerId(), "Vendedor", customerId, "C-1", "Cliente",
                "CONFIRMED", item.subtotal(), item.total(), "GTQ", "Agua Pura", "123", "Zona 1", "",
                actorId, "vendedor", deviceId, item.createdAt() != null ? item.createdAt() : Instant.parse("2026-08-16T12:00:00Z"),
                List.of(), List.of(), item.originType());
    }
}
