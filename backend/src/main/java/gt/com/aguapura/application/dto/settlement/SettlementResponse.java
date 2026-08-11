package gt.com.aguapura.application.dto.settlement;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record SettlementResponse(UUID id, UUID routeLoadId, long loadNumber, UUID routeId,
                                 String routeCode, String routeName, String sellerName, String loadStatus,
                                 String status, BigDecimal salesTotal, BigDecimal expectedCash,
                                 BigDecimal deliveredCash, BigDecimal verifiedTransfers,
                                 BigDecimal appliedCredit, BigDecimal monetaryDifference,
                                 BigDecimal physicalDifferenceTotal, List<String> blockingReasons,
                                 Instant calculatedAt, UUID closedBy, String closedByUsername,
                                 Instant closedAt, String closeNotes, List<Item> items,
                                 List<CashDelivery> cashDeliveries) {
    public record Item(UUID id, UUID productId, String productCode, String productName,
                       BigDecimal loadedUnits, BigDecimal soldUnits, BigDecimal returnedGoodUnits,
                       BigDecimal customerReturnUnits, BigDecimal approvedWasteUnits,
                       BigDecimal physicalDifference) {
    }
    public record CashDelivery(UUID id, BigDecimal amount, String deliveredByUsername,
                               String receivedByUsername, String notes, Instant deliveredAt) {
    }
}
