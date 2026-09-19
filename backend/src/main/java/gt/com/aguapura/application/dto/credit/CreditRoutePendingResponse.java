package gt.com.aguapura.application.dto.credit;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreditRoutePendingResponse(
        UUID routeId,
        String routeName,
        int totalDebtors,
        BigDecimal totalDebt,
        List<CreditBalanceResponse> debtors
) {
}
