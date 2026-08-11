package gt.com.aguapura.application.dto.reports;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record SettlementReportRow(UUID settlementId, Instant occurredAt, String sellerCode, String sellerName,
                                  String routeCode, String routeName, long loadNumber, BigDecimal salesTotal,
                                  BigDecimal expectedCash, BigDecimal deliveredCash, BigDecimal transfers,
                                  BigDecimal credit, BigDecimal monetaryDifference,
                                  BigDecimal inventoryDifference, String status) {
}
