package gt.com.aguapura.application.dto.jugs;

import java.util.List;
import java.util.UUID;

public record JugHistoryResponse(
        UUID customerId,
        String customerName,
        int jugsOutstanding,
        List<JugEventResponse> events
) {
}
