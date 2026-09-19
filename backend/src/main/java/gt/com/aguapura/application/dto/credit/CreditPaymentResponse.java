package gt.com.aguapura.application.dto.credit;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record CreditPaymentResponse(
        UUID id,
        UUID customerId,
        String customerName,
        String customerCode,
        UUID routeLoadId,
        BigDecimal amount,
        String paymentMethod,
        String status,
        String reference,
        String bank,
        String rejectionReason,
        String notes,
        UUID collectedBy,
        String collectedByName,
        UUID deviceId,
        UUID verifiedBy,
        String verifiedByName,
        Instant verifiedAt,
        Instant createdAt
) {
}
