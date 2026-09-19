package gt.com.aguapura.application.dto.credit;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

public record CreditStatementResponse(
        UUID customerId,
        String customerName,
        String customerCode,
        boolean creditAllowed,
        BigDecimal creditLimit,
        BigDecimal currentBalance,
        BigDecimal availableCredit,
        List<CreditStatementEntryResponse> entries
) {
}
