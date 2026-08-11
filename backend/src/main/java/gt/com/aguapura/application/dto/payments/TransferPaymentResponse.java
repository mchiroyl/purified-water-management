package gt.com.aguapura.application.dto.payments;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record TransferPaymentResponse(
        UUID id, UUID saleId, String documentNumber, UUID routeId, String routeCode, String routeName,
        UUID sellerId, String sellerName, UUID customerId, String customerCode, String customerName,
        BigDecimal amount, String currencyCode, String status, String reference, String bank,
        String evidenceReference, UUID registeredBy, String registeredByUsername, UUID deviceId,
        UUID verifiedBy, String verifiedByUsername, Instant verifiedAt, String rejectionReason,
        Instant createdAt
) {
}
