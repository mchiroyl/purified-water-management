package gt.com.aguapura.application.dto.jugs;

import java.util.UUID;

public record JugBalanceResponse(
        UUID customerId,
        String customerName,
        UUID routeId,
        String routeName,
        int jugsOutstanding
) {
}
