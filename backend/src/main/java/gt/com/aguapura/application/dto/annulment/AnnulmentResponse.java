package gt.com.aguapura.application.dto.annulment;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AnnulmentResponse(UUID id, UUID saleId, String documentNumber, UUID routeId,
                                String routeCode, String routeName, String customerName,
                                BigDecimal saleTotal, String status, String reason,
                                UUID requestedBy, String requestedByUsername, UUID decidedBy,
                                String decidedByUsername, String decisionNotes, Instant requestedAt,
                                Instant decidedAt, List<Effect> effects) {
    public record Effect(String effectType, String paymentMethod, BigDecimal amount,
                         UUID productId, String productName, BigDecimal quantityBaseUnits) {}
}
