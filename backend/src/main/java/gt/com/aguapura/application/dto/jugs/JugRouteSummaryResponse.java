package gt.com.aguapura.application.dto.jugs;

import java.util.List;
import java.util.UUID;

public record JugRouteSummaryResponse(
        UUID routeId,
        String routeName,
        int totalCustomersWithJugs,
        int totalJugsOutstanding,
        List<JugBalanceResponse> customerBalances
) {
}
