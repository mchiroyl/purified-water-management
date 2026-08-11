package gt.com.aguapura.application.ports;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SettlementPort {
    boolean sellerOwnsLoad(UUID userId, UUID routeLoadId);
    Source loadSource(UUID routeLoadId);
    SettlementView saveCalculation(NewCalculation calculation);
    SettlementView close(UUID routeLoadId, UUID actorId, UUID deviceId, String notes);
    CashDeliveryView addCashDelivery(UUID routeLoadId, UUID receivedBy, UUID deviceId,
                                     BigDecimal amount, String notes);
    List<SettlementView> findAll(Optional<UUID> sellerUserId);

    record Source(UUID routeLoadId, long loadNumber, UUID routeId, String routeCode,
                  String routeName, String sellerName, String loadStatus, Instant startedAt,
                  List<ProductSource> products, FinancialSource financial, List<String> blockers) {
    }
    record ProductSource(UUID productId, String productCode, String productName,
                         BigDecimal loadedUnits, BigDecimal soldUnits, BigDecimal returnedGoodUnits,
                         BigDecimal customerReturnUnits, BigDecimal approvedWasteUnits) {
    }
    record FinancialSource(BigDecimal salesTotal, BigDecimal expectedCash, BigDecimal deliveredCash,
                           BigDecimal verifiedTransfers, BigDecimal appliedCredit) {
    }
    record NewCalculation(UUID settlementId, Source source, String status,
                          BigDecimal monetaryDifference, BigDecimal physicalDifferenceTotal,
                          List<String> blockers, List<NewItem> items) {
    }
    record NewItem(UUID id, ProductSource source, BigDecimal physicalDifference) {
    }
    record SettlementView(UUID id, UUID routeLoadId, long loadNumber, UUID routeId,
                          String routeCode, String routeName, String sellerName, String loadStatus,
                          String status, BigDecimal salesTotal, BigDecimal expectedCash,
                          BigDecimal deliveredCash, BigDecimal verifiedTransfers, BigDecimal appliedCredit,
                          BigDecimal monetaryDifference, BigDecimal physicalDifferenceTotal,
                          List<String> blockingReasons, Instant calculatedAt, UUID closedBy,
                          String closedByUsername, Instant closedAt, String closeNotes,
                          List<ItemView> items, List<CashDeliveryView> cashDeliveries) {
    }
    record ItemView(UUID id, UUID productId, String productCode, String productName,
                    BigDecimal loadedUnits, BigDecimal soldUnits, BigDecimal returnedGoodUnits,
                    BigDecimal customerReturnUnits, BigDecimal approvedWasteUnits,
                    BigDecimal physicalDifference) {
    }
    record CashDeliveryView(UUID id, BigDecimal amount, String deliveredByUsername,
                            String receivedByUsername, String notes, Instant deliveredAt) {
    }
}
