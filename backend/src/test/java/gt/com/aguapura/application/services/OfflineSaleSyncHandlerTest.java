package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.location.GeoLocationRequest;
import gt.com.aguapura.application.dto.sales.CreateSaleRequest;
import gt.com.aguapura.application.dto.sales.SaleResponse;
import gt.com.aguapura.application.dto.sync.SyncOperationRequest;
import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OfflineSaleSyncHandlerTest {
    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void passesTheOfflineSaleLocationToTheSalesServiceUnchanged() {
        var sales = mock(SalesApplicationService.class);
        var handler = new OfflineSaleSyncHandler(sales, new SyncPayloadValidator(mapper,
                Validation.buildDefaultValidatorFactory().getValidator()));
        UUID routeId = UUID.randomUUID();
        UUID customerId = UUID.randomUUID();
        UUID actorId = UUID.randomUUID();
        UUID deviceId = UUID.randomUUID();
        var location = new GeoLocationRequest(new BigDecimal("14.6349"), new BigDecimal("-90.5069"),
                new BigDecimal("4.2"), Instant.parse("2026-08-16T12:00:00Z"));
        var payload = mapper.createObjectNode()
                .put("clientReference", UUID.randomUUID().toString())
                .put("routeId", routeId.toString())
                .put("customerId", customerId.toString());
        payload.putArray("items").addObject().put("presentationId", UUID.randomUUID().toString())
                .put("quantity", "1.0000");
        payload.putArray("payments").addObject().put("method", "CASH").put("amount", "10.00");
        payload.putObject("location").put("latitude", location.latitude().toString())
                .put("longitude", location.longitude().toString())
                .put("accuracyMeters", location.accuracyMeters().toString())
                .put("capturedAt", location.capturedAt().toString());
        when(sales.create(any(), eq(actorId), eq(deviceId), anyBoolean())).thenReturn(sale());

        handler.handle(new SyncOperationRequest(UUID.randomUUID(), deviceId, "SALE", "CREATE", UUID.randomUUID(),
                payload, List.of(), Instant.parse("2026-08-16T12:01:00Z")),
                new gt.com.aguapura.application.ports.SyncOperationHandler.SyncActor(actorId, deviceId, true));

        var request = ArgumentCaptor.forClass(CreateSaleRequest.class);
        verify(sales).create(request.capture(), eq(actorId), eq(deviceId), eq(true));
        assertThat(request.getValue().location()).isEqualTo(location);
    }

    private SaleResponse sale() {
        return new SaleResponse(UUID.randomUUID(), UUID.randomUUID(), "REC-00000001", UUID.randomUUID(), "R-1",
                "Ruta uno", UUID.randomUUID(), "Vendedor", UUID.randomUUID(), "C-1", "Cliente", "CONFIRMED",
                BigDecimal.TEN, BigDecimal.TEN, "GTQ", "Agua Pura", "123", "Zona 1", "", UUID.randomUUID(),
                "vendedor", UUID.randomUUID(), Instant.parse("2026-08-16T12:00:00Z"), List.of(), List.of(),
                BigDecimal.TEN, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO);
    }
}
