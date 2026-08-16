package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.loading.ConfirmRouteLoadReceiptRequest;
import gt.com.aguapura.application.dto.loading.CreateRouteLoadRequest;
import gt.com.aguapura.application.dto.location.GeoLocationRequest;
import gt.com.aguapura.application.ports.CompanyConfigurationPersistencePort;
import gt.com.aguapura.application.ports.RouteLoadPort;
import gt.com.aguapura.application.ports.RouteTrackingPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RouteLoadApplicationServiceTest {
    @Mock private RouteLoadPort persistence;
    @Mock private InventoryApplicationService inventory;
    @Mock private CompanyConfigurationPersistencePort companyConfiguration;
    @Mock private RouteTrackingPort tracking;

    private RouteLoadApplicationService service;
    private final UUID loadId = UUID.randomUUID();
    private final UUID routeId = UUID.randomUUID();
    private final UUID actorId = UUID.randomUUID();
    private final UUID deviceId = UUID.randomUUID();
    private final GeoLocationRequest location = new GeoLocationRequest(new BigDecimal("14.6349"),
            new BigDecimal("-90.5069"), new BigDecimal("4.2"), Instant.parse("2026-08-16T12:00:00Z"));

    @BeforeEach
    void setUp() {
        service = new RouteLoadApplicationService(persistence, inventory, companyConfiguration, tracking);
    }

    @Test
    void receiptOfInitialLoadRecordsRouteStartAtReceiptLocation() {
        var load = load("INITIAL");
        when(persistence.findLoad(loadId)).thenReturn(load);
        when(persistence.sellerAssignedToRoute(actorId, routeId)).thenReturn(true);
        when(persistence.confirmReceipt(loadId, actorId, deviceId)).thenReturn(received(load));

        service.confirmReceipt(loadId, new ConfirmRouteLoadReceiptRequest(location), actorId, deviceId, true);

        InOrder order = inOrder(inventory, persistence, tracking);
        order.verify(inventory).transfer(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
        order.verify(persistence).confirmReceipt(loadId, actorId, deviceId);
        order.verify(tracking).recordStart(eq(loadId), eq(routeId), eq(new RouteTrackingPort.GeoLocation(
                location.latitude(), location.longitude(), location.accuracyMeters(), location.capturedAt())),
                eq(actorId), eq(deviceId));
    }

    @Test
    void receiptOfReplenishmentDoesNotRecordAnotherRouteStart() {
        var load = load("REPLENISHMENT");
        when(persistence.findLoad(loadId)).thenReturn(load);
        when(persistence.sellerAssignedToRoute(actorId, routeId)).thenReturn(true);
        when(persistence.confirmReceipt(loadId, actorId, deviceId)).thenReturn(received(load));

        service.confirmReceipt(loadId, new ConfirmRouteLoadReceiptRequest(location), actorId, deviceId, true);

        verify(tracking, never()).recordStart(any(), any(), any(), any(), any());
    }

    @Test
    void historicalClosedRunDoesNotBlockReplenishmentForLaterStartedInitialLoad() {
        UUID currentInitialLoad = UUID.randomUUID();
        var request = new CreateRouteLoadRequest(routeId, UUID.randomUUID(), LocalDate.now(), "REPLENISHMENT", "", List.of(
                new CreateRouteLoadRequest.ItemRequest(UUID.randomUUID(), BigDecimal.ONE)));
        when(companyConfiguration.find()).thenReturn(Optional.empty());
        when(persistence.activeRouteExists(routeId)).thenReturn(true);
        when(persistence.lockCurrentStartedInitialLoad(routeId)).thenReturn(Optional.of(currentInitialLoad));
        when(persistence.routeLoadHasClosedSettlement(currentInitialLoad)).thenReturn(false);
        when(persistence.activeWarehouseLocationExists(request.sourceLocationId())).thenReturn(true);
        when(persistence.findActiveRouteLocation(routeId)).thenReturn(Optional.of(UUID.randomUUID()));
        when(persistence.activeInventoryProductExists(request.items().getFirst().productId())).thenReturn(true);
        when(persistence.createLoad(any())).thenReturn(view("REPLENISHMENT", "PREPARED"));

        service.createReplenishment(request, actorId);

        InOrder order = inOrder(persistence);
        order.verify(persistence).lockCurrentStartedInitialLoad(routeId);
        order.verify(persistence).routeLoadHasClosedSettlement(currentInitialLoad);
        verify(persistence, times(1)).createLoad(any());
    }

    @Test
    void closedCurrentRunRejectsReplenishmentAfterLockingIt() {
        UUID currentInitialLoad = UUID.randomUUID();
        var request = new CreateRouteLoadRequest(routeId, UUID.randomUUID(), LocalDate.now(), "REPLENISHMENT", "", List.of(
                new CreateRouteLoadRequest.ItemRequest(UUID.randomUUID(), BigDecimal.ONE)));
        when(companyConfiguration.find()).thenReturn(Optional.empty());
        when(persistence.activeRouteExists(routeId)).thenReturn(true);
        when(persistence.lockCurrentStartedInitialLoad(routeId)).thenReturn(Optional.of(currentInitialLoad));
        when(persistence.routeLoadHasClosedSettlement(currentInitialLoad)).thenReturn(true);

        org.junit.jupiter.api.Assertions.assertThrows(BusinessException.class, () -> service.createReplenishment(request, actorId));

        verify(persistence, never()).createLoad(any());
    }

    private RouteLoadPort.LoadView load(String loadType) {
        return view(loadType, "WAREHOUSE_CONFIRMED");
    }

    private RouteLoadPort.LoadView received(RouteLoadPort.LoadView load) {
        return view(load.loadType(), "RECEIVED");
    }

    private RouteLoadPort.LoadView view(String loadType, String status) {
        return new RouteLoadPort.LoadView(loadId, 1L, routeId, "R-1", "Ruta uno", UUID.randomUUID(), "BOD-1",
                "Bodega", UUID.randomUUID(), "RUT-1", "Ruta", LocalDate.of(2026, 8, 16), "", status,
                UUID.randomUUID(), "bodega", Instant.parse("2026-08-16T11:00:00Z"), UUID.randomUUID(),
                "bodega", UUID.randomUUID(), Instant.parse("2026-08-16T11:30:00Z"), null, null, null, null,
                loadType, null, null, null, null, List.of(new RouteLoadPort.ItemView(UUID.randomUUID(), UUID.randomUUID(),
                "AGUA", "Agua", "UN", BigDecimal.ONE)), List.of());
    }
}
