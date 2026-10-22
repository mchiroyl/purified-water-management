package gt.com.aguapura.application.dto.jugs;

import java.util.UUID;

public record JugBalanceResponse(
        UUID customerId,
        String customerCode,
        String customerName,
        String customerPhone,
        UUID routeId,
        String routeCode,
        String routeName,
        int jugsOutstanding
) {
    public JugBalanceResponse(UUID customerId, String customerName, UUID routeId, String routeName, int jugsOutstanding) {
        this(customerId, null, customerName, null, routeId, null, routeName, jugsOutstanding);
    }
}
