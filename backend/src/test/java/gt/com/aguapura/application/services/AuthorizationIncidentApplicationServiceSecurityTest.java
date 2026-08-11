package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.authorization.CreateIncidentRequest;
import gt.com.aguapura.application.ports.AuthorizationIncidentPort;
import gt.com.aguapura.domain.exceptions.BusinessException;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AuthorizationIncidentApplicationServiceSecurityTest {

    @Test
    void sellerCannotAttachIncidentToASettlementWithoutOwnership() {
        var port = mock(AuthorizationIncidentPort.class);
        var service = new AuthorizationIncidentApplicationService(port);
        UUID actor = UUID.randomUUID();
        UUID settlement = UUID.randomUUID();
        when(port.createIncident(any())).thenReturn(new AuthorizationIncidentPort.IncidentView(
                UUID.randomUUID(), null, null, null, settlement, null, null,
                "CASH_DIFFERENCE", "HIGH", "OPEN", "Diferencia", actor, "seller",
                null, null, null, Instant.now(), null));

        var request = new CreateIncidentRequest(null, settlement, null, null,
                "CASH_DIFFERENCE", "HIGH", "Diferencia no reconocida");

        assertThatThrownBy(() -> service.reportIncident(request, actor, UUID.randomUUID(), true))
                .isInstanceOf(BusinessException.class)
                .extracting("code")
                .isEqualTo("INCIDENT_SETTLEMENT_FORBIDDEN");
    }
}
