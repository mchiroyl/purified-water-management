package gt.com.aguapura.application.dto.credit;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CreditStatementEntryResponse(
        UUID id,
        String entryType,
        BigDecimal amount,
        BigDecimal balanceAfter,
        Instant occurredAt,
        String documentOrReference,
        String description,
        String createdByName
) {
}
