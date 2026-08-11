package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentPort {
    List<TransferView> findTransfers();
    Optional<TransferView> findTransfer(UUID id);
    TransferView decideTransfer(UUID id, String status, UUID decidedBy, String rejectionReason);

    record TransferView(UUID id, UUID saleId, String documentNumber, UUID routeId, String routeCode,
                        String routeName, UUID sellerId, String sellerName, UUID customerId,
                        String customerCode, String customerName, BigDecimal amount, String currencyCode,
                        String status, String reference, String bank, String evidenceReference,
                        UUID registeredBy, String registeredByUsername, UUID deviceId, UUID verifiedBy,
                        String verifiedByUsername, Instant verifiedAt, String rejectionReason,
                        Instant createdAt) {
    }
}
