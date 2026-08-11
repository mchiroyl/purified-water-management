package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AnnulmentPort {
    boolean sellerOwnsSale(UUID userId, UUID saleId);
    Optional<AnnulmentView> findBySale(UUID saleId);
    SaleSnapshot findSale(UUID saleId);
    AnnulmentView create(NewAnnulment item);
    AnnulmentView findForDecision(UUID id);
    AnnulmentView decide(UUID id, String status, UUID actorId, UUID deviceId, String notes);
    List<AnnulmentView> findAll(Optional<UUID> sellerUserId);

    record SaleSnapshot(UUID saleId, String documentNumber, UUID routeId, UUID routeLocationId,
                        UUID customerId, boolean routeOpen, List<SaleItem> items, List<Payment> payments) {}
    record SaleItem(UUID productId, String productName, BigDecimal quantityBaseUnits) {}
    record Payment(UUID paymentId, String method, BigDecimal amount) {}
    record NewAnnulment(UUID id, SaleSnapshot sale, UUID requestedBy, UUID deviceId, String reason) {}
    record AnnulmentView(UUID id, UUID saleId, String documentNumber, UUID routeId, String routeCode,
                         String routeName, String customerName, BigDecimal saleTotal, String status,
                         String reason, UUID requestedBy, String requestedByUsername, UUID decidedBy,
                         String decidedByUsername, String decisionNotes, Instant requestedAt,
                         Instant decidedAt, List<EffectView> effects) {}
    record EffectView(String effectType, String paymentMethod, BigDecimal amount, UUID productId,
                      String productName, BigDecimal quantityBaseUnits) {}
}
