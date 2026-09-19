package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.jugs.JugBalanceResponse;
import gt.com.aguapura.application.dto.jugs.JugEventRequest;
import gt.com.aguapura.application.dto.jugs.JugEventResponse;
import gt.com.aguapura.application.dto.jugs.JugHistoryResponse;
import gt.com.aguapura.application.dto.jugs.JugRouteSummaryResponse;
import gt.com.aguapura.application.ports.JugLoanPort;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class JugLoanApplicationServiceTest {

    @Test
    void recordEventDelegatesToPort() {
        var port = mock(JugLoanPort.class);
        var service = new JugLoanApplicationService(port);

        var customerId = UUID.randomUUID();
        var routeId = UUID.randomUUID();
        var actorId = UUID.randomUUID();
        var deviceId = UUID.randomUUID();
        var request = new JugEventRequest(customerId, routeId, null, null, "LENT", 5, null, "Prestados");

        var expectedResponse = new JugEventResponse(
                UUID.randomUUID(), customerId, "Cliente Prueba", routeId, "Ruta Centro",
                null, null, "LENT", 5, null, "Prestados", actorId, "vendedor1", deviceId, Instant.now()
        );

        when(port.recordEvent(request, actorId, deviceId)).thenReturn(expectedResponse);

        var result = service.recordEvent(request, actorId, deviceId);

        assertThat(result).isNotNull();
        assertThat(result.eventType()).isEqualTo("LENT");
        assertThat(result.quantity()).isEqualTo(5);
        verify(port).recordEvent(request, actorId, deviceId);
    }

    @Test
    void getCustomerBalanceReturnsPortResult() {
        var port = mock(JugLoanPort.class);
        var service = new JugLoanApplicationService(port);
        var customerId = UUID.randomUUID();
        var routeId = UUID.randomUUID();

        var expected = new JugBalanceResponse(customerId, "Cliente 1", routeId, "Ruta 1", 3);
        when(port.getCustomerBalance(customerId)).thenReturn(expected);

        var result = service.getCustomerBalance(customerId);

        assertThat(result.jugsOutstanding()).isEqualTo(3);
        assertThat(result.customerName()).isEqualTo("Cliente 1");
        verify(port).getCustomerBalance(customerId);
    }

    @Test
    void getCustomerHistoryReturnsPortResult() {
        var port = mock(JugLoanPort.class);
        var service = new JugLoanApplicationService(port);
        var customerId = UUID.randomUUID();

        var expected = new JugHistoryResponse(customerId, "Cliente 1", 2, List.of());
        when(port.getCustomerHistory(customerId)).thenReturn(expected);

        var result = service.getCustomerHistory(customerId);

        assertThat(result.jugsOutstanding()).isEqualTo(2);
        verify(port).getCustomerHistory(customerId);
    }

    @Test
    void getRouteSummaryReturnsPortResult() {
        var port = mock(JugLoanPort.class);
        var service = new JugLoanApplicationService(port);
        var routeId = UUID.randomUUID();

        var expected = new JugRouteSummaryResponse(routeId, "Ruta Norte", 1, 4, List.of());
        when(port.getRouteSummary(routeId)).thenReturn(expected);

        var result = service.getRouteSummary(routeId);

        assertThat(result.totalCustomersWithJugs()).isEqualTo(1);
        assertThat(result.totalJugsOutstanding()).isEqualTo(4);
        verify(port).getRouteSummary(routeId);
    }
}
