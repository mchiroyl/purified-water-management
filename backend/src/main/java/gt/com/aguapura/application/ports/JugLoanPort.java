package gt.com.aguapura.application.ports;

import gt.com.aguapura.application.dto.jugs.JugBalanceResponse;
import gt.com.aguapura.application.dto.jugs.JugEventRequest;
import gt.com.aguapura.application.dto.jugs.JugEventResponse;
import gt.com.aguapura.application.dto.jugs.JugHistoryResponse;
import gt.com.aguapura.application.dto.jugs.JugRouteSummaryResponse;

import java.util.UUID;

public interface JugLoanPort {
    JugEventResponse recordEvent(JugEventRequest request, UUID actorId, UUID deviceId);
    JugBalanceResponse getCustomerBalance(UUID customerId);
    JugHistoryResponse getCustomerHistory(UUID customerId);
    JugRouteSummaryResponse getRouteSummary(UUID routeId);
}
