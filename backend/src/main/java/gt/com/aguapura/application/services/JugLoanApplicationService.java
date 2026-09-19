package gt.com.aguapura.application.services;

import gt.com.aguapura.application.dto.jugs.JugBalanceResponse;
import gt.com.aguapura.application.dto.jugs.JugEventRequest;
import gt.com.aguapura.application.dto.jugs.JugEventResponse;
import gt.com.aguapura.application.dto.jugs.JugHistoryResponse;
import gt.com.aguapura.application.dto.jugs.JugRouteSummaryResponse;
import gt.com.aguapura.application.ports.JugLoanPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
public class JugLoanApplicationService {
    private final JugLoanPort port;

    public JugLoanApplicationService(JugLoanPort port) {
        this.port = port;
    }

    @Transactional
    public JugEventResponse recordEvent(JugEventRequest request, UUID actorId, UUID deviceId) {
        return port.recordEvent(request, actorId, deviceId);
    }

    public JugBalanceResponse getCustomerBalance(UUID customerId) {
        return port.getCustomerBalance(customerId);
    }

    public JugHistoryResponse getCustomerHistory(UUID customerId) {
        return port.getCustomerHistory(customerId);
    }

    public JugRouteSummaryResponse getRouteSummary(UUID routeId) {
        return port.getRouteSummary(routeId);
    }
}
